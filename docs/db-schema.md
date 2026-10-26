# Skema Database AGRI-PAM v1 (Fase 0, tugas 6)

Sumber: hasil `docs/db-audit.sql` run 2 (blok 0, A1–A8), dijalankan di SQL Editor pada 2026-10-26. Ringkasan run ada di [`db-audit-results/README.md`](db-audit-results/README.md). Dibandingkan dengan `prd.md` Bagian 5 dan spesifikasi Fase 2.

> **Belum lengkap.** Paste hasil run 2 terpotong di batas 50.000 karakter di tengah blok A8, jadi blok **A9 (bucket), A10 (view), A11 (extension), B, C, D, E belum diterima.** Bagian yang bergantung pada blok itu ditandai "menunggu blok …" di bawah. Dump skema penuh (`supabase/legacy_schema.sql`) tetap wajib dan menjadi baseline Fase 2.

Catatan: `schema.sql` di repo **tidak** mewakili produksi (R-14b). Dokumen ini, bukan berkas itu, adalah gambaran skema yang benar.

## 1. Tabel di schema `public`

15 tabel. Kolom `approx_rows` dari `pg_stat_user_tables` (perkiraan).

| Tabel | Baris | Di PRD §5? | Catatan |
|---|---|---|---|
| `regions` | 24 | Ya | Master akun + `password_hash`. **24 baris, kode menyebut 26 akun** (lihat §6) |
| `database_input` | 20.249 | Ya | Realisasi per jam. **Tanpa unique (region, tanggal, jam)** (§3) |
| `data_estimasi` | 2.879 | Ya | Estimasi harian. Sudah unique (tanggal, region) |
| `sesi_aktif` | 18.600 | Ya | Audit sesi. **Tidak pernah dibersihkan** (§5) |
| `delete_requests` | 188 | Ya | Permohonan hapus/buka. Punya kolom `jam`; **tanpa CHECK `type`** |
| `unlock_requests` | 240 | **Tidak** | Sumber cek APPROVED realisasi & estimasi. Tanpa kolom `type` |
| `data_kebun_tk` | 754 | **Tidak** | TK Panen. **Policy RLS terbuka** (§4, R-09) |
| `database_palmops` | 1.426 | **Tidak** | Input PalmOps admin. Unique (tanggal, region) |
| `laporan_realisasi_panen` | 91 | **Tidak** | LHP harian (JSON per tanggal) |
| `target_challenge_bulanan` | 3 | **Tidak** | Target per bulan (JSON). Hanya Jul–Sep 2026 (Q-BR-10) |
| `surat` | 2 | **Tidak** | SAP Persuratan |
| `log_tracking` | 3 | **Tidak** | Riwayat status surat |
| `audit_log` | 9.721 | **Tidak** | **Temuan baru.** Log audit aplikasi (§7) |
| `rate_limit` | 0 | **Tidak** | **Kosong — rate limit tak pernah aktif** (R-06, §8) |
| `profiles` | 0 | **Tidak** | **Kosong — sisa Supabase Auth, tak dipakai** (§8) |

Sepuluh tabel ada di database tetapi tidak di PRD Bagian 5. Delapan di antaranya aktif dipakai API (`unlock_requests`, `data_kebun_tk`, `database_palmops`, `laporan_realisasi_panen`, `target_challenge_bulanan`, `surat`, `log_tracking`, `audit_log`); dua kosong dan mati (`rate_limit`, `profiles`).

## 2. Kolom per tabel (A1)

Tipe disingkat: `int8`=bigint, `int4`=integer, `num`=numeric, `tstz`=timestamptz, `vc`=varchar, `bool`=boolean.

**`regions`** — id int4 PK (seq), region_name vc UNIQUE NOT NULL, password_hash vc NOT NULL, is_active bool default true, created_at tstz default now().

**`database_input`** — id int8 PK (seq), tanggal date NOT NULL, region vc NOT NULL, jam vc NOT NULL, tonase num NOT NULL default 0, created_at tstz default now().

