import { Module } from '@nestjs/common'
import { AnomalyController } from './anomaly.controller.js'
import { AnomalyService } from './anomaly.service.js'
import { CampaignController } from './campaign.controller.js'
import { CampaignBuilderService } from './campaign-builder.service.js'
import { CampaignService } from './campaign.service.js'
import { DetectionService } from './detection.service.js'
import { EvidencePackageService } from './evidence-package.service.js'
import { ReviewDecisionService } from './review-decision.service.js'
import { ReviewItemController } from './review-item.controller.js'
import { ReviewItemRepository } from './review-item.repository.js'
import { ReviewerResolver } from './reviewer-resolver.js'
import { RevocationService } from './revocation.service.js'
import { SnapshotController } from './snapshot.controller.js'
import { SnapshotService } from './snapshot.service.js'
import { SnapshotStagingStore } from './snapshot-staging.store.js'
import { SnapshotUploadService } from './snapshot-upload.service.js'
import { SodService } from './sod.service.js'

/**
 * Modul B · Access Review — review hak akses lintas aplikasi.
 *
 * Requirements: FR-B-004 s.d. FR-B-025 ([docs/03-FRD.md]).
 * Kontrol kritis: K-1 (RevocationService), K-2/K-3/K-4 (ReviewDecisionService
 * + review-rules.ts), K-9 (CampaignService).
 *
 * Penyaringan hak akses tingkat baris ada di ReviewItemRepository dan pada
 * pemakaian `applicationScope` di dalam servis — aturan kode #1, bukan di
 * controller.
 *
 * Pengambilan data akses lewat unggahan bertemplat (FR-B-004..006). Deteksi
 * anomali dan SoD (FR-B-007, FR-B-024/025) berjalan saat snapshot baru mendarat
 * (DetectionService). Paket bukti kampanye + penautan otomatis ke Modul A
 * (FR-B-022/023) di EvidencePackageService. Belum dibangun: konektor otomatis
 * (FR-B-003).
 */
@Module({
  controllers: [ReviewItemController, CampaignController, SnapshotController, AnomalyController],
  providers: [
    ReviewItemRepository,
    ReviewDecisionService,
    CampaignService,
    CampaignBuilderService,
    ReviewerResolver,
    RevocationService,
    SnapshotUploadService,
    SnapshotService,
    SnapshotStagingStore,
    DetectionService,
    AnomalyService,
    SodService,
    EvidencePackageService,
  ],
  exports: [RevocationService],
})
export class AccessModule {}
