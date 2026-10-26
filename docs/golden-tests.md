# Golden Snapshot API Legacy

Fase 0, tugas 7. Alat: `tools/snapshot-legacy.ts`.

**Tujuan:** merekam respons API legacy di **staging** untuk beberapa tanggal contoh. Rekaman ini menjadi acuan uji kesetaraan backend v2 di Fase 3: respons baca v2 harus sama dengan legacy, kecuali selisih yang disengaja dan dicatat di `docs/decisions.md`.

## Prasyarat

1. Project Supabase staging sudah ada (langkah manual b).
2. Server legacy berjalan lokal dan memakai env staging, misalnya:
   ```powershell
   node --env-file=.env.staging dev-server.js
   ```
   `.env.staging` dibuat oleh Anda dan **tidak di-commit**. Pola `.env.*` sebaiknya ditambahkan ke `.gitignore`; saat ini baru `.env`, `.env.local` dan `.env.production` yang tercantum.
3. Satu akun regional dan akun `ADMIN` dengan password **staging**.

## Menjalankan

```powershell
$env:LEGACY_BASE_URL = "http://localhost:3000"
$env:SNAPSHOT_REGIONAL_REGION = "Riau 1"            # atau region lain, satu WIB / satu WITA
$env:SNAPSHOT_REGIONAL_PASSWORD = "<password staging>"
$env:SNAPSHOT_ADMIN_PASSWORD = "<password staging>"
$env:SNAPSHOT_DATES = "2026-09-30,2026-10-15,2026-10-25"
npx tsx tools/snapshot-legacy.ts
```

Variabel opsional: `SNAPSHOT_OUT` (bawaan `tests/golden/legacy`).

Pengaman yang sudah diuji:
- tanpa env, alat berhenti dengan pesan;
- `LEGACY_BASE_URL` berhost `agri-pam.id` ditolak sebelum ada request apa pun.

Password dan token dikirim lewat body POST atau header, bukan URL, karena `dev-server.js:41-44` mencatat URL ke log.

## Isi rekaman

| Lokasi | Isi |
|---|---|
| `<tanggal>/` | realisasi `getData` (ALL, regional, month-to-date) dan `getRunningTextData`; estimasi `getEstimasi` (ALL, regional, month-to-date); palmops `get`; `getLaporan`; `getTarget`; `checkRevisionStatus` dan `checkUnlock` (regional) |
| `global/` | `getKebun` (ALL, regional); `getSurat` (regional, admin); `getDeleteRequests` dan `getUnlockRequests` (admin); vendor GET (regional, admin); qcSheet GET (admin) |
| `probes/` | `auth.refreshToken` vs `auth.refresh` (bukti R-07, baca saja) |
| `manifest.json` | daftar berkas, HTTP status, nilai `success`, host, tanggal |

**Penyamaran:**
- `token`, `ip_address`, `login_time`, `expiry`, `created_at`, `updated_at`, `requested_at`, `resolved_at`, `uploaded_at` → `<masked>`;
- host `*.supabase.co` → `<supabase-host>`.

## Probe tulis R-19 (alur persetujuan revisi)

Hanya berjalan dengan flag `--probe-writes`, dan **menulis ke staging**:
1. satu permohonan revisi;
2. persetujuan admin;
3. upaya insert realisasi bertonase 0, yang langsung dihapus bila berhasil.

```powershell
$env:SNAPSHOT_PROBE_DATE = "2026-09-10"   # tanggal lampau, bulan lalu
$env:SNAPSHOT_PROBE_JAM = "06.00"         # slot yang kosong pada tanggal itu
npx tsx tools/snapshot-legacy.ts --probe-writes
```

Hasil ada di `probes/revision-approval/verdict.json`. Nilai `bugConfirmed: true` berarti persetujuan "Buka Real. Produksi" tidak membuka form realisasi (`docs/risks.md` R-19).

Baris `delete_requests` dan `unlock_requests` milik probe akan tertinggal di staging, karena legacy tidak punya API untuk menghapus permohonan.

## Catatan

- Rekaman berisi data bisnis staging (tonase, nama kebun, metadata surat). Commit hanya bila repo bersifat privat.
- Bila sebuah query gagal karena kolom tidak ada, temuan itu sendiri dicatat di `docs/db-schema.md`.
- Status: **alat sudah siap, belum dijalankan**, menunggu project staging.
