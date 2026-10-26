-- =====================================================================
-- AGRI-PAM v1 — database audit (Fase 0, task 6)
-- READ-ONLY. The whole file is ONE SELECT statement: paste all of it
-- into the Supabase SQL Editor and press Run once. The editor shows
-- only the result of the last statement of a script, which is why the
-- first, multi-statement version of this file returned only block E4.
--
-- Result: one row per block, with columns
--   block     — block id below (0, A1..A11, B1..B3, C1..C4, D1..D4, E1..E5)
--   row_count — number of rows the block returned
--   result    — the block's rows as a JSON array
-- Save it with "Copy as JSON" as
-- docs/db-audit-results/audit-<production|staging>-<YYYY-MM-DD>.json,
-- or paste it in chat. Run the file on production and on staging: the
-- A blocks of both results must match (Fase 0 DoD).
--
-- Every inner query (between "FROM (" and ") q") also runs on its own.
-- Never select regions.password_hash or sesi_aktif.token.
-- Summary of past runs: docs/db-audit-results/README.md
-- =====================================================================

SELECT block, jsonb_array_length(result) AS row_count, result
FROM (

-- ---------------------------------------------------------------------
-- 0. Overview: row counts for every table in schema public
-- ---------------------------------------------------------------------
SELECT '0' AS block, (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT relname AS table_name, n_live_tup AS approx_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY relname
) q) AS result


-- =====================================================================
-- A. SCHEMA (compare with docs/db-schema.md and prd.md section 5)
-- =====================================================================

-- A1. Columns of every public table and view
UNION ALL
SELECT 'A1', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT table_name, ordinal_position, column_name, data_type,
         is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
) q)

-- A2. Constraints (PK, UNIQUE, CHECK, FK) with their definition
UNION ALL
SELECT 'A2', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT c.conrelid::regclass AS table_name, c.conname, c.contype,
         pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public'
  ORDER BY 1, 2
) q)

-- A3. Indexes
UNION ALL
SELECT 'A3', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
) q)

-- A4. Triggers
UNION ALL
SELECT 'A4', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT event_object_table AS table_name, trigger_name,
         action_timing, event_manipulation, action_statement
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  ORDER BY 1, 2
) q)

-- A5. Functions in public (risk R-08): SECURITY DEFINER flag, owner,
--     settings such as search_path, and raw grants. In "acl", an entry
--     starting with "=" is PUBLIC ("=X/postgres": everyone may EXECUTE);
--     null means default privileges, which also let PUBLIC EXECUTE.
UNION ALL
SELECT 'A5', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
         p.prosecdef AS security_definer,
         pg_get_userbyid(p.proowner) AS owner,
         p.proconfig AS config,
         p.proacl::text AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY 1, 2
) q)

-- A6. Effective EXECUTE right on check_password per role (risk R-08:
--     anon and authenticated must be false)
UNION ALL
SELECT 'A6', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT r.rolname,
         has_function_privilege(r.rolname, 'public.check_password(text, text)', 'EXECUTE') AS can_execute
  FROM pg_roles r
  WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
  ORDER BY 1
) q)

-- A7. RLS and API-role privileges per table and view (risk R-09). With
--     RLS off, a granted privilege lets anyone holding the anon key use
--     the table through the REST API. Views run as their owner by
--     default, so they bypass the RLS of the tables they read.
UNION ALL
SELECT 'A7', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT c.relname AS table_name, c.relkind AS kind,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced,
         has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
         has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
         has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
         has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
         has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  ORDER BY 1
) q)

-- A8. RLS policies in public and storage (risk R-09)
UNION ALL
SELECT 'A8', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT schemaname, tablename, policyname, permissive, roles, cmd,
         qual, with_check
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
  ORDER BY 1, 2, 3
) q)

-- A9. Storage buckets (risk R-09: public buckets)
UNION ALL
SELECT 'A9', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT id, name, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
  ORDER BY id
) q)

