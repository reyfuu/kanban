import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { AuditService } from '../src/modules/shared/audit/audit.service.js'
import { MissingAuditTrailError } from '../src/modules/shared/audit/audit.types.js'
import { REDACTED } from '../src/modules/shared/audit/redact.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'

/**
 * Integration, against the real database, as the real runtime role.
 *
 * The point is not that the code runs. It is that the K-7 guarantees hold when
 * exercised through the application path rather than through psql: that a write
 * without an audit entry is impossible, that the runtime role genuinely cannot
 * mutate audit_log, and that secrets never reach a table nothing can clean up.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const auditService = new AuditService(prisma)

const orgUnitId = randomUUID()
const employeeId = randomUUID()
const actorId = randomUUID()

const context = {
  requestId: 'req_test',
  actorId,
  actorRoles: ['SYS_ADMIN'] as const,
  sessionId: null,
  ipAddress: '10.0.0.1',
}

beforeAll(async () => {
  await prisma.$connect()
  await prisma.organizationUnit.create({
    data: { id: orgUnitId, code: `OU-${orgUnitId.slice(0, 8)}`, name: 'Unit Uji' },
  })
  await prisma.employee.create({
    data: {
      id: employeeId,
      employeeNumber: `E-${employeeId.slice(0, 8)}`,
      fullName: 'Penguji',
      email: `${employeeId.slice(0, 8)}@contoh.internal`,
      jobTitle: 'Staf',
      orgUnitId,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2026-01-01'),
    },
  })
  await prisma.appUser.create({
    data: { id: actorId, employeeId, externalId: `uji.${actorId.slice(0, 8)}`, userType: 'INTERNAL' },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('FR-X-008 · jejak audit', () => {
  it('menulis jejak dan menjaga rantai tetap sah', async () => {
    const target = randomUUID()

    await runWithRequestContext(context, () =>
      uow.write(async (tx, audit) => {
        await tx.role.create({ data: { id: target, code: `R-${target.slice(0, 8)}`, name: 'Peran Uji' } })
        await audit.record({
          action: 'BUAT_PERAN',
          objectType: 'ROLE',
          objectId: target,
          after: { code: 'R', name: 'Peran Uji' },
        })
      }),
    )

    const row = await prisma.auditLog.findFirst({ where: { objectId: target } })
    expect(row?.action).toBe('BUAT_PERAN')
    expect(row?.hash).toMatch(/^[0-9a-f]{64}$/)

    const chain = await auditService.verifyChain()
    expect(chain.isValid, `rantai putus di ${chain.brokenAt}`).toBe(true)
  })

  it('membatalkan transaksi bisnis bila tidak ada jejak audit', async () => {
    const orphan = randomUUID()

    await expect(
      runWithRequestContext(context, () =>
        uow.write(async (tx) => {
          await tx.role.create({ data: { id: orphan, code: `R-${orphan.slice(0, 8)}`, name: 'Tanpa Jejak' } })
          // Deliberately records nothing.
        }),
      ),
    ).rejects.toBeInstanceOf(MissingAuditTrailError)

    // FR-X-008 Validasi: the business change must be gone too, not merely
    // unaudited. An unaudited row that survives is the exact failure the rule
    // exists to prevent.
    expect(await prisma.role.findUnique({ where: { id: orphan } })).toBeNull()
  })

  it('menyamarkan rahasia sebelum menyentuh tabel yang tidak dapat dibersihkan', async () => {
    const target = randomUUID()

    await runWithRequestContext(context, () =>
      uow.write(async (tx, audit) => {
        await tx.role.create({ data: { id: target, code: `R-${target.slice(0, 8)}`, name: 'Rahasia' } })
        await audit.record({
          action: 'UJI_PENYAMARAN',
          objectType: 'ROLE',
          objectId: target,
          after: { username: 'budi', password: 'sangat-rahasia', nested: { api_key: 'AIza-palsu' } },
        })
      }),
    )

    const row = await prisma.auditLog.findFirst({ where: { objectId: target } })
    const after = row?.afterValue as Record<string, any>

    expect(after.password).toBe(REDACTED)
    expect(after.nested.api_key).toBe(REDACTED)
    expect(after.username).toBe('budi')
    expect(JSON.stringify(after)).not.toContain('sangat-rahasia')
  })

  it('K-7 · peran runtime tidak dapat mengubah atau menghapus jejak audit', async () => {
    const row = await prisma.auditLog.findFirst({ orderBy: { id: 'desc' } })
    expect(row).not.toBeNull()

    await expect(
      prisma.auditLog.update({ where: { id: row!.id }, data: { action: 'DIPALSUKAN' } }),
    ).rejects.toThrow()

    await expect(prisma.auditLog.delete({ where: { id: row!.id } })).rejects.toThrow()

    await expect(prisma.$executeRawUnsafe('TRUNCATE public.audit_log')).rejects.toThrow()
  })

  it('menolak operasi tulis tanpa aktor terautentikasi', async () => {
    await expect(
      uow.write(async (_tx, audit) => {
        await audit.record({ action: 'X', objectType: 'ROLE', objectId: randomUUID() })
      }),
    ).rejects.toThrow(/aktor terautentikasi/)
  })
})
