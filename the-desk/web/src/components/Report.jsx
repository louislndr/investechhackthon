import React from 'react';
import { FactsContext, Segments, Verdict, Spark, PriceChart } from './Segments.jsx';
import { stanceColor } from '../agents.js';

export default function Report({ report: r, onClose }) {
  const kept = (side) => r[side].filter((c) => ['supported', 'weak'].includes(c.verdict));
  const killed = [...r.bull, ...r.bear].filter((c) => !['supported', 'weak'].includes(c.verdict));
  const cited = new Set();
  const collect = (x) => x?.segments?.forEach((s) => s.type === 'ref' && cited.add(s.id));
  [r.summary, r.verdict, r.peerSummary, ...r.risks].forEach(collect);
  [...kept('bull'), ...kept('bear')].forEach((c) => collect(c.resolved));
  r.kpis.forEach((k) => [k.latestId, k.yoyId, k.rankId].forEach((id) => id && cited.add(id)));
  const sources = [...cited].map((id) => r.facts[id]).filter(Boolean).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const ref = (id) => (id ? <Segments r={{ segments: [{ type: 'ref', id }] }} /> : '—');

  return (
    <FactsContext.Provider value={r.facts}>
      <div className="modal" onClick={onClose}>
        <div className="modal-tools no-print" onClick={(e) => e.stopPropagation()}>
          {import.meta.env.VITE_STATIC
            ? <span className="chip-badge" title="Printing is blocked inside hosted pages">PDF export works in the local app</span>
            : <button className="btn primary" onClick={() => window.print()}>Save as PDF</button>}
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <article className="sheet" onClick={(e) => e.stopPropagation()}>
          <header className="sh-head">
            <div>
              <div className="sh-kicker">The Desk research note{r.asOf ? `, data as of ${r.asOf.replace('-', ' ')}` : ''}</div>
              <h1>{r.company.name}</h1><div className="sh-ticker">{r.ticker}{r.company.exchange ? `, ${r.company.exchange}` : ''}</div>
              {r.index && <div className="sh-index">Candidate for Onesheet's <b>{r.index.name}</b> index</div>}
              <div className="sh-headline">{r.headline}</div>
            </div>
            <div className="sh-conv" style={{ '--c': stanceColor(r.conviction) }}>
              <div className="ring" style={{ background: `conic-gradient(var(--c) ${r.conviction * 3.6}deg, #e5e7eb 0)` }}><span>{r.conviction}</span></div>
              <div className="sh-stance">{r.decision?.label || r.stance}</div>
              <div className="sh-small">conviction from fact-checked evidence</div>
            </div>
          </header>

          <section className="sh-verdict"><Segments r={r.verdict} /></section>

          <div className="sh-grid">
            <section>
              <h2>The business, in plain English</h2>
              <p>{r.overview}</p>
              <p className="sh-muted">{r.howItMakesMoney}</p>
            </section>
            <section>
              {r.priceSeries?.length > 0 ? <h2>Price</h2> : <h2>Recent moves</h2>}
              {!r.priceSeries?.length && <ul className="sh-events">{(r.events || []).slice(0, 4).map((e, i) => <li key={i}><b>{e.date}</b> {e.summary}</li>)}</ul>}
              <PriceChart series={r.priceSeries} w={360} h={96} color={stanceColor(r.conviction)} />
              <div className="sh-pxrow">
                {r.price?.lastId && <span>Last {ref(r.price.lastId)}</span>}
                {r.price?.r1yId && <span>1Y {ref(r.price.r1yId)}</span>}
                {r.price?.r3mId && <span>3M {ref(r.price.r3mId)}</span>}
              </div>
              {r.after && <div className="sh-after">What happened next: <b className={r.after.ret >= 0 ? 'pos' : 'neg'}>{r.after.ret >= 0 ? '+' : ''}{r.after.ret.toFixed(1)}%</b> to {r.after.to.date}</div>}
            </section>
          </div>

          <section>
            <h2>The numbers that matter for this sector</h2>
            <table className="sh-table">
              <thead><tr><th>KPI</th><th>What it tells you</th><th>Latest</th><th>Change</th><th>Vs peers</th><th>Trend</th></tr></thead>
              <tbody>{r.kpis.map((k) => (
                <tr key={k.key}>
                  <td><b>{k.label}</b></td>
                  <td className="sh-muted">{k.why_it_matters}</td>
                  <td>{ref(k.latestId)}</td><td>{ref(k.yoyId)}</td><td>{ref(k.rankId)}</td>
                  <td><Spark values={k.history?.map((h) => h.value)} w={70} h={22} color={k.trend === 'improving' ? '#059669' : k.trend === 'deteriorating' ? '#dc2626' : '#64748b'} /></td>
                </tr>))}</tbody>
            </table>
            <p className="sh-muted"><Segments r={r.peerSummary} /></p>
          </section>

          <div className="sh-cases">
            <section className="case bull">
              <h2>The case for</h2>
              {kept('bull').map((c) => <div key={c.id} className="sh-claim"><div><b>{c.title}</b> <Verdict v={c.verdict} small /></div><Segments r={c.resolved} /></div>)}
              {!kept('bull').length && <p className="sh-muted">No bull claim survived fact-checking.</p>}
            </section>
            <section className="case bear">
              <h2>The case against</h2>
              {kept('bear').map((c) => <div key={c.id} className="sh-claim"><div><b>{c.title}</b> <Verdict v={c.verdict} small /></div><Segments r={c.resolved} /></div>)}
              {!kept('bear').length && <p className="sh-muted">No bear claim survived fact-checking.</p>}
            </section>
          </div>

          <div className="sh-grid">
            <section>
              <h2>Summary</h2>
              <p><Segments r={r.summary} /></p>
              {r.risks.length > 0 && <><h3>Key risks</h3><ul>{r.risks.map((x, i) => <li key={i}><Segments r={x} /></li>)}</ul></>}
            </section>
            <section>
              <h2>What to watch next quarter</h2>
              <ul>{r.watch.map((w) => <li key={w.key}><b>{w.label}.</b> {w.why}</li>)}</ul>
              {killed.length > 0 && (
                <>
                  <h3>Thrown out by the Skeptic</h3>
                  <ul className="sh-killed">{killed.map((c) => <li key={c.id}><s>{c.title}</s> <Verdict v={c.verdict} small /></li>)}</ul>
                </>
              )}
            </section>
          </div>

          <section className="sh-sources">
            <h2>Sources</h2>
            <ol>{sources.map((f) => <li key={f.id} value={Number(f.id.slice(1))}><b>{f.label}</b>: {f.display} ({f.period}). {f.source?.type}: {f.source?.doc}{f.source?.note ? `. ${f.source.note}` : ''}</li>)}</ol>
          </section>
          <footer className="sh-foot">
            Generated {new Date(r.generatedAt).toLocaleString()} by The Desk ({r.live ? 'live AI agents' : 'offline agents'}) on Onesheet data. Every number links to a source; the AI never writes numbers itself. Educational research, not investment advice.
          </footer>
        </article>
      </div>
    </FactsContext.Provider>
  );
}
