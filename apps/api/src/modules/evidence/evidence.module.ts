import { Module } from '@nestjs/common'
import { ControlService } from './control.service.js'
import { EngagementController } from './engagement.controller.js'
import { EngagementService } from './engagement.service.js'
import { EvidenceController } from './evidence.controller.js'
import { EvidenceItemController } from './evidence-item.controller.js'
import { EvidenceService } from './evidence-item.service.js'
import { FindingService } from './finding.service.js'
import { FrameworkService } from './framework.service.js'
import { RequestItemService } from './request-item.service.js'

/**
 * Modul A · Evidence Vault — manajemen bukti audit dan assessment.
 *
 * Terbangun ([docs/03-FRD.md]):
 *  - FR-A-001..003 · pustaka kontrol, framework, pemetaan cakupan.
 *  - FR-A-004..005 · penugasan + siklus hidup.
 *  - FR-A-006..009 · permintaan bukti (PBC) + daftar tugas PIC.
 *  - FR-A-010..014 · bukti sebagai entitas mandiri, versi + integritas (K-8).
 *  - FR-A-016..017 · temuan + tindak lanjut.
 *
 * Menyusul: retensi/penahanan hukum penuh (FR-A-015), portal auditor eksternal
 * (FR-A-018), dan object-lock penyimpanan yang membuat K-8 rule 3 bersifat
 * fisik.
 *
 * Setiap tulis lewat UnitOfWork + jejak audit (aturan kode #2). Penyaringan
 * visibilitas penugasan (FR-A-004 aturan 3) ada di lapisan servis.
 */
@Module({
  controllers: [EvidenceController, EngagementController, EvidenceItemController],
  providers: [
    ControlService,
    FrameworkService,
    EngagementService,
    RequestItemService,
    FindingService,
    EvidenceService,
  ],
  exports: [],
})
export class EvidenceModule {}
