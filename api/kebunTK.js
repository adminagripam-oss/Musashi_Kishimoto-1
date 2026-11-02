const fs = require('fs');
const path = require('path');
const { applyCors } = require('./lib/cors');
const { verifyToken } = require('./lib/auth');
const { supabase } = require('./lib/supabase');

const jsonPath = path.join(__dirname, '..', 'data_kebun_tk.json');

// Comprehensive region normalizer mapping all 23 regional login names to dataset regions
function normalizeRegion(rStr) {
  if (!rStr) return '';
  let s = String(rStr).trim().toUpperCase();
  s = s.replace(/^REGIONAL\s+/, '');
  s = s.replace(/^RO\s+/, '');

  if (s.includes('SUMUT 1') || s.includes('SUMATERA UTARA 1')) return 'SUMUT 1';
  if (s.includes('SUMUT 2') || s.includes('SUMATERA UTARA 2') || s.includes('TORGANDA')) return 'SUMUT 2';
  if (s.includes('KALBAR 1') || s.includes('KALIMANTAN BARAT 1')) return 'KALBAR 1';
  if (s.includes('KALBAR 2') || s.includes('KALIMANTAN BARAT 2')) return 'KALBAR 2';
  if (s.includes('KALSEL 1') || s.includes('KALIMANTAN SELATAN 1')) return 'KALSEL 1';
  if (s.includes('KALSEL 2') || s.includes('KALIMANTAN SELATAN 2')) return 'KALSEL 2';
  if (s.includes('KALTARA') || s.includes('KALIMANTAN UTARA')) return 'KALTARA';
  if (s.includes('KALTIM') || s.includes('KALIMANTAN TIMUR')) return 'KALTIM';
  if (s.includes('KALTENG 1') || s.includes('KALIMANTAN TENGAH 1')) return 'KALTENG 1';
  if (s.includes('KALTENG 2') || s.includes('KALIMANTAN TENGAH 2')) return 'KALTENG 2';
  if (s.includes('KALTENG 3') || s.includes('KALIMANTAN TENGAH 3')) return 'KALTENG 3';
  if (s.includes('BABEL') || s.includes('BANGKA BELITUNG')) return 'BABEL';
  if (s.includes('SUMBAR') || s.includes('SUMATERA BARAT')) return 'SUMBAR';
  if (s.includes('SUMSEL') || s.includes('SUMATERA SELATAN')) return 'SUMSEL';
  if (s.includes('SULTENG') || s.includes('SULAWESI TENGAH')) return 'SULTENG';
  if (s.includes('SULTRA') || s.includes('SULAWESI TENGGARA')) return 'SULTRA';
  if (s.includes('PAPUA')) return 'PAPUA SELATAN';
  if (s.includes('ACEH')) return 'ACEH';
  if (s.includes('JAMBI')) return 'JAMBI';
  if (s.includes('RIAU 1')) return 'RIAU 1';
  if (s.includes('RIAU 2')) return 'RIAU 2';
  if (s.includes('RIAU 3')) return 'RIAU 3';
  if (s.includes('RIAU 4')) return 'RIAU 4';
  return s;
}

// Maps any region name (formal or abbreviated) to the canonical abbreviation stored in DB.
// Prevents duplicates like 'Kalbar 2' vs 'Kalimantan Barat 2'.
function canonicalizeRegion(rStr) {
  if (!rStr) return rStr;
  const norm = normalizeRegion(rStr);
  // Title-case map: norm (UPPER) → canonical stored DB value
  const MAP = {
    'ACEH': 'Aceh',
    'SUMUT 1': 'Sumut 1',
    'SUMUT 2': 'Sumut 2',
    'RIAU 1': 'Riau 1',
    'RIAU 2': 'Riau 2',
    'RIAU 3': 'Riau 3',
    'RIAU 4': 'Riau 4',
    'BABEL': 'Babel',
    'JAMBI': 'Jambi',
    'SUMBAR': 'Sumbar',
    'SUMSEL': 'Sumsel',
    'KALBAR 1': 'Kalbar 1',
    'KALBAR 2': 'Kalbar 2',
    'KALSEL 1': 'Kalsel 1',
    'KALSEL 2': 'Kalsel 2',
    'KALTIM': 'Kaltim',
    'KALTARA': 'Kaltara',
    'KALTENG 1': 'Kalteng 1',
    'KALTENG 2': 'Kalteng 2',
    'KALTENG 3': 'Kalteng 3',
    'SULTENG': 'Sulteng',
    'SULTRA': 'Sultra',
    'PAPUA SELATAN': 'Papua Selatan'
  };
  return MAP[norm] || rStr;
}

