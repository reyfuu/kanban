/**
 * Role and permission catalogue -- docs/03-FRD.md Sec 1.4.
 *
 * Reference data, not demo data: these codes are referenced by name throughout
 * the FRD and by the SoD rules in FR-X-006, so they belong to the system rather
 * than to any particular dataset. Demo people and demo grants live in seed.ts.
 */

export const ROLES = [
  ['SYS_ADMIN', 'Administrator Sistem'],
  ['COMPLIANCE', 'Compliance Officer'],
  ['AUDITOR_INT', 'Auditor Internal'],
  ['AUDIT_LEAD', 'Kepala SKAI'],
  ['AUDITOR_EXT', 'Auditor Eksternal'],
  ['SEC_OFFICER', 'IT Security Officer'],
  ['APP_OWNER', 'Pemilik Aplikasi'],
  ['LINE_MANAGER', 'Manajer Lini'],
  ['EVIDENCE_PIC', 'PIC Bukti'],
  ['DOC_AUTHOR', 'Penyusun Dokumen'],
  ['DOC_APPROVER', 'Pengesah Dokumen'],
  ['EXECUTIVE', 'Eksekutif'],
  ['EMPLOYEE', 'Karyawan'],
] as const

/** `resource:action`, per the `GET /auth/me` example in 07-API-CONTRACT Sec 2.4. */
export const PERMISSIONS = [
  ['campaign:read', 'Melihat kampanye review', 'B'],
  ['campaign:write', 'Menyusun dan menjalankan kampanye', 'B'],
  ['campaign:signoff', 'Menandatangani hasil kampanye', 'B'],
  ['review:read', 'Melihat item review', 'B'],
  ['review:decide', 'Memutuskan item review', 'B'],
  ['application:read', 'Melihat registri aplikasi', 'B'],
  ['application:write', 'Mengelola registri aplikasi', 'B'],
  ['snapshot:upload', 'Mengunggah data akses', 'B'],
  ['ticket:read', 'Melihat tiket pencabutan', 'B'],
  ['ticket:execute', 'Menandai tiket telah dilaksanakan', 'B'],
  ['audit-log:verify', 'Memverifikasi integritas jejak audit', 'X'],
  ['user:read', 'Melihat pengguna dan peran', 'X'],
  ['user:write', 'Mengelola pengguna dan peran', 'X'],
  ['dashboard:executive', 'Melihat dasbor eksekutif', 'X'],
  ['control:read', 'Melihat pustaka kontrol dan framework', 'A'],
  ['control:write', 'Mengelola kontrol, framework, dan pemetaan', 'A'],
  // Separate from control:* because FRD Sec 6 gives EVIDENCE_PIC BT(t) over
  // evidence and request items while giving it no access at all to the control
  // library. Folding the two together forced a choice between locking the PIC
  // out of the one job the role exists for, or handing every PIC the authority
  // to edit the control library -- and the first of those is what shipped.
  ['evidence:read', 'Melihat bukti dan permintaan bukti', 'A'],
  ['evidence:write', 'Mendaftarkan bukti dan menautkannya ke permintaan', 'A'],
  ['document:read', 'Mencari dan membaca dokumen normatif', 'C'],
  ['document:write', 'Menyusun dan merevisi dokumen', 'C'],
  ['document:approve', 'Mengesahkan dan memberlakukan dokumen', 'C'],
  ['attestation:manage', 'Mengelola kampanye attestation kebijakan', 'C'],
] as const

/**
 * Role to permission mapping, from the authority summaries in FRD Sec 1.4.
 *
 * SYS_ADMIN deliberately holds no decision permission -- the FRD is explicit
 * that it cannot approve evidence, sign off reviews or ratify documents. It
 * administers the system; it does not get to decide outcomes within it.
 *
 * ticket:execute is separate from campaign:signoff for the same reason: whoever
 * carries out a revocation is not who confirms it happened. Verification is
 * done by the system against a fresh snapshot (FR-B-020, K-1), never by a
 * person clicking a button.
 */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SYS_ADMIN: ['application:read', 'application:write', 'user:read', 'user:write'],
  COMPLIANCE: ['campaign:read', 'review:read', 'audit-log:verify', 'user:read', 'application:read', 'control:read', 'control:write', 'evidence:read', 'document:read', 'document:approve', 'attestation:manage'],
  SEC_OFFICER: [
    'campaign:read',
    'campaign:write',
    'application:read',
    'application:write',
    'snapshot:upload',
    'ticket:read',
    'ticket:execute',
    'review:read',
    // FRD Sec 6 · B over "Kontrol & framework", B(t) over "Bukti" and
    // "Temuan". Read only: the security officer must be able to see which
    // control a review serves and what was found, without being able to author
    // controls or accept evidence against them.
    'control:read',
    'evidence:read',
  ],
  // APP_OWNER and LINE_MANAGER both hold B(t) over "Temuan", and APP_OWNER
  // additionally B(t) over "Bukti" -- findings against their own application or
  // their own unit. Scoping decides which rows; the permission only admits them
  // to the module.
  APP_OWNER: ['campaign:read', 'review:read', 'review:decide', 'campaign:signoff', 'application:read', 'ticket:read', 'evidence:read'],
  LINE_MANAGER: ['campaign:read', 'review:read', 'review:decide', 'evidence:read'],
  AUDIT_LEAD: ['campaign:read', 'review:read', 'audit-log:verify', 'control:read', 'control:write', 'evidence:read', 'evidence:write', 'document:read', 'document:approve', 'attestation:manage'],
  AUDITOR_INT: ['campaign:read', 'review:read', 'control:read', 'control:write', 'evidence:read', 'evidence:write', 'document:read'],
  EXECUTIVE: ['dashboard:executive', 'campaign:read', 'control:read', 'evidence:read', 'document:read'],
  // FR-C-010: every internal employee may SEARCH; which documents they
  // actually see is decided per row by check_document_access, not by this
  // permission. Granting document:read broadly is therefore safe, and
  // withholding it would only stop people finding the Publik/Internal SOPs
  // they are meant to follow.
  EMPLOYEE: ['document:read'],
  AUDITOR_EXT: [],
  // FRD Sec 6 · BT(t) over permintaan bukti and bukti, and nothing over the
  // control library. Row-level scoping still decides which evidence this PIC
  // may touch; the permission only says the role is in the business of
  // handling evidence at all.
  EVIDENCE_PIC: ['evidence:read', 'evidence:write'],
  DOC_AUTHOR: ['document:read', 'document:write'],
  // DOC_APPROVER ratifies but does not author: the same separation as
  // ticket:execute vs campaign:signoff in Modul B. Whoever writes a procedure
  // is not who declares it binding.
  DOC_APPROVER: ['document:read', 'document:approve'],
}
