# Backlog (di luar lingkup migrasi)

Ide yang muncul selama migrasi tetapi **tidak** dikerjakan sebelum cutover, kecuali disetujui pemilik produk.

| ID | Ide | Alasan ditunda | Sumber |
|---|---|---|---|
| BL-01 | Satukan `delete_requests` dan `unlock_requests` menjadi satu tabel `requests` dengan `type` dan cakupan jam yang jelas | Legacy masih membaca kedua tabel selama masa paralel | `docs/business-rules.md` BR-25 – BR-28 |
| BL-02 | Normalisasi kolom bulanan TK Panen (`tk_<bulan>`, `target_<bulan>`) menjadi tabel `kebun_tk_bulanan (kebun_id, bulan, tk_tersedia, target)` | Menghapus kebutuhan `ALTER TABLE` setiap bulan; legacy masih memakai kolom lebar | BR-33, `.agents/AGENTS.md` |
| BL-03 | Supabase Realtime untuk notifikasi dan dashboard, menggantikan polling | Polling 15–30 detik sudah cukup untuk paritas | `docs/risks.md` R-13 |
| BL-04 | Persetujuan sekali pakai atau berbatas waktu | Bergantung Q-BR-6 | BR-12 |
| BL-05 | Pensiunkan `Code.js`, `Migrasi.gs`, sekitar 100 skrip patch `.py`, `temp.jsx`, `scratch/` dari repo | Setelah cutover dan setelah secret dirotasi | `docs/risks.md` R-31 |
| BL-06 | Bucket Storage privat + *signed download URL* | Legacy masih memakai URL publik | `docs/risks.md` R-09 |
| BL-07 | Konstanta luasan Planted per region dari tabel pengaturan (saat ini diulang di 5 berkas) | Masuk Fase 2 sebagai tabel pengaturan; antarmuka admin untuk mengeditnya ada di backlog | BR-32 |