-- A10. Views and materialized views in public, with their definition
UNION ALL
SELECT 'A10', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT c.relname AS view_name, c.relkind AS kind,
         pg_get_viewdef(c.oid) AS definition
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  ORDER BY 1
) q)

-- A11. Installed extensions (e.g. pgcrypto for crypt(), pg_cron for
--      scheduled jobs such as cleanup_expired_sessions)
UNION ALL
SELECT 'A11', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT e.extname, e.extversion, n.nspname AS schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  ORDER BY 1
) q)


-- =====================================================================
-- B. ACCOUNTS (no password hashes)
-- =====================================================================

-- B1. Which of the 26 accounts named in api/auth.js LOCAL_REGIONS_MAP
--     exist in table regions, and whether they are active.
--     Accounts missing here only work through the plaintext fallback
--     (risk R-01) and would be locked out if that fallback is removed.
UNION ALL
SELECT 'B1', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
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
  ORDER BY exists_in_regions, e.region_name
) q)

-- B2. Rows in regions that the code does not know about
UNION ALL
SELECT 'B2', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
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
  )
  ORDER BY region_name
) q)

-- B3. Session table health (cleanup_expired_sessions may never run)
UNION ALL
SELECT 'B3', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT status,
         count(*) AS sessions,
         count(*) FILTER (WHERE expiry < now()) AS already_expired
  FROM sesi_aktif
  GROUP BY status
  ORDER BY status
) q)


-- =====================================================================
-- C. DATA QUALITY (must be clean before adding constraints in Fase 2)
-- =====================================================================

-- C1. Summary: one row per check, count of offending rows
UNION ALL
SELECT 'C1', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
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
     OR estimasi_restan_kg < 0
) q)

-- C2. Detail: duplicate hourly rows (fill the dedupe plan for Fase 2)
UNION ALL
SELECT 'C2', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT region, tanggal, jam, count(*) AS copies,
         array_agg(tonase ORDER BY id) AS tonase_values,
         array_agg(id ORDER BY id) AS ids
  FROM database_input
  GROUP BY region, tanggal, jam
  HAVING count(*) > 1
  ORDER BY tanggal DESC, region, jam
) q)

-- C3. Detail: malformed or non-slot jam values
UNION ALL
SELECT 'C3', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT jam, count(*) AS rows
  FROM database_input
  WHERE jam IS NULL
     OR jam NOT IN ('06.00', '07.00', '08.00', '09.00', '10.00', '11.00',
                    '12.00', '13.00', '14.00', '15.00', '16.00', '17.30')
  GROUP BY jam
  ORDER BY rows DESC
) q)

-- C4. Detail: region spellings used in data tables vs regions
UNION ALL
SELECT 'C4', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT 'database_input' AS source, region, count(*) AS rows
  FROM database_input GROUP BY region
  UNION ALL
  SELECT 'data_estimasi', region, count(*) FROM data_estimasi GROUP BY region
  UNION ALL
  SELECT 'database_palmops', region, count(*) FROM database_palmops GROUP BY region
  ORDER BY region, source
) q)


-- =====================================================================
-- D. REQUESTS (risk R-19, rules BR-25..BR-28)
-- =====================================================================

-- D1. Distinct type/status combinations in delete_requests
UNION ALL
SELECT 'D1', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT type, status, count(*) AS rows
  FROM delete_requests
  GROUP BY type, status
  ORDER BY type, status
) q)

-- D2. Distinct status in unlock_requests
UNION ALL
SELECT 'D2', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT status, count(*) AS rows
  FROM unlock_requests
  GROUP BY status
  ORDER BY status
) q)

-- D3. Revision twins whose status disagrees: approved in one table but
--     not in the other. Non-empty result = evidence for risk R-19.
UNION ALL
SELECT 'D3', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
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
  ORDER BY d.tanggal DESC, d.region
) q)

