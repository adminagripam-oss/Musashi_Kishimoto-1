# Hasil audit database (Fase 0, tugas 6)

Query ada di [`docs/db-audit.sql`](../db-audit.sql). Semuanya SELECT, dan kolom `regions.password_hash` serta `sesi_aktif.token` tidak pernah dibaca.

## Cara menjalankan dan menyimpan

1. Salin seluruh isi `docs/db-audit.sql` ke Supabase SQL Editor, lalu tekan **Run** sekali.
2. Hasilnya satu baris per blok, dengan kolom `block`, `row_count`, dan `result` (isi blok dalam bentuk JSON).
3. Pilih **Copy as JSON**, lalu simpan sebagai `docs/db-audit-results/audit-<production|staging>-<YYYY-MM-DD>.json`, atau tempel di chat.
4. Jalankan di produksi dan di staging. Blok A (skema) dari keduanya harus sama; ini syarat DoD Fase 0 "skema staging cocok dengan produksi".

Hasil memuat data bisnis, misalnya nama region, tonase pada baris duplikat, dan jumlah surat. Hasil hanya di-commit bila repo GitHub privat, sama dengan aturan golden snapshot di `docs/golden-tests.md`.

## Run 1 — 2026-10-26

- **Oleh:** pemilik produk, lewat Supabase SQL Editor.
- **Project:** TIDAK DIKETAHUI (produksi atau staging). Data terbaru bertanggal 2026-10-24, jadi kemungkinan produksi atau salinan yang baru dibuat.
- **Versi query:** multi-statement (commit `fad7910`). Seluruh berkas dijalankan sekaligus, sedangkan editor hanya menampilkan hasil statement terakhir, yaitu blok E4. Karena itu `docs/db-audit.sql` diubah menjadi satu query.

### Hasil E4

| Tabel | Baris | Kunci pertama | Kunci terakhir |
|---|---|---|---|
| `target_challenge_bulanan` | 3 | 2026-07 | 2026-09 |
| `laporan_realisasi_panen` | 91 | 2026-07-18 | 2026-10-24 |

Artinya:
- **Target Challenge:** `bulan` adalah kunci upsert (`api/targetChallenge.js:54`), jadi satu baris mewakili satu bulan. Target tersedia untuk Juli, Agustus, dan September 2026, tetapi **belum ada untuk Oktober 2026**. Selama belum ada, `getTarget` untuk bulan Oktober membalas `exists: false` (`api/targetChallenge.js:31-35`). Pertanyaannya dicatat sebagai Q-BR-10 di `docs/business-rules.md`.
- **LHP:** `tanggal` adalah kunci upsert (`api/laporanRealisasi.js:54`), jadi satu baris mewakili satu tanggal. Rentang 18 Juli s.d. 24 Oktober 2026 mencakup 99 hari, sehingga **8 tanggal tidak punya LHP**. Blok E5 menunjukkan tanggal tanpa LHP dalam 45 hari terakhir.

### Yang terbukti dari run ini

SQL Editor mengirim seluruh skrip sebagai satu batch, dan PostgreSQL menghentikan batch pada error pertama. Karena hasil E4 muncul, semua query sebelumnya berjalan tanpa error. Artinya objek berikut ada di database:
- tabel `regions`, `sesi_aktif`, `database_input`, `data_estimasi`, `database_palmops`, `delete_requests`, `unlock_requests`, `data_kebun_tk`, `surat`, `target_challenge_bulanan`, `laporan_realisasi_panen`, serta `storage.buckets`;
- fungsi `public.check_password(text, text)` dengan signature persis itu;
- semua kolom yang dirujuk audit, misalnya `unlock_requests.requested_at`, `delete_requests.resolved_by`, dan `data_kebun_tk.tk_september`.

Tabel `unlock_requests`, `target_challenge_bulanan`, dan `laporan_realisasi_panen` ada di database, tetapi tidak didefinisikan di berkas SQL mana pun di repo (R-14b). Karena itu dump skema ke `supabase/legacy_schema.sql` tetap wajib.

## Perubahan query setelah run 1

- **Seluruh berkas:** menjadi satu SELECT; query di dalam tiap blok tetap bisa dijalankan sendiri.
- **A5:** ditambah `owner`, `config` (misalnya `search_path`), dan `acl` untuk melihat grant ke PUBLIC.
- **A6:** `public` dihapus dari daftar role. PUBLIC bukan baris di `pg_roles`, jadi grant-nya kini dibaca dari `acl` di A5.
- **A7:** ditambah hak `anon` dan `authenticated` per tabel dan view. Tabel tanpa RLS yang memberi hak ke `anon` bisa dipakai oleh siapa pun yang memegang anon key.
- **Blok baru:** A10 (view beserta definisinya), A11 (extension), dan E5 (cakupan harian 45 hari terakhir, untuk memilih `SNAPSHOT_DATES` di tugas 7).
- **Pengujian:** dijalankan di PostgreSQL in-process (PGlite) dengan tabel tiruan berbentuk skema legacy.
  - Versi lama berjalan tanpa error pada tabel tiruan, sama seperti di database asli. Ini menunjukkan bentuk tabel tiruannya sesuai.
  - Versi baru menghasilkan 28 blok dalam urutan yang benar, dengan nilai yang sesuai data uji.

## Run 2 — 2026-10-26

- **Oleh:** pemilik produk, lewat Supabase SQL Editor, memakai `db-audit.sql` satu-query.
- **Project:** TIDAK DIKETAHUI (produksi atau staging), kemungkinan produksi. Data hari berjalan (2026-10-26) ikut terbaca.
- **Diterima:** semua 28 blok. Paste pertama terpotong di blok A8 pada batas 50.000 karakter; hasil lengkap kemudian dikirim sebagai CSV.
- **Salinan mentah:** `audit-run2-2026-10-26.csv` di folder ini. Hanya lokal: `.gitignore` folder ini mengecualikan `*.csv` dan `*.json`.

Hasilnya ditulis ke [`../db-schema.md`](../db-schema.md). Ringkasan:
- **Skema:** 15 tabel, 10 di antaranya di luar PRD §5; tidak ada view; tidak ada `pg_cron`. `audit_log` (9.721 baris) adalah temuan baru.
- **Terkonfirmasi:**
  - R-06: `rate_limit` kosong;
  - R-08: `anon`/`authenticated` dapat EXECUTE `check_password`;
  - R-09: `data_kebun_tk` terbuka, kedua bucket publik, siapa pun bisa unggah ke dan melihat daftar `surat_files`.
- **Akun:** `QC admin` dan `Sumatera Utara 2 Ex Torganda` tidak ada di `regions`, jadi hanya bisa login lewat fallback plaintext.
- **Data bersih**, kecuali 6 grup realisasi ganda (Sumut 2, 2026-10-01, nilainya identik). Tidak ada `jam` di luar 12 slot legacy.
- **R-19 dinilai ulang:** tidak ada permohonan PENDING, dan tidak ada kembaran yang statusnya berbeda. 30 baris D4 berasal dari aturan sebelum 2026-07-24.
- **Modul:** `Papua Selatan` muncul di data kebun (Q-BR-11). SAP hanya berisi 2 surat. Baseline TK: 754 kebun, 443.362,62 ha.

### Berikutnya

Jalankan file yang sama di **staging** setelah project-nya dibuat. Blok A dari kedua hasil harus sama (DoD Fase 0).
