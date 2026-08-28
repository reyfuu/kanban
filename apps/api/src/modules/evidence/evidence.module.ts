import { Module } from '@nestjs/common'
import { ControlService } from './control.service.js'
import { EngagementController } from './engagement.controller.js'
import { EngagementService } from './engagement.service.js'
import { EvidenceController } from './evidence.controller.js'
import { EvidenceItemController } from './evidence-item.controller.js'
import { EvidenceService } from './evidence-item.service.js'
import { ExternalAccessController } from './external-access.controller.js'
import { ExternalAccessService } from './external-access.service.js'
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
 *  - FR-A-010..014 · bukti sebagai entitas mandiri, versi + integritas (K-8),
 *    termasuk penggunaan ulang bukti + gerbang periode (FR-A-012).
 *  - FR-A-015 · retensi + penahanan hukum (legal hold) + antrean penghapusan.
 *  - FR-A-016..017 · temuan + tindak lanjut.
 *  - FR-A-018 · portal auditor eksternal + usulan permintaan bukti.
 *
 * Menyusul: object-lock penyimpanan yang membuat K-8 rule 3 bersifat fisik, dan
 * FR-A-008 (pengingat + eskalasi tenggat) yang menunggu mesin notifikasi
 * FR-X-010 — seluruh aturannya berupa "kirim notifikasi ke ...".
 *
 * Setiap tulis lewat UnitOfWork + jejak audit (aturan kode #2). Penyaringan
 * visibilitas penugasan (FR-A-004 aturan 3) ada di lapisan servis.
 */
@Module({
  controllers: [
    EvidenceController,
    EngagementController,
    EvidenceItemController,
    ExternalAccessController,
  ],
  providers: [
    ControlService,
    FrameworkService,
    EngagementService,
    RequestItemService,
    FindingService,
    EvidenceService,
    ExternalAccessService,
  ],
  exports: [],
})
export class EvidenceModule {}
