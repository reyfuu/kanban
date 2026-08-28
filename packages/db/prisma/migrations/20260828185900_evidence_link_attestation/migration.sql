-- ============================================================================
-- SIGAP -- satu nilai enum baru: evidence_link_target = ATTESTATION_CAMPAIGN.
--
-- Source of truth: docs/03-FRD.md FR-A-014 aturan 2, FR-C-021 aturan 2 --
-- laporan penyelesaian attestation dapat dijadikan bukti Modul A, dan bukti itu
-- menunjuk balik ke kampanye asalnya.
--
-- SENDIRIAN DI SATU MIGRASI, dan itu disengaja. PostgreSQL tidak mengizinkan
-- nilai enum yang baru ditambahkan dipakai pada transaksi yang sama. Prisma
-- menjalankan tiap berkas migrasi dalam satu transaksi, jadi menaruh ADD VALUE
-- bersama tabel yang memakainya akan gagal pada penerapan pertama di basis data
-- kosong -- kegagalan yang hanya muncul saat deploy bersih, bukan saat
-- pengembangan inkremental.
--
-- APPLICATION-VERSION SAFETY: aditif murni. Menambah nilai enum tidak dapat
-- membuat baris yang sudah ada menjadi tidak sah.
-- ============================================================================

ALTER TYPE evidence_link_target ADD VALUE IF NOT EXISTS 'ATTESTATION_CAMPAIGN';
