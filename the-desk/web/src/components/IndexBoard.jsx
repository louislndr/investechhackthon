import React, { useState } from 'react';
import { stanceColor } from '../agents.js';

// The mission view: both indexes, every Canadian candidate, the call and the main reason.
export default function IndexBoard({ universe, runs, onClose, onOpen, onRunIndex }) {
  const [busy, setBusy] = useState(null);
  const info = (t) => {
    const r = runs[t];
    const rep = r?.report;
    const cached = universe.cached?.[t];
    return { running: r?.status === 'running', conv: rep?.conviction ?? cached?.conviction, decision: rep?.decision ?? cached?.decision, reason: rep?.topReason ?? cached?.topReason };
  };
  return (
    <div className="modal" onClick={onClose}>
      <div className="board" onClick={(e) => e.stopPropagation()}>
        <div className="stress-head">
          <div><h2>Completing Onesheet's indexes with Canada</h2><p className="muted">Each candidate is researched by the team and judged against the index thesis. Every reason is sourced.</p></div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {universe.indexes.map((ix) => {
          const rows = ix.tickers.map((t) => ({ t, c: universe.companies.find((x) => x.ticker === t), ...info(t) }));
          const adds = rows.filter((r) => r.decision?.call === 'add' || r.decision?.call === 'small');
          return (
            <section key={ix.key} className="board-ix">
              <div className="board-ix-head">
                <div>
                  <h3>{ix.name}</h3>
                  <p className="muted">{ix.thesis}</p>
                </div>
                <button className="btn go" disabled={busy === ix.key} onClick={async () => { setBusy(ix.key); await onRunIndex(ix.tickers); setBusy(null); }}>{busy === ix.key ? 'Researching' : 'Research all 5'}</button>
              </div>
              <table className="board-table">
                <thead><tr><th>Candidate</th><th>Call</th><th>Conviction</th><th>Main reason</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.t}>
                      <td><b>{r.c?.name}</b><div className="muted small">{r.t}</div></td>
                      <td>{r.running ? <span className="muted">Researching</span> : r.decision ? <span className={`decision d-${r.decision.call}`}>{r.decision.label}</span> : <span className="muted">Not run</span>}</td>
                      <td>{r.conv != null ? <span style={{ color: stanceColor(r.conv), fontWeight: 700 }}>{r.conv}</span> : '–'}</td>
                      <td className="small">{r.reason || ''}</td>
                      <td><button className="btn" onClick={() => onOpen(r.t)}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.every((r) => r.decision) && <p className="board-sum">Add {adds.map((a) => a.c?.name).join(', ') || 'none'}. Pass on {rows.filter((r) => r.decision?.call === 'pass').map((a) => a.c?.name).join(', ') || 'none'}.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
