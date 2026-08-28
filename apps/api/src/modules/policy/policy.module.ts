import { Module } from '@nestjs/common'
import { DocumentController } from './document.controller.js'
import { DocumentApprovalService } from './document-approval.service.js'
import { DocumentService } from './document.service.js'
import { DocumentSearchRepository } from './document-search.repository.js'
import { DocumentSearchService } from './document-search.service.js'

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
 *  - FR-C-022 · penautan dokumen ke kontrol Modul A.
 *
 * Menyusul: jawaban berbasis dokumen
 * beserta gerbang klasifikasi keluar (FR-C-013 s.d. FR-C-018 — seluruhnya lewat
 * LLM Gateway, ADR-03), dan kampanye attestation (FR-C-019 s.d. FR-C-021).
 *
 * Penyaringan hak akses ada di lapisan repositori, di dalam basis data
 * (`check_document_access`), bukan di controller — FR-C-010 aturan 1 melarang
 * dokumen terlarang muncul di hasil, di jumlah hasil, maupun di saran, dan satu
 * penyaring yang wajib di-join setiap kueri tidak bisa terlewat seperti
 * penyaring di lapisan controller.
 */
@Module({
  controllers: [DocumentController],
  providers: [
    DocumentService,
    DocumentApprovalService,
    DocumentSearchService,
    DocumentSearchRepository,
  ],
  exports: [],
})
export class PolicyModule {}
