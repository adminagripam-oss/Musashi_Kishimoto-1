/**
 * Golden snapshot of the legacy AGRI-PAM API (migration Fase 0, task 7).
 *
 * Calls the read actions of the legacy API for a few sample dates and stores
 * the masked JSON responses under tests/golden/legacy/ so the v2 API can be
 * compared against them. Run the legacy server locally against the STAGING
 * Supabase project (never production) and pass credentials through
 * environment variables only. Passwords and tokens are sent in POST bodies or
 * headers (never in URLs, which dev-server.js logs) and are never printed or
 * written to disk.
 *
 * Usage (PowerShell):
 *   $env:LEGACY_BASE_URL = "http://localhost:3000"
 *   $env:SNAPSHOT_REGIONAL_REGION = "Riau 1"
 *   $env:SNAPSHOT_REGIONAL_PASSWORD = "<staging password>"
 *   $env:SNAPSHOT_ADMIN_PASSWORD = "<staging password>"
 *   $env:SNAPSHOT_DATES = "2026-09-30,2026-10-15,2026-10-25"
 *   npx tsx tools/snapshot-legacy.ts
 *
 * Optional write probe for risk R-19 (revision approval does not unlock the
 * realisasi form). It WRITES request rows and one realisasi row on staging:
 *   $env:SNAPSHOT_PROBE_DATE = "2026-09-10"   # past date, previous month
 *   $env:SNAPSHOT_PROBE_JAM = "06.00"         # slot without data that day
 *   npx tsx tools/snapshot-legacy.ts --probe-writes
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface Session {
  region: string;
  token: string;
}

interface CallResult {
  httpStatus: number;
  body: Json;
}

interface ManifestEntry {
  file: string;
  endpoint: string;
  action: string;
  httpStatus: number;
  success: boolean | null;
}

const MASKED_KEYS = new Set([
  'token',
  'ip_address',
  'login_time',
  'expiry',
  'created_at',
  'updated_at',
  'requested_at',
  'resolved_at',
  'uploaded_at',
]);

const PRODUCTION_HOSTS = ['agri-pam.id', 'www.agri-pam.id'];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable ${name}. See the header of tools/snapshot-legacy.ts.`);
    process.exit(1);
  }
  return value;
}

function mask(value: Json): Json {
  if (Array.isArray(value)) return value.map(mask);
  if (value !== null && typeof value === 'object') {
    const masked: { [key: string]: Json } = {};
    for (const [key, inner] of Object.entries(value)) {
      masked[key] = MASKED_KEYS.has(key) && inner !== null ? '<masked>' : mask(inner);
    }
    return masked;
  }
  if (typeof value === 'string') {
    return value.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/g, 'https://<supabase-host>');
  }
  return value;
}

function successOf(body: Json): boolean | null {
  if (body !== null && typeof body === 'object' && !Array.isArray(body) && typeof body.success === 'boolean') {
    return body.success;
  }
  return null;
}

function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

class LegacyClient {
  constructor(private readonly baseUrl: string) {}

  /** POST with a JSON body: every legacy handler except vendor/qcSheet reads req.body for POST. */
  async post(endpoint: string, body: Record<string, string>): Promise<CallResult> {
    return this.send(`${this.baseUrl}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** GET with token in headers, as accepted by api/vendor.js and api/qcSheet.js. */
  async getWithHeaders(endpoint: string, session: Session): Promise<CallResult> {
    return this.send(`${this.baseUrl}/api/${endpoint}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.token}`, 'x-region': session.region },
    });
  }

  private async send(url: string, init: RequestInit): Promise<CallResult> {
    const res = await fetch(url, init);
    const text = await res.text();
    let body: Json;
    try {
      body = JSON.parse(text) as Json;
    } catch {
      body = { nonJsonBody: text.slice(0, 500) };
    }
    return { httpStatus: res.status, body };
  }
}

class SnapshotWriter {
  readonly manifest: ManifestEntry[] = [];

  constructor(private readonly outDir: string) {}

  async save(relativeFile: string, endpoint: string, action: string, result: CallResult): Promise<void> {
    const target = path.join(this.outDir, relativeFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(mask(result.body), null, 2)}\n`, 'utf8');
    const success = successOf(result.body);
    this.manifest.push({ file: relativeFile, endpoint, action, httpStatus: result.httpStatus, success });
    console.log(`${String(result.httpStatus).padEnd(4)} ${String(success).padEnd(6)} ${relativeFile}`);
  }

  /** Writes data produced by this tool itself (no server response, so nothing to mask). */
  async saveJson(relativeFile: string, data: Json): Promise<void> {
    const target = path.join(this.outDir, relativeFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
}

async function login(client: LegacyClient, region: string, password: string): Promise<Session> {
  const result = await client.post('auth', { action: 'login', region, password });
  const body = result.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body) || body.success !== true || typeof body.token !== 'string') {
    const message = body !== null && typeof body === 'object' && !Array.isArray(body) ? String(body.message ?? '') : '';
    throw new Error(`Login failed for region "${region}" (HTTP ${result.httpStatus}) ${message}`);
  }
  return { region, token: body.token };
}

