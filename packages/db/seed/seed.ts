import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from './catalogue.js'
import { seedModuleB } from './module-b.js'

/**
 * Development and demo dataset.
 *
 * Idempotent: safe to re-run. It upserts reference data (roles, permissions)
 * and demo people, so a rerun after a schema change does not require dropping
 * the database -- which matters because audit_log cannot be truncated by the
 * application anyway (ADR-04).
 *
 * These writes do NOT go through UnitOfWork and record no audit entries. That
 * is deliberate and narrow: seeding is a data-load activity performed outside
 * the application by an operator with database access, in the same category as
 * a migration, not a user action with an actor to attribute it to. Inventing an
 * actor for it would put a false name in a table that cannot be corrected.
 * Nothing in the running application may take this shortcut.
 *
 * People and units are fictional. They are shaped like a mid-size Indonesian
 * securities firm because a demo with "User One / Test Dept" makes the client
 * evaluate the fixture instead of the system.
 */
const prisma = new PrismaClient()

const ORG_UNITS = [
  ['DIR', 'Direksi', null],
  ['SKAI', 'Satuan Kerja Audit Internal', 'DIR'],
  ['KEP', 'Divisi Kepatuhan', 'DIR'],
  ['TI', 'Divisi Teknologi Informasi', 'DIR'],
  ['OPS', 'Divisi Operasional', 'DIR'],
  ['RTL', 'Divisi Ritel & Cabang', 'DIR'],
] as const

/**
 * Reporting lines, by employee number. Set in a second pass because a manager
 * must exist before anyone can point at them, and because RA-01 (atasan
 * langsung) is only meaningful with a real org chart -- without one every item
 * falls to the campaign's fallback reviewer and the assignment rule looks
 * broken when it is merely unfed.
 */
const REPORTS_TO: Record<string, string> = {
  'EMP-00142': 'EMP-00002', // Bayu Pratama      -> Direktur Utama
  'EMP-00187': 'EMP-00142', // Sari Dewi         -> Bayu Pratama
  'EMP-00093': 'EMP-00002', // Hendra Wijaya     -> Direktur Utama
  'EMP-00211': 'EMP-00056', // Rina Kusuma       -> Agus Santoso
  'EMP-00056': 'EMP-00002', // Agus Santoso      -> Direktur Utama
  'EMP-00174': 'EMP-00002', // Dewi Lestari      -> Direktur Utama
  'EMP-00238': 'EMP-00002', // Fajar Nugroho     -> Direktur Utama
  'EMP-00001': 'EMP-00056', // Administrator     -> Agus Santoso
}

const PEOPLE = [
  ['bayu.pratama', 'EMP-00142', 'Bayu Pratama', 'Kepala SKAI', 'SKAI', ['AUDIT_LEAD', 'EMPLOYEE']],
  ['sari.dewi', 'EMP-00187', 'Sari Dewi', 'Auditor Internal Senior', 'SKAI', ['AUDITOR_INT', 'EMPLOYEE']],
  ['hendra.wijaya', 'EMP-00093', 'Hendra Wijaya', 'Compliance Officer', 'KEP', ['COMPLIANCE', 'EMPLOYEE']],
  ['rina.kusuma', 'EMP-00211', 'Rina Kusuma', 'IT Security Officer', 'TI', ['SEC_OFFICER', 'EMPLOYEE']],
  ['agus.santoso', 'EMP-00056', 'Agus Santoso', 'Kepala Divisi TI', 'TI', ['APP_OWNER', 'LINE_MANAGER', 'EMPLOYEE']],
  ['dewi.lestari', 'EMP-00174', 'Dewi Lestari', 'Kepala Operasional', 'OPS', ['APP_OWNER', 'LINE_MANAGER', 'EMPLOYEE']],
  ['fajar.nugroho', 'EMP-00238', 'Fajar Nugroho', 'Kepala Cabang Jakarta', 'RTL', ['LINE_MANAGER', 'EMPLOYEE']],
  ['admin.sigap', 'EMP-00001', 'Administrator SIGAP', 'Administrator Sistem', 'TI', ['SYS_ADMIN']],
  ['direktur.utama', 'EMP-00002', 'Direktur Utama', 'Direktur Utama', 'DIR', ['EXECUTIVE', 'EMPLOYEE']],
] as const

