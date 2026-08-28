import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROLE_PERMISSIONS } from '../../../packages/db/seed/catalogue.js'

/**
 * FRD Sec 6 · a role that the matrix grants access must hold a permission.
 *
 * Written after EVIDENCE_PIC shipped with an empty permission list. The role
 * existed, the matrix gave it BT(t) over permintaan bukti and bukti, and the
 * seed granted it nothing -- so the one account whose entire purpose is to
 * supply evidence could not register a single piece of it. Nothing failed:
 * unit tests never load the seed catalogue, and the integration tests build
 * their own principals with whatever permissions the case needs, which is
 * exactly how a role can be empty in production and green in CI.
 *
 * This parses the matrix rather than restating it. A second hand-written copy
 * would only prove the two copies I typed agree with each other; parsing proves
 * the code agrees with the document, which is what CLAUDE.md asks for.
 *
 * Scope is deliberately narrow: it asserts that a role with any authority at
 * all over a module's objects holds at least one permission for that module.
 * It does not try to map each B/T/H/S letter onto a permission name, because
 * the letters describe row-level authority that the services enforce with
 * scoping, not something a permission string can express. Checking the coarse
 * property catches the failure that actually happened -- a silently empty role
 * -- without inventing a correspondence the design does not claim.
 */

const FRD = fileURLToPath(new URL('../../../docs/03-FRD.md', import.meta.url))

/** Columns of the matrix, in the order the FRD writes them. */
const ROLES = [
  'SYS_ADMIN', 'COMPLIANCE', 'AUDIT_LEAD', 'AUDITOR_INT', 'AUDITOR_EXT',
  'SEC_OFFICER', 'APP_OWNER', 'LINE_MANAGER', 'EVIDENCE_PIC', 'DOC_AUTHOR',
  'DOC_APPROVER', 'EXECUTIVE', 'EMPLOYEE',
] as const

/**
 * Object rows to the module whose permissions serve them.
 *
 * Rows absent from this map are ones no permission gates on its own -- the
 * organisation chart, the audit log, system configuration -- and asserting
 * about them would test the map, not the system.
 */
const ROW_MODULE: Record<string, 'A' | 'B' | 'C'> = {
  'Kontrol & framework': 'A',
  'Penugasan': 'A',
  'Permintaan bukti': 'A',
  'Bukti': 'A',
  'Temuan': 'A',
  'Registri aplikasi': 'B',
  'Snapshot': 'B',
  'Kampanye': 'B',
  'Item & keputusan review': 'B',
  'Tiket pencabutan': 'B',
  'Aturan SoD': 'B',
  'Dokumen (draf)': 'C',
  'Dokumen (berlaku)': 'C',
  'Pengesahan dokumen': 'C',
  'Kampanye attestation': 'C',
}

const MODULE_PERMISSIONS: Record<'A' | 'B' | 'C', readonly string[]> = {
  A: ['control:read', 'control:write', 'evidence:read', 'evidence:write'],
  B: [
    'campaign:read', 'campaign:write', 'campaign:signoff', 'review:read',
    'review:decide', 'application:read', 'application:write', 'snapshot:upload',
    'ticket:read', 'ticket:execute',
  ],
  C: ['document:read', 'document:write', 'document:approve', 'attestation:manage'],
}

interface Grant {
  row: string
  role: string
  module: 'A' | 'B' | 'C'
}

function parseMatrix(): Grant[] {
  const grants: Grant[] = []
  let inMatrix = false
  for (const line of readFileSync(FRD, 'utf8').split('\n')) {
    if (line.startsWith('## 6. Matriks Hak Akses')) { inMatrix = true; continue }
    if (inMatrix && line.startsWith('## ')) break
    if (!inMatrix || !line.trim().startsWith('|')) continue

    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    const row = cells[0]?.replace(/\*\*/g, '')
    if (!row) continue
    const module = ROW_MODULE[row]
    if (!module || cells.length < ROLES.length + 1) continue

    ROLES.forEach((role, i) => {
      const cell = cells[i + 1]
      // "—" is no access. Everything else (B, BT, BTS, B(t), ...) is some.
      if (cell && cell !== '—' && cell !== '-') grants.push({ row, role, module })
    })
  }
  return grants
}