async function snapshotDate(client: LegacyClient, writer: SnapshotWriter, date: string, regional: Session): Promise<void> {
  const dir = date;
  const monthStart = firstOfMonth(date);

  await writer.save(`${dir}/realisasi.getData.ALL.json`, 'realisasi', 'getData',
    await client.post('realisasi', { action: 'getData', tanggal: date, region: 'ALL' }));
  await writer.save(`${dir}/realisasi.getData.regional.json`, 'realisasi', 'getData',
    await client.post('realisasi', { action: 'getData', tanggal: date, region: regional.region }));
  await writer.save(`${dir}/realisasi.getData.month-to-date.ALL.json`, 'realisasi', 'getData',
    await client.post('realisasi', { action: 'getData', tanggal: monthStart, tanggal_akhir: date, region: 'ALL' }));
  await writer.save(`${dir}/realisasi.getRunningTextData.ALL.json`, 'realisasi', 'getRunningTextData',
    await client.post('realisasi', { action: 'getRunningTextData', tanggal: date, region: 'ALL' }));

  await writer.save(`${dir}/estimasi.getEstimasi.ALL.json`, 'estimasi', 'getEstimasi',
    await client.post('estimasi', { action: 'getEstimasi', tanggal: date, region: 'ALL' }));
  await writer.save(`${dir}/estimasi.getEstimasi.regional.json`, 'estimasi', 'getEstimasi',
    await client.post('estimasi', { action: 'getEstimasi', tanggal: date, region: regional.region }));
  await writer.save(`${dir}/estimasi.getEstimasi.month-to-date.ALL.json`, 'estimasi', 'getEstimasi',
    await client.post('estimasi', { action: 'getEstimasi', tanggal: monthStart, tanggal_akhir: date, region: 'ALL' }));

  await writer.save(`${dir}/palmops.get.json`, 'palmops', 'get',
    await client.post('palmops', { action: 'get', tanggal: date }));
  await writer.save(`${dir}/laporanRealisasi.getLaporan.json`, 'laporanRealisasi', 'getLaporan',
    await client.post('laporanRealisasi', { action: 'getLaporan', tanggal: date }));
  await writer.save(`${dir}/targetChallenge.getTarget.json`, 'targetChallenge', 'getTarget',
    await client.post('targetChallenge', { action: 'getTarget', bulan: date.slice(0, 7) }));

  await writer.save(`${dir}/unlockRequest.checkRevisionStatus.regional.json`, 'unlockRequest', 'checkRevisionStatus',
    await client.post('unlockRequest', { action: 'checkRevisionStatus', tanggal: date, region: regional.region, token: regional.token }));
  await writer.save(`${dir}/unlockRequest.checkUnlock.regional.json`, 'unlockRequest', 'checkUnlock',
    await client.post('unlockRequest', { action: 'checkUnlock', tanggal: date, region: regional.region, token: regional.token }));
}

