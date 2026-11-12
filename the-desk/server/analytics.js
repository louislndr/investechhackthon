// Deterministic math. The AI never computes or writes numbers: it gets this fact sheet with
// IDs (F1, F2, ...) and can only cite IDs like [[F3]]. Code fills in values and sources.
import { periodKey, prettyPeriod } from './data/loader.js';

export function fmt(value, unit) {
  if (!Number.isFinite(value)) return 'n/a';
  const abs = Math.abs(value);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  const n = value.toLocaleString('en-CA', { minimumFractionDigits: unit === '%' ? 1 : 0, maximumFractionDigits: unit === '%' ? 1 : d });
  if (unit === '%') return `${n}%`;
  if (unit === '$') return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-CA', { maximumFractionDigits: abs < 10 ? 3 : 0, minimumFractionDigits: abs < 10 ? 2 : 0 })}`;
  if (unit === 'x') return `${value.toFixed(1)}x`;
  return n;
}
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');

function changeOf(cur, prev, unit) {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (unit === '%') { const d = cur - prev; return { delta: d, display: `${sign(d)}${Math.abs(d).toFixed(1)} pts` }; }
  if (prev === 0) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { delta: pct, display: `${sign(pct)}${Math.abs(pct).toFixed(1)}%` };
}
function trendOf(delta, hib, unit) {
  const eps = unit === '%' ? 0.15 : 0.5;
  if (delta == null || Math.abs(delta) < eps) return 'flat';
  return (delta > 0) === hib ? 'improving' : 'deteriorating';
}

export function seriesFor(universe, ticker, key) {
  return universe.facts.filter((f) => f.ticker === ticker && f.key === key).sort((a, b) => periodKey(a.period) - periodKey(b.period));
}

