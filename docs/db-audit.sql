-- =====================================================================
-- AGRI-PAM v1 — database audit (Fase 0, task 6)
-- READ-ONLY: every statement below is a SELECT. Run against STAGING
-- (a copy of production) in the Supabase SQL Editor, one numbered
-- block at a time, and export each result as CSV into
-- docs/db-audit-results/<block-number>.csv (no secrets are selected).
-- Never select regions.password_hash or sesi_aktif.token.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Overview: row counts for every table in schema public
-- ---------------------------------------------------------------------
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;


-- =====================================================================
-- A. SCHEMA (compare with docs/db-schema.md and prd.md section 5)
-- =====================================================================

-- A1. Columns of every public table
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- A2. Constraints (PK, UNIQUE, CHECK, FK) with their definition
SELECT c.conrelid::regclass AS table_name, c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY 1, 2;

-- A3. Indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- A4. Triggers
SELECT event_object_table AS table_name, trigger_name,
       action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY 1, 2;

-- A5. Functions in public with SECURITY DEFINER flag (risk R-08)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY 1;

-- A6. Who may EXECUTE check_password (risk R-08: anon must be false)
SELECT r.rolname,
       has_function_privilege(r.rolname, 'public.check_password(text, text)', 'EXECUTE') AS can_execute
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'public', 'postgres');

-- A7. RLS enabled per table
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;

-- A8. RLS policies in public and storage (risk R-09)
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY 1, 2, 3;

-- A9. Storage buckets (risk R-09: public buckets)
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;


-- =====================================================================
-- B. ACCOUNTS (no password hashes)
-- =====================================================================

-- B1. Which of the 26 accounts named in api/auth.js LOCAL_REGIONS_MAP
--     exist in table regions, and whether they are active.
--     Accounts missing here only work through the plaintext fallback
--     (risk R-01) and would be locked out if that fallback is removed.
WITH expected(region_name) AS (
  VALUES ('Aceh'), ('Sumatera Utara 1'), ('Sumut 2'),
         ('Sumatera Utara 2 Ex Torganda'), ('Riau 1'), ('Riau 2'),
         ('Riau 3'), ('Riau 4'), ('Bangka Belitung'), ('Jambi'),
         ('Sumatera Barat'), ('Sumatera Selatan'),
         ('Kalimantan Barat 1A'), ('Kalimantan Barat 1B'),
         ('Kalimantan Barat 2'), ('Kalimantan Selatan 1'),
         ('Kalimantan Selatan 2'), ('Kalimantan Timur'),
         ('Kalimantan Utara'), ('Kalimantan Tengah 1'),
         ('Kalimantan Tengah 2'), ('Kalimantan Tengah 3'),
         ('Sulawesi Tenggara'), ('Sulawesi Tengah'), ('ADMIN'),
         ('QC admin')
)
SELECT e.region_name,
       r.region_name IS NOT NULL AS exists_in_regions,
       r.is_active
FROM expected e
LEFT JOIN regions r ON r.region_name = e.region_name
ORDER BY exists_in_regions, e.region_name;

-- B2. Rows in regions that the code does not know about
SELECT region_name, is_active
FROM regions
WHERE region_name NOT IN (
  'Aceh', 'Sumatera Utara 1', 'Sumut 2', 'Sumatera Utara 2 Ex Torganda',
  'Riau 1', 'Riau 2', 'Riau 3', 'Riau 4', 'Bangka Belitung', 'Jambi',
  'Sumatera Barat', 'Sumatera Selatan', 'Kalimantan Barat 1A',
  'Kalimantan Barat 1B', 'Kalimantan Barat 2', 'Kalimantan Selatan 1',
  'Kalimantan Selatan 2', 'Kalimantan Timur', 'Kalimantan Utara',
  'Kalimantan Tengah 1', 'Kalimantan Tengah 2', 'Kalimantan Tengah 3',
  'Sulawesi Tenggara', 'Sulawesi Tengah', 'ADMIN', 'QC admin'
);

-- B3. Session table health (cleanup_expired_sessions may never run)
SELECT status,
       count(*) AS sessions,
       count(*) FILTER (WHERE expiry < now()) AS already_expired
FROM sesi_aktif
GROUP BY status
ORDER BY status;


-- =====================================================================
-- C. DATA QUALITY (must be clean before adding constraints in Fase 2)
-- =====================================================================

-- C1. Summary: one row per check, count of offending rows
SELECT 'database_input duplicate (region, tanggal, jam)' AS check_name,
       count(*) AS offending_groups
FROM (SELECT 1 FROM database_input
      GROUP BY region, tanggal, jam HAVING count(*) > 1) d
UNION ALL
SELECT 'data_estimasi duplicate (region, tanggal)', count(*)
FROM (SELECT 1 FROM data_estimasi
      GROUP BY region, tanggal HAVING count(*) > 1) d