const REGION_TO_CRO_MAP = {
  // CRO I
  'Aceh': 'CRO I',
  'Sumut 1': 'CRO I',
  'Sumatera Utara 1': 'CRO I',
  'Sumut 2': 'CRO I',
  'Sumatera Utara 2': 'CRO I',
  'Sumatera Utara 2 Ex Torganda': 'CRO I',
  'Sumut 2 Ex Torganda': 'CRO I',

  // CRO II
  'Riau 1': 'CRO II',

  // CRO III
  'Riau 2': 'CRO III',
  'Riau 3': 'CRO III',

  // CRO IV
  'Riau 4': 'CRO IV',

  // CRO V
  'Sumbar': 'CRO V',
  'Sumatera Barat': 'CRO V',
  'Jambi': 'CRO V',
  'Babel': 'CRO V',
  'Bangka Belitung': 'CRO V',
  'Sumsel': 'CRO V',
  'Sumatera Selatan': 'CRO V',

  // CRO VI
  'Kalbar 1': 'CRO VI',
  'Kalbar 1A': 'CRO VI',
  'Kalbar 1B': 'CRO VI',
  'Kalbar 2': 'CRO VI',
  'Kalimantan Barat 1': 'CRO VI',
  'Kalimantan Barat 1A': 'CRO VI',
  'Kalimantan Barat 1B': 'CRO VI',
  'Kalimantan Barat 2': 'CRO VI',

  // CRO VII
  'Kalsel 1': 'CRO VII',
  'Kalimantan Selatan 1': 'CRO VII',
  'Kalsel 2': 'CRO VII',
  'Kalimantan Selatan 2': 'CRO VII',
  'Kaltara': 'CRO VII',
  'Kalimantan Utara': 'CRO VII',
  'Kaltim': 'CRO VII',
  'Kalimantan Timur': 'CRO VII',

  // CRO VIII
  'Kalteng 1': 'CRO VIII',
  'Kalimantan Tengah 1': 'CRO VIII',
  'Kalteng 3': 'CRO VIII',
  'Kalimantan Tengah 3': 'CRO VIII',

  // CRO IX
  'Kalteng 2': 'CRO IX',
  'Kalimantan Tengah 2': 'CRO IX',

  // CRO X
  'Sulteng': 'CRO X',
  'Sulawesi Tengah': 'CRO X',
  'Sultra': 'CRO X',
  'Sulawesi Tenggara': 'CRO X',

  // CRO XI
  'Papua': 'CRO XI',
  'Papua Selatan': 'CRO XI'
};

