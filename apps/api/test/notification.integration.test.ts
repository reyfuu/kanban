import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { NotificationService } from '../src/modules/shared/notification/notification.service.js'

/**
 * FR-X-010 · the notification engine, against the real database.
 *
 * The rule under test is rule 2: escalation and missed-deadline notifications
 * cannot be summarised or switched off. It is tested here rather than as a unit
 * because the failure mode it guards against is specifically a preferences row
 * in the database silencing a message, and a test with a stubbed preference
 * lookup would be testing the stub.
 *
 * The scenario is deliberately the adversarial one: a user who has set the most
 * aggressive muting available, then receives an escalation about themselves.
 */
const prisma = new PrismaService()
const notifications = new NotificationService(prisma)

const ids = {
  orgUnit: randomUUID(),
  employee: randomUUID(),
  user: randomUUID(),
}
const suffix = ids.user.slice(0, 8)
const createdIds: string[] = []

beforeAll(async () => {
  await prisma.$connect()
  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUN-${suffix}`, name: 'Unit Uji Notifikasi' },
  })
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber: `EMN-${suffix}`,
      fullName: 'Penerima Uji',
      email: `notif-${suffix}@contoh.internal`,
      jobTitle: 'Staf',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2022-01-01'),
    },
  })
  await prisma.appUser.create({
    data: { id: ids.user, employeeId: ids.employee, externalId: `notif-${suffix}`, userType: 'INTERNAL' },
  })

  // The adversarial setup: weekly digest for everything, by choice.
  await prisma.notificationPreference.create({
    data: {
      id: randomUUID(),
      userId: ids.user,
      defaultFrequency: 'RINGKASAN_MINGGUAN',
      categoryOverrides: {},
    },
  })
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { recipientUserId: ids.user } })
  await prisma.notificationPreference.deleteMany({ where: { userId: ids.user } })
  try {
    await prisma.appUser.deleteMany({ where: { id: ids.user } })
    await prisma.employee.deleteMany({ where: { id: ids.employee } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; stays, correctly (K-7).
  }
  await prisma.$disconnect()
})

/** The engine writes inside a caller's transaction, so tests supply one. */
async function inTx<T>(fn: (tx: never) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => fn(tx as never))
}

describe('FR-X-010 aturan 2 · eskalasi tidak dapat diringkas atau dimatikan', () => {
  it('NT-03 (tenggat terlewat) TIDAK dapat diringkas meski preferensi mingguan', async () => {
    // Inti seluruh aturannya. Pesan ini ada justru karena seseorang sudah
    // berhenti memperhatikan; membiarkan orang itu membungkamnya menghapus
    // kontrolnya tepat saat kontrol itu bekerja.
    const id = await inTx((tx) =>
      notifications.notify(tx, {
        code: 'NT-03',
        recipientUserId: ids.user,
        title: 'Tenggat permintaan bukti terlewat',
      }),
    )
    expect(id).not.toBeNull()
    createdIds.push(id!)

    const row = await prisma.notification.findUnique({ where: { id: id! } })
    expect(row?.canBeSummarized).toBe(false)
  })

  it('kesebelas kode non-ringkas menolak diringkas, bukan hanya NT-03', async () => {
    // Diperiksa seluruhnya: satu baris matriks yang salah ketik hanya akan
    // terlihat kalau kodenya yang itu kebetulan diuji.
    const nonSummarizable = ['NT-07', 'NT-08', 'NT-10', 'NT-11', 'NT-13', 'NT-14', 'NT-16', 'NT-21', 'NT-24', 'NT-27']
    for (const code of nonSummarizable) {
      const id = await inTx((tx) =>
        notifications.notify(tx, { code, recipientUserId: ids.user, title: `Uji ${code}` }),
      )
      expect(id, `${code} harus terkirim`).not.toBeNull()
      createdIds.push(id!)
      const row = await prisma.notification.findUnique({ where: { id: id! } })
      expect(row?.canBeSummarized, `${code} tidak boleh dapat diringkas`).toBe(false)
    }
  })

  it('kode yang memang boleh diringkas menghormati preferensi', async () => {
    // Sisi lain dari aturan yang sama: kalau semuanya dipaksa seketika,
    // preferensi menjadi tidak ada artinya dan orang berhenti mempercayainya.
    const id = await inTx((tx) =>
      notifications.notify(tx, {
        code: 'NT-01',
        recipientUserId: ids.user,
        title: 'Permintaan bukti diterbitkan',
      }),
    )
    createdIds.push(id!)
    const row = await prisma.notification.findUnique({ where: { id: id! } })
    expect(row?.canBeSummarized).toBe(true)
  })

  it('forceImmediate hanya dapat menaikkan urgensi (NT-20 H-7)', async () => {
    const id = await inTx((tx) =>
      notifications.notify(tx, {
        code: 'NT-20',
        recipientUserId: ids.user,
        title: 'Tinjauan berkala H-7',
        forceImmediate: true,
      }),
    )
    createdIds.push(id!)
    const row = await prisma.notification.findUnique({ where: { id: id! } })
    expect(row?.canBeSummarized).toBe(false)
  })
})

describe('FR-X-010 · kanal dan antrean surel', () => {
  it('kode berkanal surel masuk antrean; kode aplikasi saja tidak', async () => {
    const emailId = await inTx((tx) =>
      notifications.notify(tx, { code: 'NT-03', recipientUserId: ids.user, title: 'Surel' }),
    )
    const appOnlyId = await inTx((tx) =>
      notifications.notify(tx, { code: 'NT-05', recipientUserId: ids.user, title: 'Aplikasi saja' }),
    )
    createdIds.push(emailId!, appOnlyId!)

    const email = await prisma.notification.findUnique({ where: { id: emailId! } })
    const appOnly = await prisma.notification.findUnique({ where: { id: appOnlyId! } })
    expect(email?.emailStatus).toBe('ANTRE')
    expect(appOnly?.emailStatus).toBe('TIDAK_BERLAKU')
  })

  it('aturan 4 · gagal tiga kali menandai GAGAL, bukan mencoba selamanya', async () => {
    const id = await inTx((tx) =>
      notifications.notify(tx, { code: 'NT-01', recipientUserId: ids.user, title: 'Akan gagal' }),
    )
    createdIds.push(id!)

    await notifications.recordEmailAttempt(id!, false)
    let row = await prisma.notification.findUnique({ where: { id: id! } })
    expect(row?.emailStatus, 'percobaan pertama belum boleh menyerah').toBe('ANTRE')

    await notifications.recordEmailAttempt(id!, false)
    await notifications.recordEmailAttempt(id!, false)
    row = await prisma.notification.findUnique({ where: { id: id! } })
    expect(row?.emailStatus).toBe('GAGAL')
    expect(row?.emailAttempts).toBe(3)
    expect(row?.emailFailedAt).not.toBeNull()
  })
})

describe('FR-X-010 · pusat notifikasi', () => {
  it('markRead tidak dapat menandai notifikasi milik orang lain', async () => {
    // Tanpa pembatasan penerima, siapa pun yang terautentikasi bisa menandai
    // eskalasi orang lain sebagai sudah dibaca.
    const id = await inTx((tx) =>
      notifications.notify(tx, { code: 'NT-03', recipientUserId: ids.user, title: 'Milik orang lain' }),
    )
    createdIds.push(id!)

    await notifications.markRead(randomUUID(), id!)

    const row = await prisma.notification.findUnique({ where: { id: id! } })
    expect(row?.isRead).toBe(false)
  })
})
