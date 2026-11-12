import './env.js';
import express from 'express';
import { existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFromDir, asOf } from './data/loader.js';
import { buildFactSheet } from './analytics.js';
import { runDesk, stressTest } from './agents/pipeline.js';
import { LIVE, MODEL } from './llm.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CACHE = join(here, 'cache');
const UPLOADED = join(here, 'data/uploaded');
const LIVE_DIR = join(here, 'data/live');
const DEMO = join(here, 'data/demo');
mkdirSync(CACHE, { recursive: true });

const hasFiles = (d) => existsSync(d) && readdirSync(d).some((f) => /\.(json|csv)$/i.test(f));
function pickDir() {
  if (process.env.DATA_DIR) return join(root, process.env.DATA_DIR);
  if (hasFiles(UPLOADED)) return UPLOADED;
  if (hasFiles(LIVE_DIR)) return LIVE_DIR;
  return DEMO;
}
let dataDir = pickDir();
let universe = loadFromDir(dataDir);
const isDemo = () => dataDir === DEMO;
console.log(`[desk] data: ${dataDir} (${universe.companies.length} companies, ${universe.facts.length} facts) | mode: ${LIVE ? `LIVE (${MODEL})` : 'OFFLINE (no API key)'}`);

const cacheFile = (t, as) => join(CACHE, `${t.replace(/[^\w.-]/g, '_')}${as ? `@${as}` : ''}.json`);
function readCache(t, as) { try { return JSON.parse(readFileSync(cacheFile(t, as), 'utf8')); } catch { return null; } }
function clearCache() { for (const f of readdirSync(CACHE)) if (f.endsWith('.json')) rmSync(join(CACHE, f)); }
const running = new Map();

const app = express();
app.use(express.json({ limit: '60mb' }));

app.get('/api/universe', (req, res) => {
  const cached = {};
  for (const c of universe.companies) { const r = readCache(c.ticker); if (r) cached[c.ticker] = { conviction: r.report.conviction, stance: r.report.stance }; }
  const periods = [...new Set(universe.facts.map((f) => f.period))];
  res.json({
    sector: universe.sector, companies: universe.companies, live: LIVE, model: LIVE ? MODEL : null,
    demo: isDemo(), dataDir: basename(dataDir), files: universe.files, factCount: universe.facts.length,
    kpis: Object.entries(universe.kpiMeta).map(([key, m]) => ({ key, ...m })), cached, periods,
  });
});

// Server-sent events: the live feed that drives the city animation.
app.get('/api/run', async (req, res) => {
  const ticker = String(req.query.ticker || '');
  const as = req.query.asOf ? String(req.query.asOf) : '';
  const replay = req.query.replay === '1';
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  const ac = new AbortController();
  req.on('close', () => ac.abort());

  const cached = readCache(ticker, as);
  if (replay && cached) {
    // Stage-safe replay of a previous run (same timing, sped up a bit).
    send({ t: 'replay' });
    let prev = 0;
    for (const ev of cached.events) {
      if (ac.signal.aborted) return;
      await new Promise((r) => setTimeout(r, Math.min(900, (ev.ms - prev) / 1.4)));
      prev = ev.ms;
      send(ev.e);
    }
    return res.end();
  }
  if (running.has(`${ticker}@${as}`)) { send({ t: 'error', message: 'Already running for this ticker.' }); return res.end(); }
  running.set(`${ticker}@${as}`, true);
  const t0 = Date.now();
  const events = [];
  const emit = (e) => { events.push({ ms: Date.now() - t0, e }); if (!res.writableEnded) send(e); };
  try {
    const u = as ? asOf(universe, as) : universe;
    // Time travel: run on point-in-time data, then compute what actually happened next.
    let after = null;
    if (as) {
      const cutPx = u.prices[ticker] || [], fullPx = universe.prices[ticker] || [];
      const from = cutPx[cutPx.length - 1], to = fullPx[fullPx.length - 1];
      if (from && to && to.date > from.date) after = { from, to, ret: ((to.close - from.close) / from.close) * 100 };
    }
    const wrapped = (e) => { if (e.t === 'done') { e.report.asOf = as || null; e.report.after = after; } emit(e); };
    const report = await runDesk(u, ticker, wrapped, { signal: ac.signal });
    writeFileSync(cacheFile(ticker, as), JSON.stringify({ report, events }));
  } catch (e) {
    console.error('[desk] run failed:', e);
    if (!ac.signal.aborted) emit({ t: 'error', message: e.message });
  } finally {
    running.delete(`${ticker}@${as}`);
    res.end();
  }
});

app.get('/api/report/:ticker', (req, res) => {
  const r = readCache(req.params.ticker, req.query.asOf || '');
  r ? res.json(r.report) : res.status(404).json({ error: 'Not run yet' });
});

app.get('/api/facts/:ticker', (req, res) => {
  try { const fs = buildFactSheet(universe, req.params.ticker); res.json({ facts: fs.facts, signals: fs.signals, price: fs.price }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/stress', async (req, res) => {
  try { res.json(await stressTest(universe, req.body.ticker, String(req.body.thesis || '').slice(0, 4000))); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Drag-and-drop the hackathon data: JSON / CSV in any reasonable shape.
app.post('/api/data', (req, res) => {
  const files = (req.body.files || []).filter((f) => /\.(json|csv)$/i.test(f.name));
  if (!files.length) return res.status(400).json({ error: 'Send .json or .csv files' });
  rmSync(UPLOADED, { recursive: true, force: true });
  mkdirSync(UPLOADED, { recursive: true });
  for (const f of files) writeFileSync(join(UPLOADED, basename(f.name)), f.content);
  const next = loadFromDir(UPLOADED);
  if (!next.companies.length || !next.facts.length) {
    rmSync(UPLOADED, { recursive: true, force: true });
    return res.status(400).json({ error: `Read ${next.companies.length} companies and ${next.facts.length} facts. Check that files have tickers and values.` });
  }
  dataDir = UPLOADED; universe = next; clearCache();
  res.json({ ok: true, companies: universe.companies.length, facts: universe.facts.length });
});

app.post('/api/data/reset', (req, res) => {
  rmSync(UPLOADED, { recursive: true, force: true });
  dataDir = pickDir(); universe = loadFromDir(dataDir); clearCache();
  res.json({ ok: true });
});

const dist = join(root, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => console.log(`[desk] API on http://localhost:${PORT}`));