async function snapshotGlobal(client: LegacyClient, writer: SnapshotWriter, regional: Session, admin: Session): Promise<void> {
  await writer.save('global/kebunTK.getKebun.ALL.json', 'kebunTK', 'getKebun',
    await client.post('kebunTK', { action: 'getKebun', region: 'ALL' }));
  await writer.save('global/kebunTK.getKebun.regional.json', 'kebunTK', 'getKebun',
    await client.post('kebunTK', { action: 'getKebun', region: regional.region }));

  await writer.save('global/sap.getSurat.regional.json', 'sap', 'getSurat',
    await client.post('sap', { action: 'getSurat', region: regional.region, token: regional.token }));
  await writer.save('global/sap.getSurat.admin.json', 'sap', 'getSurat',
    await client.post('sap', { action: 'getSurat', region: admin.region, token: admin.token }));

  await writer.save('global/deleteRequest.getDeleteRequests.admin.json', 'deleteRequest', 'getDeleteRequests',
    await client.post('deleteRequest', { action: 'getDeleteRequests', region: admin.region, token: admin.token }));
  await writer.save('global/unlockRequest.getUnlockRequests.admin.json', 'unlockRequest', 'getUnlockRequests',
    await client.post('unlockRequest', { action: 'getUnlockRequests', region: admin.region, token: admin.token }));

  await writer.save('global/vendor.GET.regional.json', 'vendor', 'GET', await client.getWithHeaders('vendor', regional));
  await writer.save('global/vendor.GET.admin.json', 'vendor', 'GET', await client.getWithHeaders('vendor', admin));
  await writer.save('global/qcSheet.GET.admin.json', 'qcSheet', 'GET', await client.getWithHeaders('qcSheet', admin));

  // Risk R-07: the client heartbeat sends "refreshToken", the server only knows "refresh".
  await writer.save('probes/auth.refreshToken.regional.json', 'auth', 'refreshToken',
    await client.post('auth', { action: 'refreshToken', region: regional.region, token: regional.token }));
  await writer.save('probes/auth.refresh.regional.json', 'auth', 'refresh',
    await client.post('auth', { action: 'refresh', region: regional.region, token: regional.token }));
}

/**
 * Risk R-19 probe. Expected legacy behaviour if the bug exists: the insert is
 * rejected before the request, the revision status becomes APPROVED after the
 * admin approves it from delete_requests, and the insert is STILL rejected
 * because api/realisasi.js only checks unlock_requests.
 */
async function probeRevisionApproval(client: LegacyClient, writer: SnapshotWriter, regional: Session, admin: Session): Promise<void> {
  const date = requireEnv('SNAPSHOT_PROBE_DATE');
  const jam = process.env.SNAPSHOT_PROBE_JAM ?? '06.00';
  const dir = 'probes/revision-approval';

  const existing = await client.post('realisasi', { action: 'getData', tanggal: date, region: regional.region });
  const records = existing.body !== null && typeof existing.body === 'object' && !Array.isArray(existing.body)
    ? existing.body.allRecords
    : null;
  if (Array.isArray(records) && records.some((r) => r !== null && typeof r === 'object' && !Array.isArray(r) && r.jam === jam)) {
    throw new Error(`Probe aborted: ${regional.region} already has data at ${date} ${jam}. Choose another SNAPSHOT_PROBE_DATE/JAM.`);
  }

  const insertPayload = { action: 'insert', tanggal: date, jam, tonase: '0', region: regional.region, token: regional.token };

  const before = await client.post('realisasi', insertPayload);
  await writer.save(`${dir}/1.insert-before-request.json`, 'realisasi', 'insert', before);

  await writer.save(`${dir}/2.requestRevision.json`, 'unlockRequest', 'requestRevision',
    await client.post('unlockRequest', { action: 'requestRevision', tanggal: date, region: regional.region, token: regional.token }));

  const pending = await client.post('deleteRequest', { action: 'getDeleteRequests', region: admin.region, token: admin.token });
  const pendingRows = pending.body !== null && typeof pending.body === 'object' && !Array.isArray(pending.body)
    ? pending.body.data
    : null;
  const request = Array.isArray(pendingRows)
    ? pendingRows.find((row) => row !== null && typeof row === 'object' && !Array.isArray(row)
        && row.type === 'UNLOCK_REALISASI' && row.region === regional.region && row.tanggal === date)
    : undefined;
  if (request === undefined || request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Probe aborted: the UNLOCK_REALISASI request was not found in getDeleteRequests.');
  }

  await writer.save(`${dir}/3.resolveDeleteRequest.approve.json`, 'deleteRequest', 'resolveDeleteRequest',
    await client.post('deleteRequest', {
      action: 'resolveDeleteRequest', region: admin.region, token: admin.token,
      requestId: String(request.id), resolveAction: 'APPROVE',
    }));

  const status = await client.post('unlockRequest', { action: 'checkRevisionStatus', tanggal: date, region: regional.region, token: regional.token });
  await writer.save(`${dir}/4.checkRevisionStatus.json`, 'unlockRequest', 'checkRevisionStatus', status);

  const after = await client.post('realisasi', insertPayload);
  await writer.save(`${dir}/5.insert-after-approval.json`, 'realisasi', 'insert', after);

  await writer.save(`${dir}/6.getUnlockRequests.admin.json`, 'unlockRequest', 'getUnlockRequests',
    await client.post('unlockRequest', { action: 'getUnlockRequests', region: admin.region, token: admin.token }));

  if (successOf(after.body) === true) {
    await writer.save(`${dir}/7.cleanup-delete.json`, 'realisasi', 'delete',
      await client.post('realisasi', { action: 'delete', tanggal: date, jam, region: regional.region, token: regional.token }));
  }

  const statusValue = status.body !== null && typeof status.body === 'object' && !Array.isArray(status.body)
    ? status.body.status
    : null;
  const bugConfirmed = successOf(before.body) === false && statusValue === 'APPROVED' && successOf(after.body) === false;
  await writer.saveJson(`${dir}/verdict.json`, {
    date,
    jam,
    rejectedBeforeRequest: successOf(before.body) === false,
    revisionStatusAfterApproval: statusValue,
    rejectedAfterApproval: successOf(after.body) === false,
    bugConfirmed,
    leftoverRowsOnStaging: 'delete_requests and unlock_requests rows for this date (no delete API exists)',
  });
  console.log(`R-19 probe verdict: bugConfirmed=${bugConfirmed}`);
}

