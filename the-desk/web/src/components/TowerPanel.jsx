import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS, stanceColor } from '../agents.js';
import { FactsContext, Segments, ClaimCard, Spark } from './Segments.jsx';

const lastLine = (a) => {
  const s = (a.stream || '').trim().split('\n').filter(Boolean).pop();
  return a.status === 'working' && s ? s : a.logs[a.logs.length - 1] || a.note || '';
};

function Terminal({ agent }) {
  const ref = useRef(null);
  useEffect(() => { ref.current && (ref.current.scrollTop = ref.current.scrollHeight); }, [agent.stream, agent.logs.length]);
  return (
    <div className="terminal" ref={ref}>
      {agent.logs.map((l, i) => <div key={i} className="t-log">› {l}</div>)}
      {agent.stream && <pre className="t-stream">{agent.stream}</pre>}
      {agent.status === 'working' && <span className="cursor">▍</span>}
      {!agent.logs.length && !agent.stream && agent.status === 'idle' && <div className="muted">Nobody on this floor yet. Press Run the team.</div>}
    </div>
  );
}

function Output({ id, run, onReport }) {
  const r = run.agents[id]?.result;
  const checks = run.checks;
  const rep = run.report;
  if (id === 'skeptic') {
    const list = r?.claims || checks;
    if (!list.length) return <Empty />;
    return <div className="stack">{list.map((c) => <ClaimCard key={c.id} c={c} showSide />)}</div>;
  }
  if (id === 'genesis') {
    if (!r && !rep) return <Empty />;
    return (
      <div className="stack">
        {rep && <div className="callout" style={{ '--c': stanceColor(rep.conviction) }}><div className="co-k">Final call: {rep.stance.toLowerCase()}, conviction {rep.conviction} of 100</div><Segments r={rep.verdict} /></div>}
        {r?.brief && <div><h4>Brief to the team</h4><p>{r.brief}</p></div>}
        {r?.focus_kpis && <div className="tagrow">{r.focus_kpis.map((k) => <span key={k} className="tag">{k}</span>)}</div>}
        {r?.notes_for_team && <p className="muted">{r.notes_for_team}</p>}
        {rep && <button className="btn primary" onClick={onReport}>Open the one-pager</button>}
      </div>
    );
  }
  if (!r) return <Empty />;
  if (id === 'researcher') return (
    <div className="stack">
      <p className="lead">{r.overview}</p>
      <p>{r.how_it_makes_money}</p>
      {r.key_terms?.length > 0 && <div><h4>Jargon, decoded</h4>{r.key_terms.map((t) => <div key={t.term} className="term"><b>{t.term}</b> {t.plain}</div>)}</div>}
    </div>
  );
  if (id === 'kpi') return (
    <div className="stack">
      {r.table ? (
        <table className="kpitable"><thead><tr><th>KPI</th><th>Latest</th><th>Change</th><th>Peers</th><th /></tr></thead>
          <tbody>{r.table.map((k) => (
            <tr key={k.key} title={k.why_it_matters}>
              <td><b>{k.label}</b><div className="muted small">{k.how_to_read}</div></td>
              <td><Segments r={{ segments: [{ type: 'ref', id: k.latestId }] }} /></td>
              <td>{k.yoyId ? <Segments r={{ segments: [{ type: 'ref', id: k.yoyId }] }} /> : '—'}</td>
              <td>{k.rankId ? <Segments r={{ segments: [{ type: 'ref', id: k.rankId }] }} /> : '—'}</td>
              <td><Spark values={k.history?.map((h) => h.value)} color={k.trend === 'improving' ? '#34d399' : k.trend === 'deteriorating' ? '#f87171' : '#94a3b8'} /></td>
            </tr>))}</tbody></table>
      ) : r.picks?.map((p) => <div key={p.key} className="term"><b>{p.key}</b> {p.why_it_matters}</div>)}
      {r.peer_summary_resolved && <p><Segments r={r.peer_summary_resolved} /></p>}
    </div>
  );
  if (id === 'bull' || id === 'bear') {
    const checked = Object.fromEntries(checks.map((c) => [c.id, c]));
    const prefix = id === 'bull' ? 'B' : 'R';
    return <div className="stack">{(r.claims || []).map((c, i) => {
      const cc = checked[`${prefix}${i + 1}`];
      return <ClaimCard key={i} c={cc || { side: id, title: c.title, resolved: { segments: [{ type: 'text', text: c.text }] } }} />;
    })}</div>;
  }
  if (id === 'editor') return (
    <div className="stack">
      <h3 className="headline">{rep?.headline || r.headline}</h3>
      {rep ? <p><Segments r={rep.summary} /></p> : <p>{r.summary}</p>}
      {rep?.risks?.length > 0 && <div><h4>Risks</h4><ul>{rep.risks.map((x, i) => <li key={i}><Segments r={x} /></li>)}</ul></div>}
      {rep && <button className="btn primary" onClick={onReport}>Open the one-pager</button>}
    </div>
  );
  if (id === 'vault') return (
    <table className="facttable"><thead><tr><th>ID</th><th>Fact</th><th>Value</th><th>Source</th></tr></thead>
      <tbody>{r.facts.map((f) => <tr key={f.id}><td className="muted">{f.id}</td><td>{f.desc || f.label}</td><td><b>{f.display}</b></td><td className="small">{f.source?.type}: {f.source?.doc}</td></tr>)}</tbody></table>
  );
  return <pre>{JSON.stringify(r, null, 2)}</pre>;
}
const Empty = () => <div className="muted">No output yet.</div>;

