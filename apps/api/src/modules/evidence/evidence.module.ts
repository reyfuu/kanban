import { Module } from '@nestjs/common'
import { ControlService } from './control.service.js'
import { EvidenceController } from './evidence.controller.js'
import { FrameworkService } from './framework.service.js'

/**
 * Modul A · Evidence Vault — manajemen bukti audit dan assessment.
 *
 * Requirements: FR-A-001 s.d. FR-A-003 terbangun ([docs/03-FRD.md]) —
 * pustaka kontrol, framework, dan pemetaan cakupan. Sisa Modul A (bukti,
 * versi bukti, penugasan, permintaan bukti, temuan, portal auditor eksternal)
 * menyusul; masing-masing membawa K-8 (integritas bukti) atau object-lock yang
 * pantas jadi perubahan tersendiri.
 *
 * Setiap tulis lewat UnitOfWork + jejak audit (aturan kode #2). Penyaringan
 * hak akses ada di lapisan servis.
 */
@Module({
  controllers: [EvidenceController],
  providers: [ControlService, FrameworkService],
  exports: [],
})
export class EvidenceModule {}