async function main(): Promise<void> {
  const orgIds = new Map<string, string>()
  for (const [code, name, parent] of ORG_UNITS) {
    const existing = await prisma.organizationUnit.findUnique({ where: { code } })
    const id = existing?.id ?? randomUUID()
    await prisma.organizationUnit.upsert({
      where: { code },
      update: { name, parentId: parent ? orgIds.get(parent)! : null },
      create: { id, code, name, parentId: parent ? orgIds.get(parent)! : null },
    })
    orgIds.set(code, id)
  }

  const roleIds = new Map<string, string>()
  for (const [code, name] of ROLES) {
    const existing = await prisma.role.findUnique({ where: { code } })
    const id = existing?.id ?? randomUUID()
    await prisma.role.upsert({ where: { code }, update: { name }, create: { id, code, name } })
    roleIds.set(code, id)
  }

  const permIds = new Map<string, string>()
  for (const [code, name, module] of PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { code } })
    const id = existing?.id ?? randomUUID()
    await prisma.permission.upsert({
      where: { code },
      update: { name, module },
      create: { id, code, name, module },
    })
    permIds.set(code, id)
  }

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds.get(roleCode)!
    // Rebuild rather than diff: the mapping is reference data, and a stale grant
    // left behind by a rename is a privilege nobody decided to give.
    await prisma.rolePermission.deleteMany({ where: { roleId } })
    for (const permCode of permCodes) {
      await prisma.rolePermission.create({
        data: { id: randomUUID(), roleId, permissionId: permIds.get(permCode)! },
      })
    }
  }

  const employeeIds = new Map<string, string>()
  const userIds = new Map<string, string>()

  for (const [username, empNumber, fullName, jobTitle, orgCode, roles] of PEOPLE) {
    const existingEmp = await prisma.employee.findUnique({ where: { employeeNumber: empNumber } })
    const employeeId = existingEmp?.id ?? randomUUID()
    await prisma.employee.upsert({
      where: { employeeNumber: empNumber },
      update: { fullName, jobTitle, orgUnitId: orgIds.get(orgCode)! },
      create: {
        id: employeeId,
        employeeNumber: empNumber,
        fullName,
        email: `${username}@trimegah.co.id`,
        jobTitle,
        orgUnitId: orgIds.get(orgCode)!,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2020-01-01'),
      },
    })

    const existingUser = await prisma.appUser.findUnique({ where: { externalId: username } })
    const userId = existingUser?.id ?? randomUUID()
    await prisma.appUser.upsert({
      where: { externalId: username },
      update: { isActive: true },
      create: { id: userId, employeeId, externalId: username, userType: 'INTERNAL' },
    })

    employeeIds.set(empNumber, employeeId)
    userIds.set(username, userId)

    await prisma.userRole.deleteMany({ where: { userId } })
    for (const roleCode of roles) {
      await prisma.userRole.create({
        data: {
          id: randomUUID(),
          userId,
          roleId: roleIds.get(roleCode)!,
          validFrom: new Date('2020-01-01'),
          // The key is omitted rather than set to undefined: an unscoped grant
          // and a grant scoped to nothing are different states (see
          // ScopeFilter.from), and exactOptionalPropertyTypes is right to
          // refuse to let one stand in for the other.
          ...(orgCode === 'DIR' ? {} : { scope: { org_units: [orgCode] } }),
        },
      })
    }
  }

  // Second pass: reporting lines, now that every manager exists.
  for (const [employeeNumber, managerNumber] of Object.entries(REPORTS_TO)) {
    const managerId = employeeIds.get(managerNumber)
    if (!managerId) continue
    await prisma.employee.update({ where: { employeeNumber }, data: { managerId } })
  }

  await seedModuleB({ prisma, orgIds, employeeIds, userIds })

  // Scoped to the demo campaign. A global count would drift upwards every time
  // the integration tests ran, and report a number that is not about the seed.
  const demoCampaign = await prisma.reviewCampaign.findUnique({ where: { code: 'UAR-2026-S2' } })
  const itemCount = demoCampaign
    ? await prisma.reviewItem.count({ where: { campaignId: demoCampaign.id } })
    : 0

  console.log(
    `Benih siap: ${ORG_UNITS.length} unit, ${ROLES.length} peran, ` +
      `${PERMISSIONS.length} hak, ${PEOPLE.length} pengguna, ` +
      `${itemCount} item review dalam kampanye UAR-2026-S2.`,
  )
  console.log(`Masuk dengan salah satu nama pengguna di atas, kata sandi: ${process.env.SEED_IDENTITY_PASSWORD ?? 'demo'}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