// A report loaded from an earlier session has no live events: rebuild each floor's output from it.
function hydrate(run) {
  const rep = run.report;
  if (!rep || run.status === 'running' || run.agents.genesis.result) return run;
  const done = (result) => ({ status: 'done', note: '', stream: '', logs: ['Loaded from the last run. Press Replay last run to watch it again.'], result });
  return {
    ...run,
    checks: [...rep.bull, ...rep.bear],
    agents: {
      genesis: done(null),
      researcher: done({ overview: rep.overview, how_it_makes_money: rep.howItMakesMoney, key_terms: rep.keyTerms }),
      kpi: done({ table: rep.kpis, peer_summary_resolved: rep.peerSummary }),
      bull: done({ claims: rep.bull.map((x) => ({ title: x.title, text: x.resolved.text })) }),
      bear: done({ claims: rep.bear.map((x) => ({ title: x.title, text: x.resolved.text })) }),
      skeptic: done({ claims: [...rep.bull, ...rep.bear] }),
      editor: done({ headline: rep.headline }),
      vault: done({ facts: Object.values(rep.facts || {}) }),
    },
  };
}


const DIRECTORY = [
  ['6', 'genesis'], ['5', 'editor'], ['4', 'skeptic'], ['3', 'bull'], ['3', 'bear'], ['2', 'kpi'], ['1', 'researcher'], ['B', 'vault'],
];
const STATUS_TEXT = { idle: 'Empty', queued: 'Queued', working: 'Working', waiting: 'Supervising', done: 'Done', error: 'Error' };

