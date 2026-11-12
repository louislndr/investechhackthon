import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Exterior from './components/Exterior.jsx';
import Office from './components/Office.jsx';
import TowerPanel from './components/TowerPanel.jsx';
import Report from './components/Report.jsx';
import Stress from './components/Stress.jsx';
import { TOWER_AGENTS } from './agents.js';

const blankAgents = () => Object.fromEntries([...TOWER_AGENTS, 'vault'].map((a) => [a, { status: 'idle', note: '', stream: '', logs: [], result: null }]));
const blankRun = () => ({ status: 'idle', agents: blankAgents(), packets: [], checks: [], report: null, replay: false, error: null });
export const runKey = (ticker, asOf) => (asOf ? `${ticker}@${asOf}` : ticker);

let pid = 0;
function reducer(state, a) {
  if (a.type === 'reset') return {};
  if (a.type === 'dropPacket') {
    const r = state[a.key]; if (!r) return state;
    return { ...state, [a.key]: { ...r, packets: r.packets.filter((p) => p.id !== a.id) } };
  }
  const r = state[a.key] || blankRun();
  if (a.type === 'begin') return { ...state, [a.key]: { ...blankRun(), status: 'running', replay: a.replay } };
  if (a.type === 'report') return { ...state, [a.key]: { ...r, report: a.report, status: r.status === 'running' ? r.status : 'done' } };
  if (a.type !== 'event') return state;
  const e = a.e;
  const agents = { ...r.agents };
  const up = (id, patch) => { if (!agents[id]) return; agents[id] = { ...agents[id], ...patch(agents[id]) }; };
  let next = { ...r, agents };
  switch (e.t) {
    case 'replay': next.replay = true; break;
    case 'start': next.live = e.live; next.factCount = e.factCount; break;
    case 'status': up(e.agent, () => ({ status: e.status, note: e.note || '' })); break;
    case 'log': up(e.agent, (x) => ({ logs: [...x.logs, e.text].slice(-30) })); break;
    case 'stream': up(e.agent, (x) => ({ stream: (x.stream + e.text).slice(-8000) })); break;
    case 'result': up(e.agent, () => ({ result: e.data })); break;
    case 'check': next.checks = [...r.checks, e.claim]; break;
    case 'packet': next.packets = [...r.packets, { id: e.pid, from: e.from, to: e.to, label: e.label }].slice(-12); break;
    case 'done': next.report = e.report; next.status = 'done'; break;
    case 'error': next.status = 'error'; next.error = e.message; break;
  }
  return { ...state, [a.key]: next };
}