**`data_estimasi`** — id int8 PK (seq), waktu_input tstz NOT NULL default now(), tanggal date NOT NULL, region vc NOT NULL, restan_lalu num default 0, luas_panen_ha num NOT NULL, tk_panen_hk num NOT NULL, estimasi_panen_kg num NOT NULL, output_panen num default 0, estimasi_kirim_kg num NOT NULL, estimasi_restan_kg num NOT NULL.
→ Kolom yang dipakai `api/estimasi.js` semua ada. **Tidak ada `is_tidak_panen`** dan tidak ada kolom `tk_panen` (adanya `tk_panen_hk`). Jadi status toggle Restan memang tak punya tempat simpan (menguatkan BR-22 / Q-BR-4), dan kolom `is_tidak_panen` di spesifikasi B11 benar-benar baru.

**`sesi_aktif`** — id int8 PK (seq), region vc NOT NULL, token text NOT NULL, login_time tstz NOT NULL default now(), expiry tstz NOT NULL, status vc default 'Aktif' (CHECK: Aktif/Logout/Expired), ip_address vc, created_at tstz default now().

**`delete_requests`** — id int4 PK (seq), region vc NOT NULL, tanggal date NOT NULL, jam vc (nullable), type vc NOT NULL, status vc default 'PENDING', requested_at tstz default CURRENT_TIMESTAMP, resolved_at tstz, resolved_by vc.
→ Sudah punya `resolved_at`/`resolved_by`; **tidak** punya `decided_by`/`decided_at` yang diminta spesifikasi Fase 2 (dipenuhi dengan memakai ulang `resolved_*`, atau menambah kolom — catat di `decisions.md`). Kolom `jam` berarti satu permohonan bisa menyasar satu jam realisasi.

**`unlock_requests`** — id int4 PK (seq), region text NOT NULL, tanggal date NOT NULL, status text default 'PENDING', requested_at tstz NOT NULL default now(), resolved_at tstz, resolved_by text.
→ **Tanpa kolom `type`.** Secara desain hanya untuk buka realisasi, tetapi `api/estimasi.js:144` ikut membacanya untuk estimasi. Inilah inti R-19.

**`data_kebun_tk`** — id int4 PK (**tanpa default** → id diisi aplikasi), cro vc, region vc NOT NULL, region_raw vc, nama_kebun vc NOT NULL, name_tag vc, luasan num default 0, req_tk int4 default 0, tk_mei int4, tk_juni int4, target_juli int4, target_agustus int4, tk_juli int4, tk_agustus int4, updated_by vc default 'SYSTEM', updated_at tstz, created_at tstz, target_september int4, tk_september int4, target_oktober int4 default 0.
→ TK aktual s.d. September; target s.d. Oktober. Kolom `tk_juli`/`tk_agustus` **ada** — jadi jalur simpan-penuh di hotfix G2 cocok dengan skema (lihat §9). `id` tanpa sequence = `addKebun` harus menghitung id sendiri (risiko balapan, sesuai legacy).

**`database_palmops`** — id int8 PK (seq), tanggal date NOT NULL, region vc NOT NULL, tonase num NOT NULL default 0, created_at tstz default now(). Unique (tanggal, region).

**`laporan_realisasi_panen`** — tanggal date **PK**, data jsonb NOT NULL, created_at tstz NOT NULL default utc now(). Satu baris = satu tanggal.

**`target_challenge_bulanan`** — bulan vc **PK**, data jsonb NOT NULL, created_at tstz NOT NULL default utc now(). Satu baris = satu bulan.

**`surat`** — id uuid PK (gen_random_uuid), nomor_surat text NOT NULL, jenis_surat text NOT NULL, perihal text NOT NULL, status text default 'menunggu' (CHECK 12 nilai), file_url text NOT NULL, dibuat_oleh uuid FK→profiles, regional_pengirim text, created_at tstz, tujuan text, catatan text, tanggal_surat date, link_redirect text, asal_surat text.

**`log_tracking`** — id uuid PK, surat_id uuid FK→surat (CASCADE), status_update text NOT NULL, catatan text, created_by uuid FK→profiles, created_at tstz.

**`audit_log`** — id int8 PK (seq), region vc NOT NULL, action vc NOT NULL, detail text, created_at tstz default now(). Index pada `created_at` dan `region`.

**`rate_limit`** — id int4 PK (seq), region vc UNIQUE NOT NULL, attempts int4 default 0, window_start tstz default now(), updated_at tstz default now().

