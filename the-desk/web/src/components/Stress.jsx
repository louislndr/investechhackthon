import React, { useState } from 'react';
import { FactsContext, ClaimCard } from './Segments.jsx';

const EXAMPLE = (name, sector = '') => /acquirer/i.test(sector)
  ? `${name} belongs in the index. It keeps buying businesses, revenue is growing fast and it throws off plenty of free cash flow.`
  : `${name} belongs in the index. Occupancy is rock solid, the payout is safe and same-property NOI growth is accelerating.`;

export default function Stress({ ticker, company, onClose }) {
  const [thesis, setThesis] = useState(EXAMPLE(company?.name?.split(' ')[0] || ticker, company?.sector));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker, thesis }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <FactsContext.Provider value={res?.facts || {}}>
      <div className="modal" onClick={onClose}>
        <div className="stress" onClick={(e) => e.stopPropagation()}>
          <div className="stress-head"><div><h2>Test a pitch</h2><p className="muted">The Skeptic checks each claim in your pitch against the data on {company?.name}.</p></div><button className="close" onClick={onClose} aria-label="Close">×</button></div>
          <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} placeholder="Paste your thesis..." />
          <div className="row"><button className="btn primary" disabled={busy || thesis.trim().length < 8} onClick={go}>{busy ? 'Checking' : 'Check my pitch'}</button>{err && <span className="neg">{err}</span>}</div>
          {res && (
            <>
              <div className="stress-score"><span style={{ color: res.score >= 70 ? '#1f6f4a' : res.score >= 40 ? '#b07f00' : '#c8312b' }}>{res.score}%</span> of your pitch holds up against the data.</div>
              <div className="stack">{res.claims.map((c) => <ClaimCard key={c.id} c={{ ...c, resolved: c.evidence, reasonResolved: { segments: [{ type: 'text', text: c.reason }] } }} />)}</div>
            </>
          )}
        </div>
      </div>
    </FactsContext.Provider>
  );
}