function getCroForRegion(regionName, existingList) {
  if (!regionName) return 'CRO I';
  const clean = String(regionName).trim();
  const upper = clean.toUpperCase();
  if (upper === 'ADMIN' || upper === 'ALL') return 'CRO I';

  // 1. Direct dictionary lookup
  const norm = normalizeRegion(clean);
  for (const [rKey, croVal] of Object.entries(REGION_TO_CRO_MAP)) {
    if (normalizeRegion(rKey) === norm) return croVal;
  }

  // 2. Existing list / table dataset lookup
  if (Array.isArray(existingList)) {
    const match = existingList.find(k => {
      if (!k || !k.cro) return false;
      const kNorm = normalizeRegion(k.region || '');
      return kNorm === norm || norm.includes(kNorm) || kNorm.includes(norm);
    });
    if (match && match.cro) return match.cro;
  }

  // 3. Keyword / Prefix heuristic matching
  const lower = clean.toLowerCase();
  if (lower.includes('kalbar') || lower.includes('kalimantan barat')) return 'CRO VI';
  if (lower.includes('kalsel') || lower.includes('kalimantan selatan')) return 'CRO VII';
  if (lower.includes('kaltara') || lower.includes('kalimantan utara')) return 'CRO VII';
  if (lower.includes('kaltim') || lower.includes('kalimantan timur')) return 'CRO VII';
  if (lower.includes('kalteng 2') || lower.includes('kalimantan tengah 2')) return 'CRO IX';
  if (lower.includes('kalteng') || lower.includes('kalimantan tengah')) return 'CRO VIII';
  if (lower.includes('sulteng') || lower.includes('sulawesi tengah')) return 'CRO X';
  if (lower.includes('sultra') || lower.includes('sulawesi tenggara')) return 'CRO X';
  if (lower.includes('riau 1')) return 'CRO II';
  if (lower.includes('riau 2') || lower.includes('riau 3')) return 'CRO III';
  if (lower.includes('riau 4')) return 'CRO IV';
  if (lower.includes('sumbar') || lower.includes('sumatera barat') ||
      lower.includes('sumsel') || lower.includes('sumatera selatan') ||
      lower.includes('jambi') || lower.includes('babel') ||
      lower.includes('bangka')) return 'CRO V';
  if (lower.includes('aceh') || lower.includes('sumut') ||
      lower.includes('sumatera utara') || lower.includes('torganda')) return 'CRO I';
  if (lower.includes('papua')) return 'CRO XI';

  return 'CRO I';
}

function loadKebunData() {
  try {
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading data_kebun_tk.json:', err);
  }
  return [];
}

function saveKebunData(list) {
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving data_kebun_tk.json:', err);
    return false;
  }
}

