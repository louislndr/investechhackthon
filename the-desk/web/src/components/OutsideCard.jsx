import React from 'react';
import { AGENTS, stanceColor } from '../agents.js';

const ORDER = ['researcher', 'kpi', 'bull', 'bear', 'skeptic', 'editor', 'genesis'];

// What you see from the street: the company, its index, the call, and how far the team has got.
export default function OutsideCard({ company, run, onRun, onReport, onStress, onEnter, cached }) {
  const running = run.status === 'running';
  const rep = run.report;
  const working = ORDER.filter((a) => run.agents[a]?.status === 'working');
  return (
    <aside className="card">
      <h2>{company.name}</h2>
      <div className="plaque-meta">{company.ticker}{company.exchange ? `, ${company.exchange}` : ''}</div>
      {company.sector && <div className="plaque-index">Candidate for <b>{company.sector}</b></div>}
      <div className="card-status">
        {running ? <>Working now: <b>{working.map((a) => AGENTS[a].name).join(' and ') || 'Genesis'}</b>. Hover a floor and go in to watch.</>
          : rep ? <><span className={`decision d-${rep.decision?.call}`}>{rep.decision?.label}</span> <b style={{ color: stanceColor(rep.conviction) }}>{rep.conviction}</b> conviction</>
            : 'Not researched yet. Start the research, then go inside to watch the analysts work.'}
      </div>
      {(running || rep) && (
        <div className="card-progress" aria-hidden="true">
          {ORDER.map((a) => <i key={a} style={{ '--c': AGENTS[a].color }} className={run.agents[a]?.status === 'working' ? 'on' : run.agents[a]?.status === 'done' ? 'done' : ''} />)}
        </div>
      )}
      <div className="controls">
        <button className="btn go" disabled={running} onClick={() => onRun()}>{running ? 'The team is working' : rep ? 'Run the team again' : 'Run the team'}</button>
        {cached && !running && <button className="btn" onClick={() => onRun({ replay: true })}>Replay last run</button>}
        <button className="btn" onClick={onEnter}>Go inside</button>
        <button className="btn" disabled={!rep} onClick={onReport}>One-pager</button>
        <button className="btn" onClick={onStress}>Test a pitch</button>
      </div>
    </aside>
  );
}