UNION ALL
SELECT 'database_input jam not HH.MM', count(*)
FROM database_input WHERE jam IS NULL OR jam !~ '^[0-9]{2}\.[0-9]{2}$'
UNION ALL
SELECT 'database_input jam outside the 12 legacy slots', count(*)
FROM database_input
WHERE jam NOT IN ('06.00', '07.00', '08.00', '09.00', '10.00', '11.00',
                  '12.00', '13.00', '14.00', '15.00', '16.00', '17.30')
UNION ALL
SELECT 'database_input tonase < 0, > 5000 or null', count(*)
FROM database_input WHERE tonase IS NULL OR tonase < 0 OR tonase > 5000
UNION ALL
SELECT 'database_input region not in regions', count(*)
FROM database_input d
WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE r.region_name = d.region)
UNION ALL
SELECT 'data_estimasi region not in regions', count(*)
FROM data_estimasi d
WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE r.region_name = d.region)
UNION ALL
SELECT 'data_estimasi negative values', count(*)
FROM data_estimasi
WHERE restan_lalu < 0 OR luas_panen_ha < 0 OR tk_panen_hk < 0
   OR estimasi_panen_kg < 0 OR estimasi_kirim_kg < 0
   OR estimasi_restan_kg < 0;

-- C2. Detail: duplicate hourly rows (fill the dedupe plan for Fase 2)
SELECT region, tanggal, jam, count(*) AS copies,
       array_agg(tonase ORDER BY id) AS tonase_values,
       array_agg(id ORDER BY id) AS ids
FROM database_input
GROUP BY region, tanggal, jam
HAVING count(*) > 1
ORDER BY tanggal DESC, region, jam;

-- C3. Detail: malformed or non-slot jam values
SELECT jam, count(*) AS rows
FROM database_input
WHERE jam IS NULL
   OR jam NOT IN ('06.00', '07.00', '08.00', '09.00', '10.00', '11.00',
                  '12.00', '13.00', '14.00', '15.00', '16.00', '17.30')
GROUP BY jam
ORDER BY rows DESC;

-- C4. Detail: region spellings used in data tables vs regions
SELECT 'database_input' AS source, region, count(*) AS rows
FROM database_input GROUP BY region
UNION ALL
SELECT 'data_estimasi', region, count(*) FROM data_estimasi GROUP BY region
UNION ALL
SELECT 'database_palmops', region, count(*) FROM database_palmops GROUP BY region
ORDER BY region, source;


-- =====================================================================
-- D. REQUESTS (risk R-19, rules BR-25..BR-28)
-- =====================================================================

-- D1. Distinct type/status combinations in delete_requests
SELECT type, status, count(*) AS rows
FROM delete_requests
GROUP BY type, status
ORDER BY type, status;

-- D2. Distinct status in unlock_requests
SELECT status, count(*) AS rows
FROM unlock_requests
GROUP BY status
ORDER BY status;

-- D3. Revision twins whose status disagrees: approved in one table but
--     not in the other. Non-empty result = evidence for risk R-19.
SELECT d.region, d.tanggal,
       d.status AS delete_requests_status,
       u.status AS unlock_requests_status,
       d.requested_at AS delete_requested_at,
       u.requested_at AS unlock_requested_at
FROM delete_requests d
JOIN unlock_requests u
  ON u.region = d.region AND u.tanggal = d.tanggal
WHERE d.type = 'UNLOCK_REALISASI'
  AND d.status IS DISTINCT FROM u.status
ORDER BY d.tanggal DESC, d.region;

-- D4. Realisasi revisions approved in delete_requests that never got an
--     APPROVED row in unlock_requests (the insert check reads only the
--     latter), i.e. revisions that were approved but stayed locked.
SELECT d.region, d.tanggal, d.resolved_at, d.resolved_by
FROM delete_requests d
WHERE d.type = 'UNLOCK_REALISASI'
  AND d.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM unlock_requests u
    WHERE u.region = d.region AND u.tanggal = d.tanggal
      AND u.status = 'APPROVED')
ORDER BY d.tanggal DESC;


-- =====================================================================
-- E. TK PANEN, SAP, OTHER MODULES
-- =====================================================================

-- E1. data_kebun_tk totals per region (compare with data_kebun_tk.json
--     in docs/data-migration-report.md during Fase 2)
SELECT region, count(*) AS kebun, sum(luasan) AS total_luasan,
       sum(req_tk) AS total_req_tk, sum(tk_september) AS total_tk_september
FROM data_kebun_tk
GROUP BY region
ORDER BY region;

-- E2. Grand totals for data_kebun_tk
SELECT count(*) AS kebun, sum(luasan) AS total_luasan,
       max(id) AS max_id
FROM data_kebun_tk;

-- E3. SAP letters by status and sender region
SELECT regional_pengirim, status, count(*) AS letters
FROM surat
GROUP BY regional_pengirim, status
ORDER BY regional_pengirim, status;

-- E4. Monthly JSON tables present (Target Challenge, LHP)
SELECT 'target_challenge_bulanan' AS table_name, count(*) AS rows,
       min(bulan)::text AS first_key, max(bulan)::text AS last_key
FROM target_challenge_bulanan
UNION ALL
SELECT 'laporan_realisasi_panen', count(*), min(tanggal)::text, max(tanggal)::text
FROM laporan_realisasi_panen;
