import { Module } from '@nestjs/common'
import { DocumentController } from './document.controller.js'
import { AttestationController } from './attestation.controller.js'
import { AttestationService } from './attestation.service.js'
import { DocumentApprovalService } from './document-approval.service.js'
import { DocumentService } from './document.service.js'
import { DocumentSearchRepository } from './document-search.repository.js'
import { DocumentSearchService } from './document-search.service.js'
import { DocumentAnswerService } from './document-answer.service.js'

/**
 * Modul C · Policy Hub — SOP dan kebijakan internal.
 *
 * Terbangun ([docs/03-FRD.md]):
 *  - FR-C-001/002 · jenis dokumen, hierarki normatif, taksonomi bidang proses.
 *  - FR-C-003/004 · pembuatan dan siklus hidup Draf → Berlaku → Digantikan/Ditarik.
 *  - FR-C-006/007 · versi mayor.minor dan jendela berlaku, termasuk pertanyaan
 *    "versi mana yang berlaku pada tanggal tertentu" untuk audit periode lampau.
 *  - FR-C-008 · siklus tinjauan berkala; dokumen terlambat ditinjau TETAP berlaku.
 *  - FR-C-009 s.d. FR-C-012 · pencarian hibrida, penyaringan hak akses sebelum
 *    pemeringkatan, penyaring + jumlah hasil, dan perilaku saat hasil kosong.
 *  - FR-C-005 · alur telaah & pengesahan berjenjang yang dapat dikonfigurasi,
 *    dengan autentikasi ulang (FR-X-003) dan pengalihan ke delegasi/atasan.
 *  - FR-C-019 s.d. FR-C-021 · kampanye attestation, pencatatan pernyataan
 *    beserta buktinya, pemantauan penyelesaian, dan laporan yang menjadi bukti
 *    Modul A (FR-A-014 aturan 2).
 *  - FR-C-022 · penautan dokumen ke kontrol Modul A.
 *
 *  - FR-C-013 · jawaban berbasis dokumen, dengan rujukan wajib. Seluruh
 *    kontrolnya (pemutus, gerbang klasifikasi, redaksi, pencatatan) ada di
 *    LLM Gateway pada modul shared, bukan di sini — ADR-03 mensyaratkan satu
 *    jalur keluar, dan gerbang yang dititipkan ke pemanggilnya bukan gerbang.
 *
 * Penyaringan hak akses ada di lapisan repositori, di dalam basis data
 * (`check_document_access`), bukan di controller — FR-C-010 aturan 1 melarang
 * dokumen terlarang muncul di hasil, di jumlah hasil, maupun di saran, dan satu
 * penyaring yang wajib di-join setiap kueri tidak bisa terlewat seperti
 * penyaring di lapisan controller.
 */
@Module({
  controllers: [DocumentController, AttestationController],
  providers: [
    AttestationService,
    DocumentService,
    DocumentApprovalService,
    DocumentSearchService,
    DocumentSearchRepository,
    DocumentAnswerService,
  ],
  exports: [],
})
export class PolicyModule {}