export default function App() {
  const [universe, setUniverse] = useState(null);
  const [runs, dispatch] = useReducer(reducer, {});
  const [view, setView] = useState({ name: 'city' });
  const [modal, setModal] = useState(null); // { type: 'report'|'stress', key, ticker }
  const [toast, setToast] = useState('');
  const [floor, setFloor] = useState('genesis');
  const [inside, setInside] = useState(false);
  const sources = useRef({});
  const fileRef = useRef(null);

  const loadUniverse = useCallback(async () => {
    const u = await fetch('/api/universe').then((r) => r.json());
    setUniverse(u);
    return u;
  }, []);
  useEffect(() => { loadUniverse().catch(() => setToast('API not reachable. Is the server running (npm run dev)?')); }, [loadUniverse]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);

  const startRun = useCallback((ticker, { replay = false, asOf = '' } = {}) => new Promise((resolve) => {
    const key = runKey(ticker, asOf);
    sources.current[key]?.close();
    dispatch({ type: 'begin', key, replay });
    const qs = new URLSearchParams({ ticker, ...(asOf ? { asOf } : {}), ...(replay ? { replay: '1' } : {}) });
    const es = new EventSource(`/api/run?${qs}`);
    sources.current[key] = es;
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.t === 'packet') { e.pid = ++pid; const id = e.pid; setTimeout(() => dispatch({ type: 'dropPacket', key, id }), 1700); }
      dispatch({ type: 'event', key, e });
      if (e.t === 'done' || e.t === 'error') {
        es.close(); delete sources.current[key];
        if (e.t === 'error') setToast(`${ticker}: ${e.message}`);
        if (e.t === 'done') setUniverse((u) => u && !asOf ? { ...u, cached: { ...u.cached, [ticker]: { conviction: e.report.conviction, stance: e.report.stance } } } : u);
        resolve(e);
      }
    };
    es.onerror = () => { es.close(); delete sources.current[key]; dispatch({ type: 'event', key, e: { t: 'error', message: 'Connection lost' } }); resolve(null); };
  }), []);

  const runAll = useCallback(async () => {
    if (!universe) return;
    const queue = universe.companies.map((c) => c.ticker);
    const lanes = universe.live ? 2 : 3;
    await Promise.all(Array.from({ length: lanes }, async () => { while (queue.length) await startRun(queue.shift()); }));
    setToast('Every tower is finished. Click one to see inside.');
  }, [universe, startRun]);

  // A tower that was run in an earlier session: pull its cached report so the one-pager works.
  const ensureReport = useCallback(async (ticker, asOf = '') => {
    const key = runKey(ticker, asOf);
    if (runs[key]?.report) return;
    const res = await fetch(`/api/report/${encodeURIComponent(ticker)}${asOf ? `?asOf=${asOf}` : ''}`);
    if (res.ok) dispatch({ type: 'report', key, report: await res.json() });
  }, [runs]);

  const upload = useCallback(async (fileList) => {
    const files = await Promise.all([...fileList].map(async (f) => ({ name: f.name, content: await f.text() })));
    const res = await fetch('/api/data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files }) });
    const j = await res.json();
    if (!res.ok) return setToast(j.error || 'Upload failed');
    dispatch({ type: 'reset' }); await loadUniverse(); setView({ name: 'tower', ticker: null, asOf: '' });
    setToast(`Loaded ${j.companies} companies and ${j.facts} sourced facts.`);
  }, [loadUniverse]);
  const resetData = useCallback(async () => { await fetch('/api/data/reset', { method: 'POST' }); dispatch({ type: 'reset' }); await loadUniverse(); setToast('Back to the default dataset.'); }, [loadUniverse]);

  if (!universe) return <div className="boot"><div className="citysign"><div className="citysign-name">The Desk</div><div className="citysign-sub">{toast || 'Loading the city'}</div></div></div>;

  const ticker = view.ticker && universe.companies.some((c) => c.ticker === view.ticker) ? view.ticker : universe.companies[0]?.ticker;
  const asOf = view.asOf || '';
  const run = runs[runKey(ticker, asOf)] || blankRun();
  const company = universe.companies.find((c) => c.ticker === ticker);
  const pickStock = (t) => { if (universe.cached?.[t]) ensureReport(t); setView({ name: 'tower', ticker: t, asOf: '' }); };

  return (
    <div className="app">
      <div className="stage">
        {inside
          ? <Office run={run} picked={floor} onPick={setFloor} />
          : <Exterior run={run} company={company} onEnter={() => setInside(true)} />}
      </div>

      <header className="hud">
        <div className="brand">
          <div className="brand-name">The Desk</div>
          <div className="brand-sub">{inside ? 'Click any computer to see what that analyst is working on.' : 'One stock. Seven AI analysts. Every number sourced.'}</div>
        </div>
        <label className="stockpick">
          <span>Stock</span>
          <select value={ticker} onChange={(e) => pickStock(e.target.value)} disabled={run.status === 'running'}>
            {universe.companies.map((c) => <option key={c.ticker} value={c.ticker}>{c.name} ({c.ticker})</option>)}
          </select>
        </label>
        <button className="btn go" onClick={() => setInside((v) => !v)}>{inside ? 'Back outside' : 'Go inside the tower'}</button>
        <button className="btn quiet" onClick={() => fileRef.current?.click()}>Load Onesheet data</button>
        {!universe.demo && <button className="btn quiet" onClick={resetData}>Demo data</button>}
        <input ref={fileRef} type="file" accept=".json,.csv" multiple hidden onChange={(e) => e.target.files?.length && upload(e.target.files)} />
      </header>

      <div className="hud-notes">
        <span className="plate">{universe.live ? `Live AI agents (${universe.model})` : universe.static ? 'Offline agents, running in your browser' : 'Offline agents, no API key set'}</span>
        {universe.demo && <span className="plate">Demo data, fictional companies</span>}
      </div>

      {company && (
        <TowerPanel
          universe={universe}
          ticker={ticker}
          asOf={asOf}
          setAsOf={(a) => setView({ name: 'tower', ticker, asOf: a })}
          run={run}
          onRun={(opts) => startRun(ticker, { asOf, ...opts })}
          onReport={() => setModal({ type: 'report', key: runKey(ticker, asOf) })}
          onStress={() => setModal({ type: 'stress', ticker })}
          cached={!!universe.cached?.[ticker]}
          sel={floor}
          onSel={setFloor}
        />
      )}
      {modal?.type === 'report' && runs[modal.key]?.report && <Report report={runs[modal.key].report} onClose={() => setModal(null)} />}
      {modal?.type === 'stress' && <Stress ticker={modal.ticker} company={universe.companies.find((c) => c.ticker === modal.ticker)} onClose={() => setModal(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
