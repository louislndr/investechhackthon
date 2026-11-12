// Universal loader: turns whatever Onesheet hands us (nested JSON, flat JSON rows, CSV)
// into one shape:
//   companies: [{ ticker, name, sector, exchange, description }]
//   kpiMeta:   { key: { label, unit, higher_is_better } }
//   facts:     [{ ticker, key, period, value, source: { type, doc, note, url } }]
//   prices:    { ticker: [{ date, close }] }   (sorted oldest -> newest)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// ---------- helpers ----------
const SYN = {
  ticker: ['ticker', 'symbol', 'company_ticker', 'ticker_symbol', 'code'],
  name: ['company_name', 'company', 'issuer', 'name'],
  key: ['kpi', 'kpi_key', 'metric', 'metric_key', 'key', 'indicator', 'field', 'measure'],
  label: ['label', 'kpi_name', 'metric_name', 'display_name', 'title'],
  value: ['value', 'val', 'amount', 'figure', 'number'],
  unit: ['unit', 'units', 'uom'],
  period: ['period', 'fiscal_period', 'quarter', 'fiscal_quarter', 'as_of', 'report_date', 'period_end', 'date'],
  source: ['source', 'source_doc', 'document', 'source_name', 'source_document', 'filing'],
  sourceType: ['source_type', 'sourcetype', 'type_of_source'],
  url: ['source_url', 'url', 'link', 'href'],
  hib: ['higher_is_better', 'hib', 'direction', 'better'],
  sector: ['sector', 'industry', 'gics_sector'],
  close: ['close', 'adj_close', 'adjclose', 'price', 'last', 'close_price'],
};
const norm = (s) => String(s).trim().toLowerCase().replace(/[\s\-\.]+/g, '_');
function pick(obj, field) {
  const keys = Object.keys(obj);
  for (const cand of SYN[field]) {
    const k = keys.find((x) => norm(x) === cand);
    if (k !== undefined && obj[k] !== '' && obj[k] != null) return obj[k];
  }
  return undefined;
}
export const slug = (s) => norm(s).replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  const s = String(v).replace(/[,$\s]/g, '').replace(/%$/, '').replace(/x$/i, '');
  const neg = /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[()]/g, ''));
  return neg ? -n : n;
}
function guessUnit(raw, key = '') {
  const s = String(raw ?? '');
  if (s.includes('%')) return '%';
  if (s.includes('$')) return '$';
  if (/x$/i.test(s.trim())) return 'x';
  if (/(ratio|margin|rate|growth|occupancy|yield|pct|percent|spread|vacancy|churn)/.test(key)) return '%';
  return '';
}
function guessHib(key) {
  return !/(payout|debt|leverage|vacancy|churn|cost|expense|loss|delinquen|default|capex|dilution|days_sales|dso|completion|payback|charge_off|chargeoff|cac)/.test(key);
}
function parseHib(v, key) {
  if (v === undefined) return guessHib(key);
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['false', '0', 'no', 'lower', 'down', 'lower_is_better'].includes(s)) return false;
  return true;
}