const grants = parseMatrix()

/**
 * AUDITOR_EXT holds no permission on purpose (FR-X-004 rule 3). Its portal
 * endpoints authorise on the role plus a live per-engagement grant, both
 * checked in the service, precisely so that an outsider never carries an
 * internal permission that could be honoured somewhere else by accident.
 * Excluded by name rather than by an empty-list shortcut, so that a role going
 * empty by mistake still fails.
 */
const EXEMPT = new Set(['AUDITOR_EXT'])

/**
 * Every internal account also holds EMPLOYEE (FR-X-001 rule 2), so a row the
 * matrix grants to, say, LINE_MANAGER over "Dokumen (berlaku)" is served by the
 * document:read that EMPLOYEE carries. Comparing the named role in isolation
 * would report failures for access that genuinely works.
 */
function effectivePermissions(role: string): readonly string[] {
  const own = ROLE_PERMISSIONS[role] ?? []
  if (role === 'SYS_ADMIN' || role === 'AUDITOR_EXT') return own
  return [...own, ...(ROLE_PERMISSIONS.EMPLOYEE ?? [])]
}

describe('FRD Sec 6 · setiap peran yang diberi wewenang punya izin', () => {
  it('matriksnya benar-benar terbaca', () => {
    // Tanpa penjaga ini, perubahan format tabel membuat parser mengembalikan
    // nol baris dan seluruh tes di bawah lulus tanpa memeriksa apa pun --
    // kegagalan yang sama sifatnya dengan bug yang melahirkan berkas ini.
    expect(grants.length).toBeGreaterThan(40)
    expect(new Set(grants.map((g) => g.row)).size).toBe(Object.keys(ROW_MODULE).length)
  })

  it('tidak ada peran berwenang yang daftar izinnya kosong', () => {
    const empty = [...new Set(grants.map((g) => g.role))]
      .filter((role) => !EXEMPT.has(role))
      .filter((role) => (ROLE_PERMISSIONS[role] ?? []).length === 0)
    expect(empty, `peran ini diberi wewenang oleh FRD tetapi tanpa satu pun izin: ${empty.join(', ')}`)
      .toEqual([])
  })

  it('setiap peran memegang izin untuk modul yang diberikan kepadanya', () => {
    const missing: string[] = []
    for (const { row, role, module } of grants) {
      if (EXEMPT.has(role)) continue
      const held = effectivePermissions(role)
      if (!MODULE_PERMISSIONS[module].some((p) => held.includes(p))) {
        missing.push(`${role} diberi wewenang atas "${row}" (Modul ${module}) tanpa izin Modul ${module}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })

  it('EVIDENCE_PIC dapat menangani bukti tetapi bukan pustaka kontrol', () => {
    // Regresi yang eksplisit: keduanya sempat menyatu pada control:*, dan
    // memilih salah satunya berarti mengunci PIC dari tugasnya atau memberi
    // setiap PIC wewenang menyunting pustaka kontrol.
    const pic = ROLE_PERMISSIONS.EVIDENCE_PIC ?? []
    expect(pic).toContain('evidence:read')
    expect(pic).toContain('evidence:write')
    expect(pic).not.toContain('control:read')
    expect(pic).not.toContain('control:write')
  })

  it('SYS_ADMIN tidak memegang satu pun izin keputusan', () => {
    // FRD Sec 1.4 menyatakannya eksplisit. Diuji di sini karena inilah tempat
    // pemisahan wewenang teknis dan wewenang memutuskan benar-benar ditegakkan.
    const admin = ROLE_PERMISSIONS.SYS_ADMIN ?? []
    for (const decisive of ['campaign:signoff', 'review:decide', 'document:approve', 'evidence:write']) {
      expect(admin, `SYS_ADMIN tidak boleh memegang ${decisive}`).not.toContain(decisive)
    }
  })
})