**`profiles`** — id uuid PK FK→auth.users (CASCADE), email text UNIQUE NOT NULL, nama_lengkap text NOT NULL, role `user_role` default 'regional', nama_regional text, created_at tstz.

## 3. Constraint (A2) dan index (A3)

Unique keys:
- `regions.region_name`, `rate_limit.region`.
- `data_estimasi` (tanggal, region) — `unique_estimasi_tanggal_region`.
- `database_palmops` (tanggal, region) — `unique_palmops_tanggal_region`.
- **`database_input`: tidak ada.** Hanya PK (id). Aturan "satu jam satu baris, revisi lewat Hapus Jam Ini" (BR-15) **hanya ditegakkan di kode**, bukan di database. → Fase 2 harus menambah unique (region, tanggal, jam) **setelah** dedupe (blok C1/C2).

CHECK:
- `sesi_aktif.status` ∈ {Aktif, Logout, Expired}.
- `surat.status` ∈ 12 nilai (menunggu, diproses, selesai, ditolak, dan status alur Asta/APN/keuangan).
- **`delete_requests.type`: tidak ada CHECK.** Jadi `UNLOCK_REALISASI` sah di level DB; CHECK sempit di `schema.sql` repo memang tak pernah dipakai di produksi (bagian dari R-14b).

FK (semua ke jalur Supabase Auth yang tak terpakai): `profiles.id`→auth.users, `surat.dibuat_oleh`→profiles, `log_tracking.surat_id`→surat, `log_tracking.created_by`→profiles.

Index: tiap tabel data punya index pada `region` dan `tanggal`; `database_input` juga punya `(tanggal, region)`; `unlock_requests` punya `(region, tanggal)`; `sesi_aktif` punya index pada `token` dan `status`. **Tak ada** index di `delete_requests` selain PK.

## 4. RLS dan policy (A7, A8)

Semua 15 tabel **mengaktifkan RLS** (`rls_enabled = true`, `rls_forced = false`). Hak tabel ke role `anon`/`authenticated` terbuka lebar, jadi yang menentukan adalah policy. API memakai service role (melewati RLS), sehingga policy di bawah berpengaruh hanya bila seseorang memakai **anon key** lewat PostgREST.

- **Tertutup** (policy `block_public`, `USING false`): `audit_log`, `data_estimasi`, `database_input`, `database_palmops`, `rate_limit`, `regions`, `sesi_aktif`. Anon key tidak bisa baca/tulis — benar.
- **`data_kebun_tk`: TERBUKA.** Policy publik `SELECT`, `INSERT`, `UPDATE` (`USING true` / `WITH CHECK true`), tanpa `block_public`. **Siapa pun dengan anon key dapat membaca, menambah, dan mengubah baris TK langsung** tanpa lewat API. Tidak ada policy DELETE. → **R-09 terkonfirmasi.** Ini memperberat R-02 (API kebunTK tanpa auth): tabelnya pun terbuka di lapis database. Perbaikan di Fase 2/Cutover.
- **`log_tracking`, `profiles`, `surat`**: policy berbasis `auth.uid()` dan `profiles.role`. Karena `profiles` kosong dan aplikasi tak memakai Supabase Auth, policy ini praktis tidak pernah lolos lewat anon key (aman), tetapi juga berarti desain RLS SAP tidak berfungsi sebagaimana ditulis.
- **`delete_requests`, `unlock_requests`, `target_challenge_bulanan`, `laporan_realisasi_panen`**: policy **belum terlihat** (A8 terpotong). RLS-nya aktif; perlu memastikan apakah `block_public` atau tanpa policy (keduanya menutup anon). → menunggu sisa blok A8.

## 5. Fungsi (A5) dan trigger (A4)

Tiga fungsi, semua **SECURITY DEFINER**, pemilik `postgres`, dan **tanpa `search_path` tetap** (`config = null`):

| Fungsi | Status |
|---|---|
| `check_password(p_region text, p_password text)` | EXECUTE dimiliki PUBLIC, anon, authenticated, service_role (A5 acl + A6). **R-08 terkonfirmasi** |
| `cleanup_expired_sessions()` | Ada, grant sama. Jelas **tak terjadwal**: 18.600 baris `sesi_aktif` menumpuk |
| `handle_new_user()` | Pemicu Supabase Auth; mati karena `profiles` kosong |