// Period -> sortable number. Handles 2025-Q3, Q3 2025, 2025Q3, FY2025, 2025-09-30.
export function periodKey(p) {
  const s = String(p).toUpperCase();
  let m = s.match(/(20\d\d)\s*[-_ ]?\s*Q([1-4])/) || s.match(/Q([1-4])\s*[-_ ]?\s*(?:FY)?\s*(20\d\d)/);
  if (m) {
    const [y, q] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]];
    return Number(y) * 10 + Number(q);
  }
  m = s.match(/(20\d\d)-(\d\d)(?:-(\d\d))?/);
  if (m) return Number(m[1]) * 10 + Math.ceil(Number(m[2]) / 3);
  m = s.match(/(?:FY|H[12]\s*)?(20\d\d)/);
  if (m) return Number(m[1]) * 10 + 4;
  return 0;
}
export function prettyPeriod(p) {
  const k = periodKey(p);
  if (!k) return String(p);
  return `Q${k % 10} ${Math.floor(k / 10)}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}

function asSource(raw, fallbackType = 'Filing') {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      type: raw.type || raw.source_type || fallbackType,
      doc: raw.doc || raw.document || raw.name || raw.title || raw.filing || 'Source document',
      note: raw.note || raw.page ? [raw.note, raw.page && `p. ${raw.page}`].filter(Boolean).join(' · ') : '',
      url: raw.url || raw.link || '',
    };
  }
  if (typeof raw === 'string' && raw) {
    const isUrl = /^https?:\/\//.test(raw);
    return { type: fallbackType, doc: isUrl ? new URL(raw).hostname : raw, note: '', url: isUrl ? raw : '' };
  }
  return { type: 'Dataset', doc: 'Onesheet dataset', note: '', url: '' };
}

const ACRONYMS = new Set(['gmv', 'noi', 'ffo', 'affo', 'arr', 'mrr', 'nrr', 'eps', 'roe', 'roa', 'roic', 'ebitda', 'ebit', 'tpv', 'aum', 'cac', 'ltv', 'kpi', 'yoy', 'qoq', 'gbv', 'ltv', 'nim', 'cet1', 'pcl', 'arpu', 'dau', 'mau', 'r&d', 'sga', 'capex', 'fcf', 'p/e', 'ev']);
function prettyKey(key) {
  const words = key.split('_').filter(Boolean).map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// ---------- the universe being built ----------
function emptyU() {
  return { sector: '', companies: new Map(), kpiMeta: {}, facts: [], prices: {}, files: [] };
}
function upsertCompany(U, c) {
  if (!c.ticker) return;
  const t = String(c.ticker).trim();
  const prev = U.companies.get(t) || { ticker: t, name: t, sector: '', exchange: '', description: '' };
  for (const k of ['name', 'sector', 'exchange', 'description']) if (c[k]) prev[k] = String(c[k]);
  U.companies.set(t, prev);
}
function addMeta(U, key, meta = {}) {
  const prev = U.kpiMeta[key] || {};
  U.kpiMeta[key] = {
    label: meta.label || prev.label || prettyKey(key),
    unit: meta.unit ?? prev.unit ?? '',
    higher_is_better: meta.higher_is_better ?? prev.higher_is_better ?? guessHib(key),
  };
}
function addFact(U, { ticker, key, period, value, rawValue, source, label, unit, hib }) {
  const n = toNumber(value);
  if (!ticker || !key || !Number.isFinite(n)) return;
  const k = slug(key);
  addMeta(U, k, { label, unit: unit ?? (U.kpiMeta[k]?.unit || guessUnit(rawValue ?? value, k)), higher_is_better: hib });
  U.facts.push({ ticker: String(ticker).trim(), key: k, period: String(period ?? 'Latest'), value: n, source });
}

// Nested format: { sector, kpis:{key:meta}, companies:[{ticker,..., kpis:{key:[{period,value,source}]}}], sector_facts }
function ingestNested(U, j) {
  if (j.sector && !U.sector) U.sector = j.sector;
  for (const [k, m] of Object.entries(j.kpis || j.kpi_meta || {})) addMeta(U, slug(k), { label: m.label, unit: m.unit, higher_is_better: m.higher_is_better });
  for (const c of j.companies) {
    const ticker = pick(c, 'ticker');
    upsertCompany(U, { ticker, name: pick(c, 'name'), sector: pick(c, 'sector'), exchange: c.exchange, description: c.description || c.summary || c.business_description });
    const kp = c.kpis || c.metrics || c.data || {};
    if (Array.isArray(kp)) {
      for (const r of kp) ingestRow(U, { ...r, ticker });
    } else {
      for (const [key, series] of Object.entries(kp)) {
        let arr = Array.isArray(series) ? series : series?.series || [series];
        // Shape { "2025-Q1": 95.1, "2025-Q2": 95.4 } -> [{period, value}]
        if (arr.length === 1 && arr[0] && typeof arr[0] === 'object' && !Array.isArray(arr[0]) && pick(arr[0], 'value') === undefined && Object.keys(arr[0]).every((k) => periodKey(k))) {
          arr = Object.entries(arr[0]).map(([period, value]) => ({ period, value }));
        }
        for (const pt of arr) {
          if (pt == null) continue;
          if (typeof pt !== 'object') { addFact(U, { ticker, key, period: 'Latest', value: pt, rawValue: pt, source: asSource(null) }); continue; }
          addFact(U, { ticker, key, period: pick(pt, 'period'), value: pick(pt, 'value'), rawValue: pick(pt, 'value'), source: asSource(pt.source || pick(pt, 'url'), pick(pt, 'sourceType')), label: series?.label, unit: series?.unit });
        }
      }
    }
    if (Array.isArray(c.prices)) for (const p of c.prices) addPrice(U, ticker, p.date, pick(p, 'close'));
  }
  for (const sf of j.sector_facts || []) {
    const key = slug(sf.key || sf.label);
    addMeta(U, key, { label: sf.label, unit: sf.unit, higher_is_better: sf.higher_is_better });
    for (const pt of sf.series || [sf]) addFact(U, { ticker: 'SECTOR', key, period: pt.period, value: pt.value, source: asSource(pt.source || sf.source, 'Third-party') });
  }
}
function addPrice(U, ticker, date, close) {
  const n = toNumber(close);
  if (!ticker || !date || !Number.isFinite(n)) return;
  const raw = /^\d{9,13}$/.test(String(date)) ? Number(date) * (String(date).length <= 10 ? 1000 : 1) : String(date);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1990) return;
  (U.prices[ticker] ||= []).push({ date: d.toISOString().slice(0, 10), close: n });
}
function ingestRow(U, r) {
  // Separate year + quarter columns -> one period.
  const yk = Object.keys(r).find((k) => ['year', 'fiscal_year', 'fy'].includes(norm(k)));
  const qk = Object.keys(r).find((k) => ['quarter', 'fiscal_quarter', 'qtr'].includes(norm(k)));
  if (yk && qk && r[yk] && r[qk]) { r = { ...r, period: `${r[yk]}-Q${String(r[qk]).replace(/\D/g, '')}` }; delete r[yk]; delete r[qk]; }
  else if (yk && !pick(r, 'period')) { r = { ...r, period: `FY${r[yk]}` }; delete r[yk]; }
  const ticker = pick(r, 'ticker');
  const close = pick(r, 'close');
  const date = r.date || r.Date || r.timestamp;
  const key = pick(r, 'key');
  if (ticker && close !== undefined && date && !key) { addPrice(U, ticker, date, close); return; }
  const name = pick(r, 'name');
  const descKey = Object.keys(r).find((k) => ['description', 'company_description', 'business_description', 'summary'].includes(norm(k)));
  const exKey = Object.keys(r).find((k) => ['exchange', 'listing', 'market'].includes(norm(k)));
  upsertCompany(U, { ticker, name: name !== key ? name : undefined, sector: pick(r, 'sector'), description: descKey ? r[descKey] : undefined, exchange: exKey ? r[exKey] : undefined });
  const value = pick(r, 'value');
  if (key !== undefined && value !== undefined) {
    const srcRaw = pick(r, 'source');
    const url = pick(r, 'url');
    const src = asSource(typeof srcRaw === 'object' ? srcRaw : srcRaw || url, pick(r, 'sourceType') || 'Filing');
    if (url && !src.url) src.url = url;
    addFact(U, { ticker, key, period: pick(r, 'period'), value, rawValue: value, source: src, label: pick(r, 'label'), unit: pick(r, 'unit'), hib: pick(r, 'hib') !== undefined ? parseHib(pick(r, 'hib'), slug(key)) : undefined });
  } else if (ticker) {
    // Wide row: { ticker, period, occupancy: 97.2, payout: 78 } -> one fact per numeric column
    const skip = new Set(Object.keys(r).filter((k) => ['ticker', 'name', 'period', 'sector', 'source', 'url', 'sourceType', 'label', 'unit', 'hib'].some((f) => SYN[f]?.includes(norm(k))) || ['description', 'exchange', 'company_description'].includes(norm(k))));
    for (const [k, v] of Object.entries(r)) {
      if (skip.has(k) || !Number.isFinite(toNumber(v))) continue;
      addFact(U, { ticker, key: k, period: pick(r, 'period'), value: v, rawValue: v, source: asSource(pick(r, 'source') || pick(r, 'url'), 'Dataset') });
    }
  }
}
function ingestJSON(U, j) {
  if (Array.isArray(j)) { for (const r of j) if (r && typeof r === 'object') (r.kpis && pick(r, 'ticker') ? ingestNested(U, { companies: [r] }) : ingestRow(U, r)); return; }
  if (j && Array.isArray(j.companies)) { ingestNested(U, j); return; }
  if (j && typeof j === 'object') {
    if (j.sector && !U.sector) U.sector = j.sector;
    for (const v of Object.values(j)) if (Array.isArray(v) || (v && typeof v === 'object' && Array.isArray(v.companies))) ingestJSON(U, v);
  }
}

export function ingestText(U, name, text) {
  const ext = extname(name).toLowerCase();
  try {
    if (ext === '.json') ingestJSON(U, JSON.parse(text));
    else if (ext === '.csv') for (const r of parseCSV(text)) ingestRow(U, r);
    else return;
    U.files.push(name);
  } catch (e) {
    console.warn(`[loader] could not read ${name}: ${e.message}`);
  }
}

function finalize(U) {
  // Dedupe facts (same ticker/key/period -> last wins) and sort.
  const m = new Map();
  for (const f of U.facts) m.set(`${f.ticker}|${f.key}|${periodKey(f.period) || f.period}`, f);
  const facts = [...m.values()].sort((a, b) => periodKey(a.period) - periodKey(b.period));
  for (const t of Object.keys(U.prices)) U.prices[t].sort((a, b) => a.date.localeCompare(b.date));
  // Towers = companies with KPI data. Price-only tickers (e.g. an index in the price file) only
  // become towers if there's no KPI data at all.
  const withFacts = new Set(facts.map((f) => f.ticker));
  if (!withFacts.size) for (const t of Object.keys(U.prices)) if (!U.companies.has(t)) upsertCompany(U, { ticker: t });
  const companies = [...U.companies.values()].filter((c) => c.ticker !== 'SECTOR' && (!withFacts.size || withFacts.has(c.ticker)));
  const sectors = [...new Set(companies.map((c) => c.sector).filter(Boolean))];
  return {
    sector: U.sector || sectors.join(' / ') || 'Selected companies',
    companies,
    kpiMeta: U.kpiMeta,
    facts,
    prices: U.prices,
    files: U.files,
  };
}

export function loadFromDir(dir) {
  const U = emptyU();
  if (!existsSync(dir)) return finalize(U);
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else ingestText(U, f, readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return finalize(U);
}

export function loadFromFiles(files) {
  const U = emptyU();
  for (const f of files) ingestText(U, f.name, f.content);
  return finalize(U);
}

// Point-in-time view: only what was known at `asOf` (e.g. "2025-Q2"). Prices cut at the
// end of that quarter. This is what powers time travel.
export function asOf(universe, asOfPeriod) {
  if (!asOfPeriod) return universe;
  const cutoff = periodKey(asOfPeriod);
  const y = Math.floor(cutoff / 10), q = cutoff % 10;
  const lastDate = `${y}-${String(q * 3).padStart(2, '0')}-31`;
  return {
    ...universe,
    facts: universe.facts.filter((f) => !periodKey(f.period) || periodKey(f.period) <= cutoff),
    prices: Object.fromEntries(Object.entries(universe.prices).map(([t, arr]) => [t, arr.filter((p) => p.date <= lastDate)])),
  };
}