async function main(): Promise<void> {
  const baseUrl = requireEnv('LEGACY_BASE_URL').replace(/\/+$/, '');
  if (PRODUCTION_HOSTS.includes(new URL(baseUrl).hostname)) {
    console.error('Refusing to run against production. Point LEGACY_BASE_URL at a server that uses the STAGING Supabase project.');
    process.exit(1);
  }
  const regionalRegion = requireEnv('SNAPSHOT_REGIONAL_REGION');
  const regionalPassword = requireEnv('SNAPSHOT_REGIONAL_PASSWORD');
  const adminPassword = requireEnv('SNAPSHOT_ADMIN_PASSWORD');
  const dates = requireEnv('SNAPSHOT_DATES').split(',').map((d) => d.trim()).filter(Boolean);
  if (dates.length === 0 || dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    console.error('SNAPSHOT_DATES must be a comma-separated list of YYYY-MM-DD dates.');
    process.exit(1);
  }
  const outDir = process.env.SNAPSHOT_OUT ?? path.join('tests', 'golden', 'legacy');
  const probeWrites = process.argv.includes('--probe-writes');

  const client = new LegacyClient(baseUrl);
  const writer = new SnapshotWriter(outDir);

  const regional = await login(client, regionalRegion, regionalPassword);
  const admin = await login(client, 'ADMIN', adminPassword);

  try {
    for (const date of dates) {
      await snapshotDate(client, writer, date, regional);
    }
    await snapshotGlobal(client, writer, regional, admin);
    if (probeWrites) {
      await probeRevisionApproval(client, writer, regional, admin);
    }
  } finally {
    // End both sessions so staging sesi_aktif does not accumulate active rows.
    await client.post('auth', { action: 'logout', region: regional.region, token: regional.token });
    await client.post('auth', { action: 'logout', region: admin.region, token: admin.token });
  }

  await writer.saveJson('manifest.json', {
    generatedAt: new Date().toISOString(),
    legacyHost: new URL(baseUrl).host,
    regionalRegion,
    dates,
    probeWrites,
    entries: writer.manifest.map((entry) => ({ ...entry })),
  });
  console.log(`Saved ${writer.manifest.length} snapshots to ${outDir}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