module.exports = async (req, res) => {
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const p = { ...req.query, ...req.body };
  const action = (p.action || '').trim();
  const regionParam = (p.region || '').trim();
  const token = (p.token || '').trim();

  let kebunList = loadKebunData();

  // Try fetching from Supabase if configured & available
  try {
    const { data: supaData, error } = await supabase.from('data_kebun_tk').select('*');
    if (!error && supaData && supaData.length > 0) {
      // Build a lookup from JSON fallback for fields that may be missing in Supabase
      const jsonLookup = {};
      const jsonFallback = loadKebunData();
      jsonFallback.forEach(j => { jsonLookup[j.id] = j; });

      kebunList = supaData.map(k => {
        const fb = jsonLookup[k.id] || {};
        let regName = k.region || fb.region || '';
        if (regName === 'Sumatera Utara 2 Ex Torganda' || regName === 'Sumut 2 Ex Torganda') {
          regName = 'Sumut 2';
        }
        return {
          ...fb,
          ...k,
          region: regName,
          tk_juli: k.tk_juli !== undefined && k.tk_juli !== null ? k.tk_juli : (fb.tk_juli || 0),
          tk_agustus: k.tk_agustus !== undefined && k.tk_agustus !== null ? k.tk_agustus : (fb.tk_agustus || 0),
          target_september: k.target_september !== undefined && k.target_september !== null ? k.target_september : (fb.target_september || 0),
          tk_september: k.tk_september !== undefined && k.tk_september !== null ? k.tk_september : (fb.tk_september || 0),
          target_oktober: k.target_oktober !== undefined && k.target_oktober !== null ? k.target_oktober : (fb.target_oktober || 0),
          tk_oktober: k.tk_oktober !== undefined && k.tk_oktober !== null ? k.tk_oktober : (fb.tk_oktober || 0),
          target_november: k.target_november !== undefined && k.target_november !== null ? k.target_november : (fb.target_november || 0)
        };
      });
    }
  } catch (_) { }

  // -------------------------------------------------------------------------
  // GET KEBUN DATA
  // -------------------------------------------------------------------------
  if (action === 'getKebun') {
    const filterRegion = (p.filterRegion || regionParam || '').trim();
    const isMasterAdmin = filterRegion.toUpperCase() === 'ADMIN' || !filterRegion || filterRegion.toUpperCase() === 'ALL';

    let result = kebunList;
    if (!isMasterAdmin) {
      const normRequested = normalizeRegion(filterRegion);
      result = kebunList.filter(item => {
        const normItem = normalizeRegion(item.region);
        return normItem === normRequested || (normRequested.length >= 3 && normItem.includes(normRequested)) || (normItem.length >= 3 && normRequested.includes(normItem));
      });
    }

    result.sort((a, b) => {
      const croA = (a.cro || '').toString().toUpperCase();
      const croB = (b.cro || '').toString().toUpperCase();
      if (croA < croB) return -1;
      if (croA > croB) return 1;
      const regA = (a.region || '').toString().toUpperCase();
      const regB = (b.region || '').toString().toUpperCase();
      if (regA < regB) return -1;
      if (regA > regB) return 1;
      const namaA = (a.nama_kebun || '').toString().toUpperCase();
      const namaB = (b.nama_kebun || '').toString().toUpperCase();
      if (namaA < namaB) return -1;
      if (namaA > namaB) return 1;
      return 0;
    });

    const targetMonthStr = "oktober";
    const tkField = "tk_oktober";
    const cutOffLabel = "Oktober";

    // Calculate summary statistics
    const totalLuas = result.reduce((sum, item) => sum + (parseFloat(item.luasan) || 0), 0);
    const totalReqTk = result.reduce((sum, item) => sum + (parseFloat(item.req_tk) || 0), 0);
    const totalCutOff = result.reduce((sum, item) => sum + (parseFloat(item[tkField]) || 0), 0);
    const kekurangTK = totalReqTk - totalCutOff;

    return res.json({
      success: true,
      totalEntries: result.length,
      data: result,
      summary: {
        totalLuas: Math.round(totalLuas * 100) / 100,
        totalReqTk: Math.round(totalReqTk),
        totalCutOff: Math.round(totalCutOff),
        kekurangTK: Math.round(kekurangTK),
        cutOffMonth: cutOffLabel,
        cutOffField: tkField
      }
    });
  }

  // -------------------------------------------------------------------------
  // UPDATE TK PANEN (Kolom I & J)
  // -------------------------------------------------------------------------
  if (action === 'updateTK') {
    if (!regionParam) {
      return res.json({ success: false, message: 'Region wajib disertakan.' });
    }

    const edits = Array.isArray(p.edits) ? p.edits : (p.id ? [p] : []);
    if (edits.length === 0) {
      return res.json({ success: false, message: 'Tidak ada data perubahan yang dikirim.' });
    }

    const isAdmin = regionParam.toUpperCase() === 'ADMIN';
    const userNormRegion = normalizeRegion(regionParam);
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    for (const edit of edits) {
      const targetId = parseInt(edit.id, 10);
      const itemIndex = kebunList.findIndex(k => k.id === targetId);

      if (itemIndex !== -1) {
        const item = kebunList[itemIndex];
        const itemNormRegion = normalizeRegion(item.region);

        if (isAdmin || userNormRegion === itemNormRegion || userNormRegion.includes(itemNormRegion) || itemNormRegion.includes(userNormRegion)) {
          if (edit.req_tk !== undefined && edit.req_tk !== null) {
            item.req_tk = Math.max(0, parseInt(edit.req_tk, 10) || 0);
          }
          if (edit.luasan !== undefined && edit.luasan !== null) {
            item.luasan = Math.max(0, parseFloat(edit.luasan) || 0);
          }
          if (edit.tk_juni !== undefined && edit.tk_juni !== null) {
            item.tk_juni = Math.max(0, parseFloat(edit.tk_juni) || 0);
          }
          if (edit.target_juli !== undefined && edit.target_juli !== null) {
            item.target_juli = Math.max(0, parseFloat(edit.target_juli) || 0);
          }
          if (edit.target_agustus !== undefined && edit.target_agustus !== null) {
            item.target_agustus = Math.max(0, parseFloat(edit.target_agustus) || 0);
          }
          if (edit.target_september !== undefined && edit.target_september !== null) {
            item.target_september = Math.max(0, parseFloat(edit.target_september) || 0);
          }
          if (edit.target_oktober !== undefined && edit.target_oktober !== null) {
            item.target_oktober = Math.max(0, parseFloat(edit.target_oktober) || 0);
          }
          if (edit.target_november !== undefined && edit.target_november !== null) {
            item.target_november = Math.max(0, parseFloat(edit.target_november) || 0);
          }
          if (edit.tk_juli !== undefined && edit.tk_juli !== null) {
            item.tk_juli = Math.max(0, parseFloat(edit.tk_juli) || 0);
          }
          if (edit.tk_agustus !== undefined && edit.tk_agustus !== null) {
            item.tk_agustus = Math.max(0, parseFloat(edit.tk_agustus) || 0);
          }
          if (edit.tk_september !== undefined && edit.tk_september !== null) {
            item.tk_september = Math.max(0, parseFloat(edit.tk_september) || 0);
          }
          if (edit.tk_oktober !== undefined && edit.tk_oktober !== null) {
            item.tk_oktober = Math.max(0, parseFloat(edit.tk_oktober) || 0);
          }
          if (edit.cro !== undefined && edit.cro !== null && String(edit.cro).trim()) {
            item.cro = String(edit.cro).trim();
          }
          item.updated_by = regionParam;
          item.updated_at = nowIso;
          updatedCount++;

          try {
            const fullPayload = {
              cro: item.cro,
              req_tk: item.req_tk,
              luasan: item.luasan,
              tk_juni: item.tk_juni,
              target_juli: item.target_juli,
              target_agustus: item.target_agustus,
              target_september: item.target_september,
              target_oktober: item.target_oktober,
              target_november: item.target_november,
              tk_juli: item.tk_juli,
              tk_agustus: item.tk_agustus,
              tk_september: item.tk_september,
              tk_oktober: item.tk_oktober,
              updated_by: regionParam,
              updated_at: nowIso
            };
            const { error: sbErr } = await supabase.from('data_kebun_tk').update(fullPayload).eq('id', targetId);
            if (sbErr) {
              console.error(`[kebunTK] Supabase update fullPayload failed for id=${targetId}:`, sbErr.message, sbErr.details);
              const safePayload = {
                cro: item.cro,
                req_tk: item.req_tk,
                luasan: item.luasan,
                tk_juni: item.tk_juni,
                target_juli: item.target_juli,
                target_agustus: item.target_agustus,
                target_september: item.target_september,
                target_oktober: item.target_oktober,
                target_november: item.target_november,
                tk_september: item.tk_september,
                tk_oktober: item.tk_oktober,
                updated_by: regionParam,
                updated_at: nowIso
              };
              const { error: sbErr2 } = await supabase.from('data_kebun_tk').update(safePayload).eq('id', targetId);
              if (sbErr2) {
                console.error(`[kebunTK] Supabase update safePayload ALSO failed for id=${targetId}:`, sbErr2.message, sbErr2.details);
              }
            }
          } catch (sbCatchErr) {
            console.error(`[kebunTK] Supabase update exception for id=${targetId}:`, sbCatchErr.message);
          }
        }
      }
    }

    if (updatedCount > 0) {
      saveKebunData(kebunList);
      return res.json({
        success: true,
        message: `Berhasil memperbarui data TK Panen untuk ${updatedCount} kebun.`,
        updatedCount
      });
    } else {
      return res.json({
        success: false,
        message: 'Gagal memperbarui data. Anda hanya diizinkan mengedit kebun pada wilayah regional Anda.'
      });
    }
  }

  // -------------------------------------------------------------------------
  // DELETE KEBUN (Hapus Kebun)
  // -------------------------------------------------------------------------
  if (action === 'deleteKebun') {
    if (!regionParam) {
      return res.json({ success: false, message: 'Region/User wajib disertakan.' });
    }

    const targetId = parseInt(p.id, 10);
    if (isNaN(targetId)) {
      return res.json({ success: false, message: 'ID kebun tidak valid.' });
    }

    const isAdmin = regionParam.toUpperCase() === 'ADMIN';
    const userNormRegion = normalizeRegion(regionParam);
    const itemIndex = kebunList.findIndex(k => k.id === targetId);

    if (itemIndex === -1) {
      return res.json({ success: false, message: 'Kebun tidak ditemukan.' });
    }

    const item = kebunList[itemIndex];
    const itemNormRegion = normalizeRegion(item.region);

    // Security check: Only Admin or users from the same region can delete
    if (!isAdmin && userNormRegion !== itemNormRegion && !userNormRegion.includes(itemNormRegion) && !itemNormRegion.includes(userNormRegion)) {
      return res.json({ success: false, message: 'Anda tidak diizinkan menghapus kebun di regional lain.' });
    }

    // 1. Remove from local JSON list
    kebunList.splice(itemIndex, 1);
    saveKebunData(kebunList);

    // 2. Remove from Supabase
    try {
      const { error: sbErr } = await supabase.from('data_kebun_tk').delete().eq('id', targetId);
      if (sbErr) {
        console.error(`[kebunTK] Supabase delete failed for id=${targetId}: ${sbErr.message}`);
      }
    } catch (sbCatchErr) {
      console.error(`[kebunTK] Supabase delete exception for id=${targetId}:`, sbCatchErr.message);
    }

    return res.json({
      success: true,
      message: `Kebun '${item.nama_kebun}' berhasil dihapus dari database.`
    });
  }

  // -------------------------------------------------------------------------
  // ADD KEBUN (Tambah Kebun Baru)
  // -------------------------------------------------------------------------
  if (action === 'addKebun') {
    if (!regionParam) {
      return res.json({ success: false, message: 'Region/User wajib disertakan.' });
    }

    const targetNamaKebun = (p.nama_kebun || '').trim();
    if (!targetNamaKebun) {
      return res.json({ success: false, message: 'Nama kebun wajib diisi.' });
    }

    const isAdmin = regionParam.toUpperCase() === 'ADMIN';
    const userNormRegion = normalizeRegion(regionParam);

    // Prefecture garden values — canonicalize to prevent 'Kalimantan Barat 2' vs 'Kalbar 2' duplicates
    const targetRegionRaw = (p.region || '').trim();
    if (!targetRegionRaw) {
      return res.json({ success: false, message: 'Region kebun wajib diisi.' });
    }
    const targetRegion = canonicalizeRegion(targetRegionRaw);

    const targetNormRegion = normalizeRegion(targetRegion);

    // Security check: Regional user can only add to their own region
    if (!isAdmin && userNormRegion !== targetNormRegion && !userNormRegion.includes(targetNormRegion) && !targetNormRegion.includes(userNormRegion)) {
      return res.json({ success: false, message: 'Anda tidak diizinkan menambahkan kebun untuk regional lain.' });
    }

    // Generate new ID
    const maxId = kebunList.reduce((max, k) => k.id > max ? k.id : max, 0);
    const newId = maxId + 1;
    const targetCro = (p.cro && String(p.cro).trim() !== '-' ? String(p.cro).trim() : '') || getCroForRegion(targetRegion, kebunList);

    const newKebun = {
      id: newId,
      cro: targetCro,
      region: targetRegion,
      region_raw: `Regional ${targetRegion}`,
      nama_kebun: targetNamaKebun,
      name_tag: `KB-TAG-${newId}`,
      luasan: parseFloat(p.luasan) || 0,
      req_tk: parseInt(p.req_tk, 10) || 0,
      tk_mei: 0,
      tk_juni: parseInt(p.tk_juni, 10) || 0,
      target_juli: parseInt(p.target_juli, 10) || 0,
      target_agustus: parseInt(p.target_agustus, 10) || 0,
      target_september: parseInt(p.target_september, 10) || 0,
      target_oktober: parseInt(p.target_oktober, 10) || 0,
      target_november: parseInt(p.target_november, 10) || 0,
      tk_juli: parseInt(p.tk_juli, 10) || 0,
      tk_agustus: parseInt(p.tk_agustus, 10) || 0,
      tk_september: parseInt(p.tk_september, 10) || 0,
      tk_oktober: parseInt(p.tk_oktober, 10) || 0,
      updated_by: regionParam,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // 1. Add to local JSON list
    kebunList.push(newKebun);
    saveKebunData(kebunList);

    // 2. Add to Supabase
    try {
      const { error: sbErr } = await supabase.from('data_kebun_tk').insert(newKebun);
      if (sbErr) {
        console.error(`[kebunTK] Supabase insert failed: ${sbErr.message}`);
      }
    } catch (sbCatchErr) {
      console.error(`[kebunTK] Supabase insert exception:`, sbCatchErr.message);
    }

    return res.json({
      success: true,
      message: `Kebun '${targetNamaKebun}' berhasil ditambahkan ke database.`,
      data: newKebun
    });
  }

  return res.json({ success: false, message: 'Action tidak dikenal.' });
};
