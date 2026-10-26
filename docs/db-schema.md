# Skema Database AGRI-PAM v1 (Fase 0, tugas 6)

**Sumber:**
- Hasil `docs/db-audit.sql` run 2 tanggal 2026-10-26, lengkap 28 blok. Ringkasan run ada di [`db-audit-results/README.md`](db-audit-results/README.md); salinan mentahnya disimpan lokal dan tidak di-commit.
- Project: kemungkinan produksi, karena data hari berjalan ikut terbaca. Konfirmasi pemilik masih ditunggu.

**Pembanding:** `prd.md` Bagian 5 dan spesifikasi Fase 2.

**Belum termasuk:**
- dump DDL lengkap `supabase/legacy_schema.sql`, yang tetap wajib sebagai baseline Fase 2;
- perbandingan dengan staging (DoD Fase 0).

`schema.sql` di repo **tidak** mewakili produksi (R-14b). Pegangan yang benar adalah dokumen ini.

## 1. Objek database

15 tabel di schema `public`. Tidak ada view (A10). Kolom "Baris" berasal dari `pg_stat_user_tables`, jadi angkanya perkiraan.

| Tabel | Baris | Di PRD §5? | Catatan |
|---|---|---|---|
| `regions` | 24 | Ya | Master akun + `password_hash`. Dua akun yang disebut kode tidak ada di sini (§6) |
| `database_input` | 20.249 | Ya | Realisasi per jam. **Tanpa unique (region, tanggal, jam)**, dan ada 6 grup duplikat (§7) |
| `data_estimasi` | 2.879 | Ya | Estimasi harian. Sudah unique (tanggal, region) |
| `sesi_aktif` | 18.600 | Ya | Audit sesi. **Tidak pernah dibersihkan** (§6) |
| `delete_requests` | 188 | Ya | Permohonan hapus/buka. Punya kolom `jam`; **tanpa CHECK `type`**. Semua sudah diputus (§8) |
| `unlock_requests` | 240 | **Tidak** | Sumber cek APPROVED realisasi & estimasi. Tanpa kolom `type`. Semua sudah diputus |
| `data_kebun_tk` | 754 | **Tidak** | TK Panen, 23 kunci region kebun. **Policy RLS terbuka** (§4, R-09) |
| `database_palmops` | 1.426 | **Tidak** | Input PalmOps admin. Unique (tanggal, region) |
| `laporan_realisasi_panen` | 91 | **Tidak** | LHP harian (JSON per tanggal) |
| `target_challenge_bulanan` | 3 | **Tidak** | Target per bulan (JSON), hanya Jul–Sep 2026 (Q-BR-10) |
| `surat` | 2 | **Tidak** | SAP Persuratan; nyaris tidak dipakai (§9) |
| `log_tracking` | 3 | **Tidak** | Riwayat status surat |
| `audit_log` | 9.721 | **Tidak** | **Temuan baru:** log audit yang diisi aplikasi |
| `rate_limit` | 0 | **Tidak** | Kosong, rate limit tidak pernah aktif (R-06) |
| `profiles` | 0 | **Tidak** | Kosong, sisa Supabase Auth yang tidak dipakai |

Sepuluh tabel ada di database tetapi tidak di PRD Bagian 5. Delapan aktif dipakai API; `rate_limit` dan `profiles` kosong dan mati.