export default function TowerPanel({ universe, ticker, asOf, setAsOf, run: rawRun, onClose, onRun, onReport, onStress, cached, sel: selProp, onSel }) {
  const run = useMemo(() => hydrate(rawRun), [rawRun]);
  const c = universe.companies.find((x) => x.ticker === ticker);
  const [selLocal, setSelLocal] = useState('genesis');
  const sel = selProp || selLocal;
  const setSel = onSel || setSelLocal;
  const running = run.status === 'running';
  const rep = run.report;
  const facts = useMemo(() => {
    const vf = run.agents.vault?.result?.facts;
    return rep?.facts || (vf ? Object.fromEntries(vf.map((f) => [f.id, f])) : {});
  }, [rep, run.agents.vault?.result]);
  // Follow the action: while running, show whichever floor just started working.
  const working = Object.entries(run.agents).filter(([, a]) => a.status === 'working').map(([k]) => k);
  const follow = useRef(true);
  useEffect(() => { if (running && follow.current && working.length) setSel(working[working.length - 1]); }, [running, working.join()]);
  useEffect(() => { follow.current = true; }, [ticker]);
  const periods = [...new Set(universe.periods || [])].filter((p) => /Q[1-4]/.test(p)).sort();
  const conv = rep?.conviction;
  const a = run.agents[sel];
  const m = AGENTS[sel];

  return (
    <FactsContext.Provider value={facts}>
      <aside className="panel" aria-label={`${c?.name} research tower`}>
        <header className="plaque">
          <div className="plaque-top">
            <h2>{c?.name}</h2>
            {onClose && <button className="close" onClick={onClose} aria-label="Close">×</button>}
          </div>
          <div className="plaque-meta">{ticker}{c?.exchange ? `, ${c.exchange}` : ''}</div>
          {c?.description && <p className="plaque-desc">{c.description}</p>}
        </header>

        <div className="controls">
          <button className="btn go" disabled={running} onClick={() => { follow.current = true; onRun(); }}>{running ? 'The team is working' : rep ? 'Run the team again' : 'Run the team'}</button>
          {cached && !asOf && !running && <button className="btn" onClick={() => { follow.current = true; onRun({ replay: true }); }} title="Plays the last run again, no AI calls">Replay last run</button>}
          <button className="btn" disabled={!rep} onClick={onReport}>One-pager</button>
          <button className="btn" onClick={onStress}>Test a pitch</button>
          <label className="asof">
            <span>Data as of</span>
            <select value={asOf} onChange={(e) => setAsOf(e.target.value)} disabled={running}>
              <option value="">Today</option>
              {periods.slice(0, -1).map((p) => <option key={p} value={p}>{p.replace('-', ' ')}</option>)}
            </select>
          </label>
        </div>

        {asOf && (
          <p className="timetravel">
            Time travel: the team only sees what was published by {asOf.replace('-', ' ')}.{' '}
            {rep?.after
              ? <>It called it {rep.stance.toLowerCase()} at {rep.conviction}. Afterwards the units moved <b className={rep.after.ret >= 0 ? 'pos' : 'neg'}>{rep.after.ret >= 0 ? '+' : ''}{rep.after.ret.toFixed(1)}%</b> by {rep.after.to.date}.</>
              : 'Run the team, then see what happened next.'}
          </p>
        )}

        <div className="gauge" aria-label={`Conviction ${conv ?? 'not set'}`}>
          <div className="gauge-bar"><i style={{ width: `${conv ?? 0}%`, background: stanceColor(conv) }} /></div>
          <div className="gauge-text">{conv != null ? <><b>{conv}</b> conviction, {rep.stance.toLowerCase()}</> : running ? 'The team is researching' : 'Not researched yet'}</div>
        </div>

        <nav className="directory" aria-label="Floors">
          <div className="dir-head"><span>Directory</span><span>{run.factCount || Object.keys(facts).length || 0} facts on file</span></div>
          {DIRECTORY.map(([floor, id]) => {
            const ag = run.agents[id];
            return (
              <button key={id} className={`dir-row ${sel === id ? 'on' : ''} st-${ag.status}`} onClick={() => { follow.current = false; setSel(id); }}>
                <span className="dir-floor">{floor}</span>
                <span className="dir-chip" style={{ background: AGENTS[id].color }} />
                <span className="dir-name">{AGENTS[id].name}</span>
                <span className="dir-role">{AGENTS[id].role}</span>
                <span className="dir-status">{STATUS_TEXT[ag.status] || ag.status}</span>
              </button>
            );
          })}
        </nav>

        <section className="floor" style={{ '--c': m.color }}>
          <h3><span className="floor-no">{DIRECTORY.find(([, id]) => id === sel)?.[0]}</span>{m.name}</h3>
          <p className="floor-blurb">{m.blurb}</p>
          <Terminal agent={a} />
          <div className="floor-out"><Output id={sel} run={run} onReport={onReport} /></div>
          {run.status === 'error' && <p className="neg">The run stopped: {run.error}</p>}
        </section>
      </aside>
    </FactsContext.Provider>
  );
}
