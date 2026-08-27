import { Module } from '@nestjs/common'

/**
 * Cross-cutting foundation — FR-X-001 s.d. FR-X-018.
 *
 * Planned submodules, in the order the specification forces:
 *
 *   audit/     FR-X-008, FR-X-009 · ADR-04 · kontrol kritis K-7
 *              MUST land before any write path in any module. FR-X-008
 *              Validasi: "Bila penulisan jejak audit gagal, transaksi bisnis
 *              HARUS dibatalkan. Tidak ada aksi tanpa jejak." A write path
 *              built before the audit primitive exists violates this by
 *              construction, so ordering here is not a preference.
 *
 *   identity/  FR-X-001..004 · ADR-06
 *              LDAPS to Active Directory behind the neutral `IdentityProvider`
 *              interface. No service calls LDAP directly.
 *
 *   authz/     FR-X-005..007
 *              Role model with data scoping. Aturan kode #1: scope filtering
 *              lives in the repository layer, never the controller — a
 *              controller-level filter is skipped by every other call path.
 *
 *   notification/ FR-X-010, FR-X-011 · antrean `notification`
 *   files/        FR-X-013, FR-X-014 · antrean `file-scan`
 *   masterdata/   FR-X-017, FR-X-018
 *
 * None of these are implemented yet. This module exists so the boundary and
 * the import graph are correct from the first commit rather than retrofitted.
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class SharedModule {}