-- D4. Realisasi revisions approved in delete_requests that never got an
--     APPROVED row in unlock_requests (the insert check reads only the
--     latter), i.e. revisions that were approved but stayed locked.
UNION ALL
SELECT 'D4', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT d.region, d.tanggal, d.resolved_at, d.resolved_by
  FROM delete_requests d
  WHERE d.type = 'UNLOCK_REALISASI'
    AND d.status = 'APPROVED'
    AND NOT EXISTS (
      SELECT 1 FROM unlock_requests u
      WHERE u.region = d.region AND u.tanggal = d.tanggal
        AND u.status = 'APPROVED')
  ORDER BY d.tanggal DESC
) q)


-- =====================================================================
-- E. TK PANEN, SAP, OTHER MODULES
-- =====================================================================

-- E1. data_kebun_tk totals per region (compare with data_kebun_tk.json
--     in docs/data-migration-report.md during Fase 2)
UNION ALL
SELECT 'E1', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT region, count(*) AS kebun, sum(luasan) AS total_luasan,
         sum(req_tk) AS total_req_tk, sum(tk_september) AS total_tk_september
  FROM data_kebun_tk
  GROUP BY region
  ORDER BY region
) q)

-- E2. Grand totals for data_kebun_tk
UNION ALL
SELECT 'E2', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT count(*) AS kebun, sum(luasan) AS total_luasan,
         max(id) AS max_id
  FROM data_kebun_tk
) q)

-- E3. SAP letters by status and sender region
UNION ALL
SELECT 'E3', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT regional_pengirim, status, count(*) AS letters
  FROM surat
  GROUP BY regional_pengirim, status
  ORDER BY regional_pengirim, status
) q)

-- E4. Monthly JSON tables present (Target Challenge, LHP)
UNION ALL
SELECT 'E4', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  SELECT 'target_challenge_bulanan' AS table_name, count(*) AS rows,
         min(bulan)::text AS first_key, max(bulan)::text AS last_key
  FROM target_challenge_bulanan
  UNION ALL
  SELECT 'laporan_realisasi_panen', count(*), min(tanggal)::text, max(tanggal)::text
  FROM laporan_realisasi_panen
) q)

-- E5. Daily coverage for the last 45 days, to choose SNAPSHOT_DATES for
--     task 7 (a complete day, a day with requests, a month boundary).
--     tanggal is compared as 'YYYY-MM-DD' text, so this works whether
--     the column holds a date or text.
UNION ALL
SELECT 'E5', (SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]') FROM (
  WITH days AS (
    SELECT to_char(current_date - s, 'YYYY-MM-DD') AS tanggal
    FROM generate_series(0, 44) AS s
  ),
  realisasi AS (
    SELECT left(tanggal::text, 10) AS tanggal, count(DISTINCT region) AS regions
    FROM database_input GROUP BY 1
  ),
  estimasi AS (
    SELECT left(tanggal::text, 10) AS tanggal, count(DISTINCT region) AS regions
    FROM data_estimasi GROUP BY 1
  ),
  deletes AS (
    SELECT left(tanggal::text, 10) AS tanggal, count(*) AS requests
    FROM delete_requests GROUP BY 1
  ),
  unlocks AS (
    SELECT left(tanggal::text, 10) AS tanggal, count(*) AS requests
    FROM unlock_requests GROUP BY 1
  )
  SELECT d.tanggal,
         coalesce(r.regions, 0) AS regions_realisasi,
         coalesce(e.regions, 0) AS regions_estimasi,
         coalesce(x.requests, 0) AS delete_requests,
         coalesce(u.requests, 0) AS unlock_requests,
         EXISTS (SELECT 1 FROM laporan_realisasi_panen l
                 WHERE left(l.tanggal::text, 10) = d.tanggal) AS has_lhp
  FROM days d
  LEFT JOIN realisasi r ON r.tanggal = d.tanggal
  LEFT JOIN estimasi e ON e.tanggal = d.tanggal
  LEFT JOIN deletes x ON x.tanggal = d.tanggal
  LEFT JOIN unlocks u ON u.tanggal = d.tanggal
  ORDER BY d.tanggal DESC
) q)

) audit
ORDER BY left(block, 1), nullif(substr(block, 2), '')::int NULLS FIRST;