**Extension (A11):**
- `pgcrypto` (schema `extensions`, dipakai `crypt()`), `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `plpgsql`;
- **tidak ada `pg_cron`**, jadi tidak ada pekerjaan terjadwal di database.

## 2. Kolom per tabel (A1)

Singkatan tipe: `int8` = bigint, `int4` = integer, `num` = numeric, `tstz` = timestamptz, `vc` = varchar, `bool` = boolean.

**`regions`**
- id int4 PK (seq);
- region_name vc UNIQUE NOT NULL;
- password_hash vc NOT NULL;
- is_active bool default true;
- created_at tstz default now().

**`database_input`**
- id int8 PK (seq);
- tanggal date NOT NULL;
- region vc NOT NULL;
- jam vc NOT NULL;
- tonase num NOT NULL default 0;
- created_at tstz default now().

**`data_estimasi`**
- id int8 PK (seq);
- waktu_input tstz NOT NULL default now();
- tanggal date NOT NULL;
- region vc NOT NULL;
- restan_lalu num default 0;
- luas_panen_ha num NOT NULL;
- tk_panen_hk num NOT NULL;
- estimasi_panen_kg num NOT NULL;
- output_panen num default 0;
- estimasi_kirim_kg num NOT NULL;
- estimasi_restan_kg num NOT NULL.

Catatan `data_estimasi`:
- Semua kolom yang dipakai `api/estimasi.js` ada.
- **Tidak ada `is_tidak_panen`**, dan nama kolomnya `tk_panen_hk`, bukan `tk_panen`.
- Jadi status toggle Restan memang tidak punya tempat simpan (BR-22 / Q-BR-4), dan `is_tidak_panen` di spesifikasi B11 benar-benar kolom baru.

**`sesi_aktif`**
- id int8 PK (seq);
- region vc NOT NULL;
- token text NOT NULL;
- login_time tstz NOT NULL default now();
- expiry tstz NOT NULL;
- status vc default 'Aktif', dengan CHECK Aktif/Logout/Expired;
- ip_address vc;
- created_at tstz default now().

**`delete_requests`**
- id int4 PK (seq);
- region vc NOT NULL;
- tanggal date NOT NULL;
- jam vc (nullable);
- type vc NOT NULL;
- status vc default 'PENDING';
- requested_at tstz default CURRENT_TIMESTAMP;
- resolved_at tstz;
- resolved_by vc.

Catatan `delete_requests`:
- Sudah ada `resolved_at`/`resolved_by`, tetapi **belum ada** `decided_by`/`decided_at` yang diminta spesifikasi Fase 2. Pilihannya memakai ulang kolom `resolved_*` atau menambah kolom baru; keputusannya dicatat di `decisions.md`.
- `requestRevision` mengisi `jam = null` (`api/unlockRequest.js:36`).

**`unlock_requests`**
- id int4 PK (seq);
- region text NOT NULL;
- tanggal date NOT NULL;
- status text default 'PENDING';
- requested_at tstz NOT NULL default now();
- resolved_at tstz;
- resolved_by text.

Catatan `unlock_requests`: **tidak ada kolom `type`**. Karena itu satu persetujuan membuka realisasi **dan** estimasi untuk (region, tanggal) itu (BR-12), dan panel admin tidak bisa membedakan jenisnya (§8).

**`data_kebun_tk`**
- id int4 PK, **tanpa default** (id diisi aplikasi);
- cro vc;
- region vc NOT NULL;
- region_raw vc;
- nama_kebun vc NOT NULL;
- name_tag vc;
- luasan num default 0;
- req_tk int4 default 0;
- tk_mei, tk_juni int4;
- target_juli, target_agustus, tk_juli, tk_agustus int4;
- updated_by vc default 'SYSTEM';
- updated_at, created_at tstz;
- target_september, tk_september, target_oktober int4.

Catatan `data_kebun_tk`:
- TK aktual tercatat sampai September, target sampai Oktober.
- Kolom `tk_juli`/`tk_agustus` **ada** (lihat §10, G2).
- Karena `id` tanpa sequence, `addKebun` menghitung id sendiri (BR-36), sehingga ada risiko bentrok id saat dua penambahan bersamaan.

**`database_palmops`**
- id int8 PK (seq);
- tanggal date NOT NULL;
- region vc NOT NULL;
- tonase num NOT NULL default 0;
- created_at tstz;
- unique (tanggal, region).

**`laporan_realisasi_panen`** — tanggal date **PK**, data jsonb NOT NULL, created_at tstz NOT NULL default utc now().

**`target_challenge_bulanan`** — bulan vc **PK**, data jsonb NOT NULL, created_at tstz NOT NULL default utc now().

**`surat`**
- id uuid PK;
- nomor_surat, jenis_surat, perihal text NOT NULL;
- status text default 'menunggu', dengan CHECK 12 nilai;
- file_url text NOT NULL;
- dibuat_oleh uuid FK → profiles;
- regional_pengirim, tujuan, catatan, link_redirect, asal_surat text;
- tanggal_surat date;
- created_at tstz.

**`log_tracking`**
- id uuid PK;
- surat_id uuid FK → surat (CASCADE);
- status_update text NOT NULL;
- catatan text;
- created_by uuid FK → profiles;
- created_at tstz.

**`audit_log`**
- id int8 PK (seq);
- region vc NOT NULL;
- action vc NOT NULL;
- detail text;
- created_at tstz;
- index pada `created_at` dan `region`.

**`rate_limit`**
- id int4 PK (seq);
- region vc UNIQUE NOT NULL;
- attempts int4 default 0;
- window_start, updated_at tstz.

**`profiles`**
- id uuid PK FK → auth.users (CASCADE);
- email text UNIQUE NOT NULL;
- nama_lengkap text NOT NULL;
- role `user_role` default 'regional';
- nama_regional text;
- created_at tstz.

## 3. Constraint (A2), index (A3), trigger (A4)

**Unique:**
- `regions.region_name`;
- `rate_limit.region`;
- `data_estimasi` (tanggal, region);
- `database_palmops` (tanggal, region).

**`database_input` tidak punya unique**, hanya PK (id):
- Aturan "satu jam satu baris, revisi lewat Hapus Jam Ini" (BR-15) hanya ditegakkan kode (`api/realisasi.js:180`).
- Pengecekan itu dilakukan per nama region, sehingga tidak menahan baris kembar yang tersimpan di bawah nama region lain (§7).

**CHECK:**
- `sesi_aktif.status` ∈ {Aktif, Logout, Expired};
- `surat.status` ∈ 12 nilai alur SAP;
- `delete_requests.type` **tidak punya CHECK**. Jadi `UNLOCK_REALISASI` sah di database, dan CHECK sempit di `schema.sql` tidak pernah berlaku di produksi (R-14b).

**FK:** keempatnya mengarah ke jalur Supabase Auth yang tidak dipakai, yaitu `profiles.id` → auth.users, `surat.dibuat_oleh` → profiles, `log_tracking.surat_id` → surat, dan `log_tracking.created_by` → profiles.

**Index:**
- tabel data punya index pada `region` dan `tanggal`;
- `database_input` juga punya index (tanggal, region);
- `unlock_requests` punya index (region, tanggal);
- `sesi_aktif` punya index pada `token` dan `status`;
- `delete_requests` hanya punya index PK.

**Trigger:** tidak ada di schema `public`. Kolom `updated_at` dan isi `audit_log` diisi aplikasi.

## 4. RLS, policy, storage (A7–A9)

Ke-15 tabel **mengaktifkan RLS**. Role `anon` dan `authenticated` punya semua hak tabel (bawaan Supabase), jadi policy yang menentukan akses. API memakai service role yang melewati RLS. Akibatnya policy di bawah hanya berpengaruh bagi yang memakai **anon key**, dan **tidak ada halaman legacy yang memakainya**: tidak ada `createClient`, panggilan REST, atau panggilan storage di berkas HTML mana pun.

| Kelompok | Tabel | Akses anon key |
|---|---|---|
| Policy `block_public` (`USING false`) | `audit_log`, `data_estimasi`, `database_input`, `database_palmops`, `rate_limit`, `regions`, `sesi_aktif` | Tertutup |
| RLS aktif tanpa policy (tolak semua) | `delete_requests`, `unlock_requests`, `target_challenge_bulanan`, `laporan_realisasi_panen` | Tertutup |
| Policy publik SELECT/INSERT/UPDATE (`USING true`) | `data_kebun_tk` | **Terbuka: baca, tambah, ubah** (R-09) |
| Policy berbasis `auth.uid()` | `surat` (4 policy), `log_tracking` (3), `profiles` (1) | Tertutup bagi anon; berlaku bagi pemilik akun Supabase Auth (R-33) |

**Storage:**
- Bucket `berkas_surat` dan `surat_files` sama-sama **publik**, tanpa batas ukuran dan tipe berkas (A9).
- Policy `storage.objects`:
  - "Allow Uploads" (INSERT, role public, bucket `surat_files`);
  - "Public Access" (SELECT, role public, bucket `surat_files`).
- Akibatnya **siapa pun bisa mengunggah berkas apa saja ke `surat_files` dan melihat daftar isinya.**
- Unggahan aplikasi sendiri lewat `api/sap.js` dengan service role. Tampilan berkas memakai URL publik (`getPublicUrl`), yang tidak membutuhkan policy SELECT.

## 5. Fungsi (A5, A6)

Ketiga fungsi bersifat **SECURITY DEFINER**, dimiliki `postgres`, dan **tanpa `search_path` tetap**. Masing-masing bisa dieksekusi PUBLIC, `anon`, `authenticated`, dan `service_role`.

| Fungsi | Status |
|---|---|
| `check_password(p_region text, p_password text)` | Bisa dipanggil lewat RPC dengan anon key, tanpa rate limit. **R-08 terkonfirmasi** (A6) |
| `cleanup_expired_sessions()` | Ada, tetapi tidak pernah terjadwal (tanpa `pg_cron`, B3) |
| `handle_new_user()` | Pemicu Supabase Auth; mati karena `profiles` kosong |

Penanganan:
- **G3 (usulan):** REVOKE EXECUTE dari PUBLIC/anon/authenticated. API tetap jalan karena `service_role` punya grant sendiri.
- **Fase 2:** set `search_path` tetap saat fungsi ditulis ulang. Untuk sekarang hal ini ditunda karena isi fungsi produksi belum terlihat (menunggu dump).

## 6. Akun dan sesi (B1–B3)

**Akun (B1, B2):**
- 24 dari 26 nama di `api/auth.js` `LOCAL_REGIONS_MAP` ada di `regions` dan semuanya aktif.
- Yang tidak ada: **`QC admin`** dan **`Sumatera Utara 2 Ex Torganda`**. Keduanya **hanya bisa login lewat fallback password plaintext** (`api/auth.js:80-90`, R-01).
- Tidak ada baris `regions` yang tidak dikenal kode (B2 = 0).
- Nama `Sumatera Utara 2 Ex Torganda` pernah dipakai untuk mengajukan permohonan pada 2026-07-21 (D4), tetapi tidak punya baris di tabel data mana pun (C4). Lihat Q-BR-8.
- **Akibat untuk G2 butir 5 (hapus fallback):** penghapusan baru aman setelah `QC admin` dimasukkan ke `regions` dengan hash password baru dan Q-BR-8 diputuskan. Kalau tidak, kedua akun terkunci.

**Sesi (B3):**

| Status | Sesi | Sudah lewat expiry |
|---|---|---|
| Aktif | 4.169 | 4.149 |
| Logout | 14.164 | 14.131 |
| Expired | 267 | 267 |

Hanya 20 sesi yang benar-benar aktif. Status tidak pernah diubah menjadi `Expired` karena pembersihan tidak berjalan. Ini tidak memperpanjang sesi, sebab JWT tetap kedaluwarsa setelah 8 jam, tetapi tabelnya terus membesar (R-34).

## 7. Kualitas data (C1–C4)

| Cek | Hasil |
|---|---|
| Duplikat `database_input` (region, tanggal, jam) | **6 grup** |
| Duplikat `data_estimasi` (region, tanggal) | 0 |
| `jam` bukan HH.MM / di luar 12 slot legacy | 0 / 0 dari 20.249 baris |
| Tonase < 0, > 5000, atau null | 0 |
| Region data yang tidak ada di `regions` | 0 (realisasi dan estimasi) |
| Nilai estimasi negatif | 0 |

- **Slot jam:** data produksi mengikuti persis 12 slot legacy (06.00–16.00 dan 17.30). Ini menegaskan bahwa slot 07.00–18.00 di spesifikasi salah (BR-07).
- **Duplikat (C2):** keenam grup milik **Sumut 2 pada 2026-10-01**, yaitu jam 08.00, 09.00, 10.00, 11.00, 13.00, dan 15.00. Tiap grup punya dua salinan dengan tonase **identik**.
  - Salinan pertama ber-ID 28781–28784, 28800, 28851, tersebar seperti input per jam biasa.
  - Salinan kedua ber-ID berurutan **28891–28896**, jadi disisipkan sekaligus.
  - Penyebab: **TIDAK DIKETAHUI**. Petunjuknya: commit `7271267` pada tanggal yang sama ("harmonize Sumut 2 region key"), dan akun `Sumatera Utara 2 Ex Torganda` yang hanya hidup lewat fallback. Untuk memastikan, perlu `created_at` keenam baris itu.
  - Dampak: total harian Sumut 2 pada 2026-10-01 mungkin terhitung dua kali (+129,29), tergantung cara penjumlahan. Hal ini dibuktikan lewat golden snapshot tanggal itu (R-32).
  - Rencana Fase 2: hapus ID 28891–28896 (nilainya identik, jadi tidak ada data yang hilang), lalu tambahkan unique (region, tanggal, jam). SQL-nya dilaporkan dulu sebelum dijalankan.
- **Ejaan region (C4):** 23 region regional konsisten di `database_input`, `data_estimasi`, dan `database_palmops`. `database_palmops` berisi tepat 62 baris per region.

## 8. Permohonan dan R-19 (D1–D4)

| Tabel | Jenis | APPROVED | REJECTED | PENDING |
|---|---|---|---|---|
| `delete_requests` | ESTIMASI | 37 | 1 | 0 |
| `delete_requests` | REALISASI | 59 | 4 | 0 |
| `delete_requests` | UNLOCK_REALISASI | 84 | 3 | 0 |
| `unlock_requests` | (tanpa jenis) | 230 | 10 | 0 |

- **D3 = 0:** tidak ada pasangan kembar (region, tanggal) yang statusnya berbeda di kedua tabel.
- **D4 = 30**, semuanya bertanggal 2026-07-20/21 dan diputus 21–22 Juli. Baris ini berasal dari masa commit `9e64ed4` (2026-07-21), ketika simpan realisasi masih memeriksa `delete_requests` UNLOCK_REALISASI. Sejak `ed5cd43` dan `2448ef4` (2026-07-24), pemeriksaannya membaca `unlock_requests` (`api/realisasi.js:132-137`).
  - Jadi ke-30 baris itu **bukan** revisi yang disetujui tetapi tetap terkunci menurut aturan yang berlaku saat itu.
  - Sesudah 2026-07-24 tidak ada baris D4.

**R-19, dinilai ulang dengan kode dan data:**
- **Mekanismenya terkonfirmasi di kode.** `requestRevision` menulis ke kedua tabel dengan `jam` kosong (`api/unlockRequest.js:36-43`).
- **Kembaran tersembunyi.** Panel admin men-dedupe dengan kunci `region_tanggal_jam` (`FORMAT_ESTIMASI_PANEN.html:1875`) dan mendahulukan `delete_requests`, sehingga kembaran di `unlock_requests` tidak tampil.
- **Persetujuan pertama tidak membuka simpan.** "Buka Real. Produksi" hanya mengubah `delete_requests` (`api/deleteRequest.js:74-78`). Simpan masih ditolak, padahal `checkRevisionStatus` sudah membalas APPROVED (`api/unlockRequest.js:72-82`).
- **Kembaran muncul lagi dengan label salah.** Setelah persetujuan pertama, kembaran tampil sebagai **"Buka Est. Panen"** karena `unlock_requests` tidak punya `type` (`FORMAT_ESTIMASI_PANEN.html:1859-1863`). Baru setelah item itu disetujui, simpan realisasi terbuka.
- **Data produksi:** tidak ada PENDING dan D3 = 0. Artinya admin selama ini menyetujui (atau menolak) kedua item, dan tidak ada revisi yang tertinggal terkunci.
- **Dampak tersisa:**
  - setiap revisi butuh dua persetujuan, dan item keduanya salah label;
  - ada jeda ketika regional melihat status APPROVED tetapi simpan ditolak;
  - selama kembaran masih PENDING, permohonan buka estimasi untuk tanggal yang sama ditolak (`api/unlockRequest.js:48-53`).
  - Karena itu R-19 diturunkan dari Tinggi menjadi **Sedang**.

## 9. Modul (E1–E5)

- **TK Panen (E1, E2):**
  - 754 kebun dengan total luasan **443.362,62 ha** dan id tertinggi 896. Angka ini menjadi baseline "tabel lama" untuk laporan migrasi data Fase 2.
  - Kunci region kebun berupa 23 nama pendek (`Aceh`, `Babel`, `Kaltara`, `Sumsel`, …), berbeda dari nama di `regions`. Karena itu perlu pemetaan `kebun_region_key` (B13).
  - `Kalbar 1` (62 kebun) menggabungkan Kalbar 1A dan 1B (BR-36).
  - **`Papua Selatan`**: 10 kebun dengan luasan 0 dan kebutuhan TK 0, tanpa akun dan tanpa data panen (Q-BR-11).
- **SAP (E3):** hanya ada 2 surat (dari `ADMIN` dan `CRO I`) dan 3 log. Modulnya aktif tetapi nyaris tidak dipakai.
- **Target Challenge dan LHP (E4):** target hanya untuk Jul–Sep 2026 (Q-BR-10). LHP ada untuk 91 tanggal antara 2026-07-18 dan 2026-10-24.
- **Cakupan 45 hari terakhir (E5):**
  - Hari kerja umumnya 20–23 dari 23 region mengisi realisasi, dan 23 region mengisi estimasi.
  - Hari Minggu lebih rendah: 13–17 region untuk realisasi.
  - LHP tidak ada untuk 2026-09-23, 2026-10-08, dan 2026-10-14. LHP 25 dan 26 Oktober juga belum dibuat.
  - Tanggal golden snapshot dipilih dari data ini (`docs/golden-tests.md`).

## 10. Konsekuensi untuk G2, G3, dan Fase 2

**G2 (hotfix kebunTK):**
- Kolom `tk_juli` dan `tk_agustus` ada, jadi jalur simpan-penuh `updateTK` cocok dengan skema produksi.
- G2 butir 5 tertahan oleh §6.
- R-09 (tabel terbuka untuk anon key) tidak ditutup oleh G2.

**G3 (usulan, `docs/g3-db-hardening.sql`):** menutup R-08, R-09 (tabel dan storage), serta R-33 tanpa mengubah perilaku aplikasi legacy.
- Diuji di PostgreSQL in-process dengan grant dan policy yang sama seperti produksi:
  - sebelum G3, anon bisa memanggil `check_password`, membaca/menulis `data_kebun_tk`, serta mengunggah ke dan melihat daftar `surat_files`;
  - sesudah G3, semuanya ditolak, sementara `service_role` (API) tetap punya semua hak yang dipakainya.
- **Belum dijalankan** di database mana pun. Perlu izin pemilik dan diuji di staging dulu.

**Fase 2, disusun berdasarkan skema nyata:**
- **Lewati** (sudah ada): unique `data_estimasi` (tanggal, region); index (region)/(tanggal); kolom `restan_lalu`.
- **Tambah:**
  - dedupe ID 28891–28896, lalu unique `database_input` (region, tanggal, jam);
  - CHECK tonase 0–5000 dan format jam (data sudah bersih);
  - kolom `data_estimasi.is_tidak_panen`;
  - kolom `regions.cro` dan `regions.timezone` (saat ini `cro` hanya ada di `data_kebun_tk`);
  - akun `QC admin` di `regions`;
  - `search_path` tetap untuk fungsi SECURITY DEFINER.
- **Putuskan di `decisions.md`:**
  - memakai ulang `resolved_*` atau menambah `decided_*` di `delete_requests`;
  - menyatukan kedua tabel permohonan, yang merupakan akar R-19;
  - zona waktu WIT bila Papua Selatan diaktifkan (Q-BR-11).
