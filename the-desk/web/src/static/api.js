// In-browser stand-in for server/index.js: same endpoints, same pipeline, no backend.
// Patches fetch('/api/...') and EventSource('/api/run...') so App.jsx runs unchanged.
import { loadFromFiles, asOf } from '../../../server/data/loader.js';
import { buildFactSheet } from '../../../server/analytics.js';
import { runDesk, stressTest } from '../../../server/agents/pipeline.js';
import companiesJson from '../../../server/data/demo/companies.json?raw';
import pricesCsv from '../../../server/data/demo/prices.csv?raw';

const DEMO = [{ name: 'companies.json', content: companiesJson }, { name: 'prices.csv', content: pricesCsv }];
let universe = loadFromFiles(DEMO);
let demo = true;
const cache = new Map(); // key -> { report, events }
const running = new Set();
const ck = (t, a) => `${t}@${a || ''}`;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function universeInfo() {
  const cached = {};
  for (const c of universe.companies) { const r = cache.get(ck(c.ticker)); if (r) cached[c.ticker] = { conviction: r.report.conviction, stance: r.report.stance }; }
  return {
    sector: universe.sector, companies: universe.companies, live: false, model: null, demo, dataDir: demo ? 'demo' : 'uploaded',
    files: universe.files, factCount: universe.facts.length, kpis: Object.entries(universe.kpiMeta).map(([key, m]) => ({ key, ...m })),
    cached, periods: [...new Set(universe.facts.map((f) => f.period))], static: true,
  };
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
  const body = init.body ? JSON.parse(init.body) : {};
  const p = url.pathname;
  try {
    if (p === '/api/universe') return json(universeInfo());
    if (p.startsWith('/api/report/')) {
      const r = cache.get(ck(decodeURIComponent(p.split('/').pop()), url.searchParams.get('asOf')));
      return r ? json(r.report) : json({ error: 'Not run yet' }, 404);
    }
    if (p.startsWith('/api/facts/')) { const fs = buildFactSheet(universe, decodeURIComponent(p.split('/').pop())); return json({ facts: fs.facts, signals: fs.signals, price: fs.price }); }
    if (p === '/api/stress') return json(await stressTest(universe, body.ticker, String(body.thesis || '').slice(0, 4000)));
    if (p === '/api/data') {
      const next = loadFromFiles((body.files || []).filter((f) => /\.(json|csv)$/i.test(f.name)));
      if (!next.companies.length || !next.facts.length) return json({ error: `Read ${next.companies.length} companies and ${next.facts.length} facts. Check that files have tickers and values.` }, 400);
      universe = next; demo = false; cache.clear();
      return json({ ok: true, companies: universe.companies.length, facts: universe.facts.length });
    }
    if (p === '/api/data/reset') { universe = loadFromFiles(DEMO); demo = true; cache.clear(); return json({ ok: true }); }
    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: e.message }, 400); }
};

class LocalEventSource {
  constructor(u) {
    this.onmessage = null; this.onerror = null; this.closed = false;
    const url = new URL(u, location.href);
    setTimeout(() => this.#run(url), 0);
  }
  close() { this.closed = true; }
  #send(e) { if (!this.closed) this.onmessage?.({ data: JSON.stringify(e) }); }
  async #run(url) {
    const ticker = url.searchParams.get('ticker');
    const as = url.searchParams.get('asOf') || '';
    const key = ck(ticker, as);
    const cached = cache.get(key);
    if (url.searchParams.get('replay') === '1' && cached) {
      this.#send({ t: 'replay' });
      let prev = 0;
      for (const ev of cached.events) {
        if (this.closed) return;
        await new Promise((r) => setTimeout(r, Math.min(900, (ev.ms - prev) / 1.4)));
        prev = ev.ms; this.#send(ev.e);
      }
      return;
    }
    if (running.has(key)) return this.#send({ t: 'error', message: 'Already running for this ticker.' });
    running.add(key);
    const t0 = performance.now(), events = [];
    const emit = (e) => { events.push({ ms: performance.now() - t0, e }); this.#send(e); };
    try {
      const u = as ? asOf(universe, as) : universe;
      let after = null;
      if (as) {
        const cut = u.prices[ticker] || [], full = universe.prices[ticker] || [];
        const from = cut[cut.length - 1], to = full[full.length - 1];
        if (from && to && to.date > from.date) after = { from, to, ret: ((to.close - from.close) / from.close) * 100 };
      }
      const report = await runDesk(u, ticker, (e) => { if (e.t === 'done') { e.report.asOf = as || null; e.report.after = after; } emit(e); }, { signal: { get aborted() { return false; } } });
      cache.set(key, { report, events });
    } catch (e) { emit({ t: 'error', message: e.message }); }
    finally { running.delete(key); }
  }
}
window.EventSource = LocalEventSource;
