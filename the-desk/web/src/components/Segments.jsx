import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { VERDICT } from '../agents.js';

// Fact lookup for source chips (filled per tower / report).
export const FactsContext = createContext({});

const KIND_CLS = { value: 'k-val', change: 'k-chg', rank: 'k-rank', median: 'k-rank', price: 'k-px', return: 'k-px', sector: 'k-sec' };

export function Chip({ id, display }) {
  const facts = useContext(FactsContext);
  const f = facts?.[id];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  return (
    <span className={`srcchip ${KIND_CLS[f?.kind] || ''}`} ref={ref} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
      {display || f?.display}<sup>{id.slice(1)}</sup>
      {open && f && (
        <span className="srcpop" onClick={(e) => e.stopPropagation()}>
          <span className="sp-label">{f.label}</span>
          <span className="sp-val">{f.display}<span className="muted"> in {f.period}</span></span>
          <span className="sp-src"><b>{f.source?.type}:</b> {f.source?.doc}</span>
          {f.source?.note && <span className="sp-note">{f.source.note}</span>}
          {f.source?.url ? <a className="sp-link" href={f.source.url} target="_blank" rel="noreferrer">Open the source</a> : <span className="sp-note muted">Fact {f.id} in the Onesheet dataset</span>}
        </span>
      )}
    </span>
  );
}

export function Segments({ r }) {
  if (!r) return null;
  return (
    <>
      {r.segments.map((s, i) => s.type === 'text' ? <React.Fragment key={i}>{s.text}</React.Fragment>
        : s.type === 'ref' ? <Chip key={i} id={s.id} display={s.display} />
          : <span key={i} className="badref" title="This fact ID does not exist">[{s.id}?]</span>)}
    </>
  );
}

export function Verdict({ v, small }) {
  const m = VERDICT[v];
  if (!m) return null;
  return <span className={`verdict ${m.cls} ${small ? 'sm' : ''}`}>{m.icon} {m.label}</span>;
}

export function ClaimCard({ c, showSide }) {
  return (
    <div className={`claim ${c.verdict ? VERDICT[c.verdict]?.cls : ''} side-${c.side}`}>
      <div className="claim-head">
        {showSide && <span className={`side-tag ${c.side}`}>{c.side === 'bull' ? 'Bull' : 'Bear'}</span>}
        <b>{c.title}</b>
        {c.verdict && <Verdict v={c.verdict} small />}
      </div>
      <div className={`claim-body ${c.verdict === 'removed' ? 'struck' : ''}`}><Segments r={c.resolved} /></div>
      {c.reasonResolved && <div className="claim-reason"><span className="muted">Skeptic:</span> <Segments r={c.reasonResolved} /></div>}
    </div>
  );
}

export function Spark({ values, color = '#22d3ee', w = 90, h = 26 }) {
  if (!values?.length) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * (w - 4) + 2},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
  const last = pts.split(' ').pop().split(',');
  return (
    <svg width={w} height={h} className="spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

export function PriceChart({ series, w = 520, h = 120, color = '#a78bfa' }) {
  if (!series?.length) return null;
  const vals = series.map((p) => p[1]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const step = Math.max(1, Math.floor(series.length / 160));
  const pts = series.filter((_, i) => i % step === 0 || i === series.length - 1)
    .map((p, i, arr) => `${(i / Math.max(1, arr.length - 1)) * w},${h - 8 - ((p[1] - min) / span) * (h - 22)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="pricechart" preserveAspectRatio="none">
      <defs><linearGradient id="pcg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="url(#pcg)" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <text x="4" y="12" className="pc-lbl">${max.toFixed(2)}</text>
      <text x="4" y={h - 2} className="pc-lbl">${min.toFixed(2)}</text>
      <text x={w - 4} y={h - 2} textAnchor="end" className="pc-lbl">{series[series.length - 1][0]}</text>
      <text x={w / 2} y={h - 2} textAnchor="middle" className="pc-lbl">{series[0][0]} →</text>
    </svg>
  );
}