- **R-08 terkonfirmasi (A6):** `anon` dan `authenticated` dapat `EXECUTE check_password`. Fungsi ini membandingkan password lewat RPC dan bisa dipanggil memakai anon key tanpa rate limit (`rate_limit` kosong). Prioritas tinggi. Perbaikan: REVOKE dari anon/authenticated/PUBLIC (Fase 2), dan rotasi password (langkah manual c).
- `search_path` null pada fungsi SECURITY DEFINER adalah praktik yang perlu diperbaiki saat menulis ulang fungsi di Fase 2 (set `search_path = public, pg_temp`).

Trigger (A4): **tidak ada.** Kolom `updated_at` diisi aplikasi, bukan trigger. Tabel `audit_log` juga diisi aplikasi, bukan trigger DB.

## 6. Akun: 24 baris vs 26 nama di kode (menunggu blok B1)

`regions` berisi **24** baris, sedangkan `api/auth.js` `LOCAL_REGIONS_MAP` menyebut **26** akun. Dua akun ada di kode tetapi mungkin tidak ada di tabel — kandidat: alias `Sumut 2` / `Sumatera Utara 2 Ex Torganda` (Q-BR-8) dan `QC admin`. Akun yang hanya ada di map **hanya bisa login lewat fallback plaintext** (R-01).

→ **Blok B1 wajib sebelum G2 butir 5** (menghapus fallback `LOCAL_REGIONS_MAP`). Menghapusnya tanpa tahu dua akun yang hilang dapat mengunci pengguna. Harap paste blok B1, B2, B3.

## 7. Temuan baru dari run ini

- **`audit_log` (9.721 baris)** tidak ada di PRD maupun di inventaris sebelumnya. Perlu dicek di kode: siapa yang menulisnya, action apa saja, dan apakah ikut dimigrasi. Ditambahkan ke backlog pemeriksaan.
- **`sesi_aktif` menumpuk (18.600 baris)** karena `cleanup_expired_sessions()` tak terjadwal. Bukan celah keamanan, tetapi membebani setiap `verifyToken`. Di v2: sesi di cookie + pembersihan terjadwal.
- **Fungsi SECURITY DEFINER tanpa `search_path`.**

## 8. Kode/skema mati yang terbukti

- `rate_limit` (0 baris) dan konstanta rate limit di `auth.js` tak terpakai → **R-06 terkonfirmasi**: login tak dibatasi.
- `profiles` (0 baris) + `handle_new_user` + FK ke `auth.users` → jalur Supabase Auth tidak dipakai. Policy `surat`/`log_tracking` yang bergantung padanya tidak aktif.

## 9. Konsekuensi untuk G2 dan Fase 2

**G2 (hotfix kebunTK):** kolom `tk_juli` dan `tk_agustus` **ada** di `data_kebun_tk`, jadi jalur simpan-penuh `updateTK` di hotfix akan berhasil dan cabang "simpan sebagian" jarang terpakai. Ini memperkuat kesiapan G2 untuk diuji di staging. Namun R-09 (tabel terbuka untuk anon key) **tidak** ditutup oleh G2 — itu ranah Fase 2.

**Fase 2 (baseline + perbaikan), berdasarkan skema nyata:**
- **Lewati** (sudah ada): unique `data_estimasi` (tanggal, region); index (region)/(tanggal) di tabel data; `restan_lalu`.
- **Tambah:** unique `database_input` (region, tanggal, jam) **setelah dedupe**; CHECK tonase 0–5000 dan format jam; kolom `is_tidak_panen` di `data_estimasi`; `regions.cro` dan `regions.timezone` (belum ada di `regions`; `cro` baru ada di `data_kebun_tk`); REVOKE EXECUTE `check_password`; pembersihan `block_public`/RLS untuk `data_kebun_tk`.
- **Putuskan di `decisions.md`:** pakai ulang `resolved_*` atau tambah `decided_*` di `delete_requests`; satukan `unlock_requests` ke pola `delete_requests` setelah cutover (akar R-19).