export function buildFactSheet(universe, ticker) {
  const facts = [];
  const signals = [];
  let n = 0;
  const add = (f) => { const id = `F${++n}`; const full = { id, ticker, ...f }; facts.push(full); return full; };

  const peers = universe.companies.map((c) => c.ticker);
  const keys = [...new Set(universe.facts.filter((f) => f.ticker === ticker).map((f) => f.key))];

  for (const key of keys) {
    const meta = universe.kpiMeta[key] || { label: key, unit: '', higher_is_better: true };
    const s = seriesFor(universe, ticker, key);
    if (!s.length) continue;
    const L = s[s.length - 1], P = s[s.length - 2], Y = s.length >= 5 ? s[s.length - 5] : s[0] !== L ? s[0] : null;
    const latest = add({ key, kind: 'value', label: meta.label, period: L.period, value: L.value, display: fmt(L.value, meta.unit), source: L.source, desc: `${meta.label}, ${prettyPeriod(L.period)}` });
    const sig = { key, label: meta.label, unit: meta.unit, hib: meta.higher_is_better, latestId: latest.id, latest: L.value, history: s.map((x) => ({ period: x.period, value: x.value })) };

    if (P) {
      const c = changeOf(L.value, P.value, meta.unit);
      if (c) {
        const f = add({ key, kind: 'change', label: `${meta.label}: change vs ${prettyPeriod(P.period)}`, period: L.period, value: c.delta, display: c.display, source: { type: 'Computed', doc: `${prettyPeriod(P.period)} → ${prettyPeriod(L.period)}`, note: `From ${fmt(P.value, meta.unit)} (${P.source?.doc || 'source'}) to ${fmt(L.value, meta.unit)} (${L.source?.doc || 'source'})`, url: L.source?.url || '' }, desc: `Change in ${meta.label} since ${prettyPeriod(P.period)}` });
        sig.qoqId = f.id; sig.qoq = c.delta; sig.qoqTrend = trendOf(c.delta, meta.higher_is_better, meta.unit);
      }
    }
    if (Y && Y !== P) {
      const c = changeOf(L.value, Y.value, meta.unit);
      if (c) {
        const f = add({ key, kind: 'change', label: `${meta.label}: change vs ${prettyPeriod(Y.period)}`, period: L.period, value: c.delta, display: c.display, source: { type: 'Computed', doc: `${prettyPeriod(Y.period)} → ${prettyPeriod(L.period)}`, note: `From ${fmt(Y.value, meta.unit)} (${Y.source?.doc || 'source'}) to ${fmt(L.value, meta.unit)} (${L.source?.doc || 'source'})`, url: L.source?.url || '' }, desc: `Change in ${meta.label} over ${s.length >= 5 ? 'the year' : 'the period'}` });
        sig.yoyId = f.id; sig.yoy = c.delta; sig.yoyTrend = trendOf(c.delta, meta.higher_is_better, meta.unit);
      }
    }
    sig.trend = sig.yoyTrend || sig.qoqTrend || 'flat';

    // Peer comparison on each company's latest value.
    const peerVals = peers.map((t) => { const ps = seriesFor(universe, t, key); return ps.length ? { t, v: ps[ps.length - 1].value } : null; }).filter(Boolean);
    if (peerVals.length >= 2) {
      const sorted = [...peerVals].sort((a, b) => (meta.higher_is_better ? b.v - a.v : a.v - b.v));
      const rank = sorted.findIndex((x) => x.t === ticker) + 1;
      const vals = peerVals.map((x) => x.v).sort((a, b) => a - b);
      const med = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
      const r = add({ key, kind: 'rank', label: `${meta.label}: rank among peers`, period: L.period, value: rank, display: `#${rank} of ${peerVals.length}`, source: { type: 'Computed', doc: `Peer ranking, latest reported (${peerVals.length} companies)`, note: sorted.map((x, i) => `${i + 1}. ${x.t} ${fmt(x.v, meta.unit)}`).join(' · '), url: '' }, desc: `Where it ranks on ${meta.label} (1 = best)` });
      const m = add({ key, kind: 'median', label: `${meta.label}: peer median`, period: L.period, value: med, display: fmt(med, meta.unit), source: { type: 'Computed', doc: `Median of ${peerVals.length} peers, latest reported`, note: '', url: '' }, desc: `Peer median ${meta.label}` });
      Object.assign(sig, { rankId: r.id, rank, peerCount: peerVals.length, medianId: m.id, median: med, peers: sorted.map((x) => ({ ticker: x.t, value: x.v, display: fmt(x.v, meta.unit) })) });
      sig.vsMedian = L.value === med ? 0 : (L.value > med) === meta.higher_is_better ? 1 : -1;
    }
    signals.push(sig);
  }

  // Prices
  const px = universe.prices[ticker] || [];
  let price = null;
  if (px.length) {
    const last = px[px.length - 1];
    const src = { type: 'Market data', doc: 'Daily prices (Onesheet)', note: `Close on ${last.date}`, url: '' };
    const lastF = add({ key: 'price', kind: 'price', label: 'Last close', period: last.date, value: last.close, display: `$${last.close.toFixed(2)}`, source: src, desc: 'Latest unit price' });
    price = { lastId: lastF.id, last: last.close };
    const back = (days) => { const target = new Date(new Date(last.date).getTime() - days * 864e5).toISOString().slice(0, 10); return [...px].reverse().find((p) => p.date <= target); };
    for (const [label, days, keyName] of [['1-year return', 365, 'r1y'], ['3-month return', 91, 'r3m']]) {
      const b = back(days);
      if (!b) continue;
      const r = ((last.close - b.close) / b.close) * 100;
      const f = add({ key: 'price', kind: 'return', label, period: last.date, value: r, display: `${sign(r)}${Math.abs(r).toFixed(1)}%`, source: { type: 'Computed', doc: 'Daily prices (Onesheet)', note: `$${b.close.toFixed(2)} on ${b.date} → $${last.close.toFixed(2)} on ${last.date}`, url: '' }, desc: label });
      price[keyName] = r; price[`${keyName}Id`] = f.id;
    }
  }

  // Sector-level facts (third-party data) apply to every company.
  const sectorKeys = [...new Set(universe.facts.filter((f) => f.ticker === 'SECTOR').map((f) => f.key))];
  const sectorFacts = [];
  for (const key of sectorKeys) {
    const meta = universe.kpiMeta[key];
    const s = seriesFor(universe, 'SECTOR', key);
    const L = s[s.length - 1];
    const f = add({ key, kind: 'sector', label: meta.label, period: L.period, value: L.value, display: fmt(L.value, meta.unit), source: L.source, desc: `${meta.label} (sector-wide), ${prettyPeriod(L.period)}` });
    let trend = 'flat';
    if (s.length > 1) trend = trendOf(L.value - s[0].value, meta.higher_is_better, meta.unit);
    sectorFacts.push({ key, label: meta.label, id: f.id, trend });
  }

  const byId = Object.fromEntries(facts.map((f) => [f.id, f]));
  const labels = [...new Set([...signals.map((s) => s.label), ...sectorFacts.map((s) => s.label)])].sort((a, b) => b.length - a.length);
  return { ticker, facts, byId, signals, price, sectorFacts, labels };
}

// Compact text version for prompts.
export function factSheetText(fs) {
  return fs.facts.map((f) => `${f.id} | ${f.desc || f.label} | ${f.display} | source: ${f.source?.type}: ${f.source?.doc}`).join('\n');
}

// How good/bad a fact is for the company: +1 good, -1 bad, 0 neutral, null = context only
// (peer medians, last price) which shouldn't dilute the verdict.
export function toneOf(fs, id) {
  const f = fs.byId[id];
  if (!f) return 0;
  const sig = fs.signals.find((s) => s.key === f.key);
  if (f.kind === 'change') {
    const t = id === sig?.yoyId ? sig.yoyTrend : sig?.qoqTrend;
    return t === 'improving' ? 1 : t === 'deteriorating' ? -1 : 0;
  }
  if (f.kind === 'rank') { const pct = (f.value - 1) / Math.max(1, (sig?.peerCount || 1) - 1); return pct <= 0.34 ? 1 : pct >= 0.66 ? -1 : 0; }
  if (f.kind === 'value') return sig?.vsMedian ?? (sig?.trend === 'improving' ? 1 : sig?.trend === 'deteriorating' ? -1 : 0);
  if (f.kind === 'return') return f.value > 2 ? 1 : f.value < -2 ? -1 : 0;
  if (f.kind === 'sector') return fs.sectorFacts.find((s) => s.id === id)?.trend === 'deteriorating' ? -1 : 0;
  return null;
}
