import { Module } from '@nestjs/common'
import { CampaignController } from './campaign.controller.js'
import { CampaignBuilderService } from './campaign-builder.service.js'
import { CampaignService } from './campaign.service.js'
import { ReviewDecisionService } from './review-decision.service.js'
import { ReviewItemController } from './review-item.controller.js'
import { ReviewItemRepository } from './review-item.repository.js'
import { ReviewerResolver } from './reviewer-resolver.js'
import { RevocationService } from './revocation.service.js'

/**
 * Modul B · Access Review — review hak akses lintas aplikasi.
 *
 * Requirements: FR-B-011 s.d. FR-B-021 ([docs/03-FRD.md]).
 * Kontrol kritis: K-1 (RevocationService), K-2/K-3/K-4 (ReviewDecisionService
 * + review-rules.ts), K-9 (CampaignService).
 *
 * Penyaringan hak akses tingkat baris ada di ReviewItemRepository dan pada
 * pemakaian `applicationScope` di dalam servis — aturan kode #1, bukan di
 * controller.
 *
 * Belum dibangun: konektor & snapshot (FR-B-003..006), deteksi anomali
 * (FR-B-007), paket bukti (FR-B-022..023).
 */
@Module({
  controllers: [ReviewItemController, CampaignController],
  providers: [
    ReviewItemRepository,
    ReviewDecisionService,
    CampaignService,
    CampaignBuilderService,
    ReviewerResolver,
    RevocationService,
  ],
  exports: [RevocationService],
})
export class AccessModule {}
