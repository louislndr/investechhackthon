// Genesis (the CEO) orchestrates the desk:
//   Genesis plans -> Researcher + KPI Analyst (parallel) -> Bull + Bear (parallel)
//   -> Skeptic fact-checks -> Editor builds the one-pager -> Genesis signs off.
// Every step emits events so the city/tower UI can animate in real time.
import { buildFactSheet, factSheetText } from '../analytics.js';
import { resolve, checkClaim, VERDICT_WEIGHT } from '../refs.js';
import { glossFor } from '../sectors.js';
import { LIVE, callAgent } from '../llm.js';
import { sys, companyBlock, SCHEMAS } from './prompts.js';
import * as mock from './mock.js';
import { INDEXES } from '../data/onesheet.js';

// Index committee call from the fact-checked conviction score.
export function decide(conviction) {
  if (conviction >= 58) return { call: 'add', label: 'Add to the index' };
  if (conviction >= 42) return { call: 'small', label: 'Add at a small weight' };
  return { call: 'pass', label: 'Pass for now' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPEED = Number(process.env.MOCK_SPEED || 1);

const arr = (x) => (Array.isArray(x) ? x : x == null || x === '' ? [] : typeof x === 'string' ? x.split(/\s*[,;\n]\s*/).filter(Boolean) : [x]);
const str = (x) => (x == null ? '' : typeof x === 'string' ? x : Array.isArray(x) ? x.join(' ') : typeof x === 'object' ? Object.values(x).join(' ') : String(x));
// Live models sometimes return a string where we asked for a list (or vice versa). Normalize
// every agent's output before anything renders it.
function normalize(id, o) {
  o = o && typeof o === 'object' ? o : {};
  switch (id) {
    case 'genesis': return { brief: str(o.brief), focus_kpis: arr(o.focus_kpis).map(str), notes_for_team: str(o.notes_for_team) };
    case 'researcher': return { overview: str(o.overview), how_it_makes_money: str(o.how_it_makes_money), key_terms: arr(o.key_terms).filter((t) => t && typeof t === 'object').map((t) => ({ term: str(t.term), plain: str(t.plain) })) };
    case 'kpi': return { picks: arr(o.picks).map((p) => (typeof p === 'string' ? { key: p } : p || {})).map((p) => ({ key: str(p.key || p.kpi || p.label), why_it_matters: str(p.why_it_matters), how_to_read: str(p.how_to_read) })), peer_summary: str(o.peer_summary) };
    case 'bull': case 'bear': return { claims: arr(o.claims).map((c) => (typeof c === 'string' ? { text: c } : c || {})).map((c) => {
      const text = str(c.text ?? c.claim ?? c.evidence);
      const derived = text.replace(/\[\[?[^\]]*\]\]?/g, '').replace(/\s+([.,;:])/g, '$1').split(/\s+/).slice(0, 6).join(' ').replace(/[.,;:\s]+$/, '');
      return { title: str(c.title || c.headline || (c.text != null ? c.claim : '')) || derived || 'Untitled point', text };
    }) };
    case 'editor': return { headline: str(o.headline), summary: str(o.summary), risks: arr(o.risks).map(str), what_to_watch: arr(o.what_to_watch).map((w) => (typeof w === 'string' ? { key: w, why: '' } : { key: str(w?.key), why: str(w?.why) })) };
    default: return o;
  }
}

export const AGENTS = ['genesis', 'researcher', 'kpi', 'bull', 'bear', 'skeptic', 'editor'];

export async function runDesk(universe, ticker, emit, { signal } = {}) {
  const c = universe.companies.find((x) => x.ticker === ticker);
  if (!c) throw new Error(`Unknown ticker ${ticker}`);
  const fs = buildFactSheet(universe, ticker);
  const fsText = factSheetText(fs);
  const hints = fs.signals.map((s) => { const g = glossFor(s.key, s.label); return `- ${s.key} (${s.label}): ${g.plain} ${g.good}`; }).join('\n');
  const ctx = companyBlock(c, universe, fsText, hints);

  const status = (agent, st, note = '') => emit({ t: 'status', agent, status: st, note });
  const log = (agent, text) => emit({ t: 'log', agent, text });
  const packet = (from, to, label) => emit({ t: 'packet', from, to, label });

  // Simulated typing for offline mode so floors look alive.
  async function type(agent, text) {
    const chunks = text.match(/.{1,28}/gs) || [];
    for (const ch of chunks) {
      if (signal?.aborted) throw new Error('aborted');
      emit({ t: 'stream', agent, text: ch });
      await sleep((70 + Math.random() * 60) / SPEED);
    }
    emit({ t: 'stream', agent, text: '\n' });
  }

  async function agent(id, { role, user, schema, offline, narrate }) {
    status(id, 'working');
    let out;
    if (LIVE) {
      try {
        out = await callAgent({ system: sys(role), user, schema, signal, onText: (t) => emit({ t: 'stream', agent: id, text: t }) });
      } catch (e) {
        if (signal?.aborted) throw e;
        // Stage safety: a failed API call never kills the run.
        log(id, `Live call failed (${String(e.message).slice(0, 80)}). Switching to offline mode for this step.`);
        out = offline();
        await type(id, pretty(out));
      }
    } else {
      for (const line of narrate || []) { log(id, line); await sleep(380 / SPEED); }
      out = offline();
      await type(id, pretty(out));
    }
    out = normalize(id, out);
    emit({ t: 'result', agent: id, data: out });
    status(id, 'done');
    return out;
  }

  // ---- 1. Genesis plans
  emit({ t: 'start', ticker, company: c, factCount: fs.facts.length, live: LIVE });
  status('vault', 'working');
  log('genesis', `New assignment: ${c.name} (${c.ticker}).`);
  packet('genesis', 'vault', 'request data');
  await sleep(500 / SPEED);
  log('vault', `Loaded ${fs.facts.length} sourced facts for ${c.ticker}.`);
  packet('vault', 'genesis', `${fs.facts.length} facts`);
  emit({ t: 'result', agent: 'vault', data: { facts: fs.facts, signals: fs.signals.map(({ history, ...s }) => ({ ...s, history })), price: fs.price } });
  status('vault', 'done');
  await sleep(400 / SPEED);

  const plan = await agent('genesis', {
    role: 'Genesis, the CEO and orchestrator. You read the assignment and brief your team',
    user: `${ctx}\n\nDecide which three to five KPIs the team should focus on for this company and brief them.`,
    schema: SCHEMAS.plan,
    offline: () => mock.plan(c, fs),
    narrate: ['Reading the fact sheet...', 'Deciding what matters for this sector...', 'Briefing the team.'],
  });
  status('genesis', 'waiting', 'Supervising the team');

  // ---- 2. Researcher + KPI Analyst in parallel
  packet('genesis', 'researcher', 'brief');
  packet('genesis', 'kpi', `focus: ${(plan.focus_kpis || []).slice(0, 3).join(', ')}`);
  const [research, kpiOut] = await Promise.all([
    agent('researcher', {
      role: 'the Researcher. You explain the business to someone who has never heard of it',
      user: `${ctx}\n\nCEO brief: ${plan.brief}\nExplain the business in plain English.`,
      schema: SCHEMAS.researcher,
      offline: () => mock.researcher(c, fs),
      narrate: ['Reading the company description...', 'Translating jargon into plain English...'],
    }),
    agent('kpi', {
      role: 'the KPI Analyst. You pick the sector-specific numbers that actually matter (not just the usual ratios) and compare to peers',
      user: `${ctx}\n\nCEO brief: ${plan.brief}\nFocus KPIs: ${(plan.focus_kpis || []).join(', ')}\nPick three to five KPIs that matter most and summarize how the company compares to peers.`,
      schema: SCHEMAS.kpi,
      offline: () => mock.kpi(c, fs, plan),
      narrate: ['Scanning sector KPIs...', 'Ranking against peers...', 'Picking the numbers that matter.'],
    }),
  ]);
  const findSig = (k) => fs.signals.find((s) => s.key === k || s.label.toLowerCase() === String(k).toLowerCase() || s.key === String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  let picks = kpiOut.picks.filter((p) => findSig(p.key)).map((p) => ({ ...p, key: findSig(p.key).key }));
  if (!picks.length) picks = mock.kpi(c, fs, plan).picks;
  if (resolve(kpiOut.peer_summary, fs).rawNumbers || !kpiOut.peer_summary) kpiOut.peer_summary = mock.kpi(c, fs, plan).peer_summary;
  const kpiTable = picks.map((p) => {
    const s = findSig(p.key);
    return { ...p, label: s.label, unit: s.unit, latestId: s.latestId, yoyId: s.yoyId || s.qoqId, rankId: s.rankId, trend: s.trend, peers: s.peers, history: s.history, hib: s.hib };
  });
  emit({ t: 'result', agent: 'kpi', data: { ...kpiOut, peer_summary_resolved: resolve(kpiOut.peer_summary, fs), table: kpiTable } });
  packet('researcher', 'genesis', 'overview');
  packet('kpi', 'genesis', `${kpiTable.length} KPIs`);
  await sleep(300 / SPEED);

  // ---- 3. Bull + Bear in parallel
  if (!research.overview || /\d/.test(research.overview.replace(/\b(19|20)\d\d\b/g, ''))) Object.assign(research, mock.researcher(c, fs), { key_terms: research.key_terms.length ? research.key_terms : mock.researcher(c, fs).key_terms });
  const caseCtx = `${ctx}\n\nRESEARCH: ${research.overview} ${research.how_it_makes_money}\nKPIs THAT MATTER: ${kpiTable.map((k) => k.label).join(', ')}`;
  packet('genesis', 'bull', 'build the case for');
  packet('genesis', 'bear', 'build the case against');
  const [bullOut, bearOut] = await Promise.all([
    agent('bull', {
      role: 'the Bull. You build the strongest honest case FOR the company',
      user: `${caseCtx}\n\nWrite three or four bull claims. Every claim must cite fact IDs.`,
      schema: SCHEMAS.claims,
      offline: () => mock.bull(c, fs),
      narrate: ['Hunting for strengths...', 'Drafting the buy case...'],
    }),
    agent('bear', {
      role: 'the Bear. You build the strongest honest case AGAINST the company',
      user: `${caseCtx}\n\nWrite three or four bear claims. Every claim must cite fact IDs.`,
      schema: SCHEMAS.claims,
      offline: () => mock.bear(c, fs),
      narrate: ['Looking for cracks...', 'Drafting the sell case...'],
    }),
  ]);

  // ---- 4. Skeptic
  const claims = [
    ...(bullOut.claims || []).map((x, i) => ({ id: `B${i + 1}`, side: 'bull', title: x.title, resolved: resolve(x.text, fs) })),
    ...(bearOut.claims || []).map((x, i) => ({ id: `R${i + 1}`, side: 'bear', title: x.title, resolved: resolve(x.text, fs) })),
  ];
  packet('bull', 'skeptic', `${bullOut.claims?.length || 0} claims`);
  packet('bear', 'skeptic', `${bearOut.claims?.length || 0} claims`);
  status('skeptic', 'working');
  for (const cl of claims) Object.assign(cl, checkClaim(cl, cl.side, fs));

  let llmChecks = {};
  if (LIVE) {
    const toJudge = claims.filter((x) => !['removed', 'unverifiable'].includes(x.verdict));
    const out = await callAgent({
      system: sys('the Skeptic. You fact-check every claim against the fact sheet and are hard to convince. A claim is supported only if the cited facts clearly back it'),
      user: `${ctx}\n\nCLAIMS TO CHECK:\n${toJudge.map((x) => `${x.id} (${x.side}): ${x.title} - ${x.resolved.text}`).join('\n')}`,
      schema: SCHEMAS.skeptic,
      signal,
      onText: (t) => emit({ t: 'stream', agent: 'skeptic', text: t }),
    }).catch(() => ({ checks: [] }));
    llmChecks = Object.fromEntries(arr(out?.checks).filter((x) => x && typeof x === 'object').map((x) => [str(x.claim_id || x.id), { verdict: str(x.verdict).toLowerCase().trim(), reason: str(x.reason) }]));
  } else {
    log('skeptic', `Checking ${claims.length} claims against ${fs.facts.length} facts...`);
    await sleep(500 / SPEED);
  }
  for (const cl of claims) {
    const lc = llmChecks[cl.id];
    if (lc && resolve(lc.reason, fs).rawNumbers) lc.reason = '';
    if (lc && !['removed', 'unverifiable'].includes(cl.verdict) && ['supported', 'weak', 'contradicted'].includes(lc.verdict)) {
      // Code and LLM disagree? Keep the stricter verdict.
      const order = ['supported', 'weak', 'contradicted'];
      cl.verdict = order[Math.max(order.indexOf(cl.verdict), order.indexOf(lc.verdict))];
      cl.reason = lc.reason;
    }
    cl.reason = cl.reason || mock.skepticReason(cl, cl, fs);
    cl.reasonResolved = resolve(cl.reason, fs);
    if (cl.reasonResolved.rawNumbers) cl.reasonResolved = resolve(mock.skepticReason(cl, cl, fs), fs);
    emit({ t: 'check', agent: 'skeptic', claim: cl });
    if (!LIVE) {
      const icon = { supported: '✅', weak: '⚠️', contradicted: '❌', removed: '🚫 REMOVED', unverifiable: '❓' }[cl.verdict];
      await type('skeptic', `${icon} ${cl.id} ${cl.title}`);
      await sleep(180 / SPEED);
    }
  }
  emit({ t: 'result', agent: 'skeptic', data: { claims } });
  status('skeptic', 'done');

  const keep = (side) => claims.filter((x) => x.side === side && ['supported', 'weak'].includes(x.verdict)).sort((a, b) => VERDICT_WEIGHT[b.verdict] - VERDICT_WEIGHT[a.verdict]);
  const bullOk = keep('bull'), bearOk = keep('bear');
  const score = (side) => claims.filter((x) => x.side === side).reduce((a, x) => a + Math.max(0, VERDICT_WEIGHT[x.verdict]), 0);
  const b = score('bull'), r = score('bear');
  const conviction = Math.round(Math.min(95, Math.max(5, 50 + (50 * (b - r)) / (b + r + 1))));

  // ---- 5. Editor
  packet('skeptic', 'editor', `${bullOk.length + bearOk.length} verified`);
  const ed = await agent('editor', {
    role: 'the Editor. You turn the verified research into a balanced one-page pitch',
    user: `${ctx}\n\nVERIFIED BULL POINTS:\n${bullOk.map((x) => `- ${x.title}: ${x.resolved.text}`).join('\n') || '- none'}\nVERIFIED BEAR POINTS:\n${bearOk.map((x) => `- ${x.title}: ${x.resolved.text}`).join('\n') || '- none'}\nWrite the one-pager.`,
    schema: SCHEMAS.editor,
    offline: () => mock.editor(c, fs, { bullOk, bearOk, kpiOut }),
    narrate: ['Collecting verified points...', 'Writing the one-pager...'],
  });

  // ---- 6. Genesis signs off
  packet('editor', 'genesis', 'draft one-pager');
  status('genesis', 'working', 'Final review');
  let verdict;
  if (LIVE) {
    verdict = (await callAgent({ system: sys('Genesis, the CEO, signing off on the report'), user: `${ctx}\n\nEDITOR SUMMARY: ${ed.summary}\nCONVICTION SCORE (computed): ${conviction} of 100\nWrite one final line.`, schema: SCHEMAS.verdict, signal, onText: (t) => emit({ t: 'stream', agent: 'genesis', text: t }) }).catch(() => ({}))).verdict_line;
  }
  if (!verdict || resolve(verdict, fs).rawNumbers) verdict = mock.verdictLine(c, conviction, bullOk, bearOk, INDEXES[c.indexKey]);
  if (!LIVE) await type('genesis', `Signed off. ${verdict}`);
  status('genesis', 'done');

  const report = {
    ticker, company: c, sector: c.sector || universe.sector, generatedAt: new Date().toISOString(), live: LIVE,
    conviction, stance: conviction >= 62 ? 'Leaning bullish' : conviction <= 38 ? 'Leaning bearish' : 'Mixed',
    index: INDEXES[c.indexKey] ? { key: c.indexKey, name: INDEXES[c.indexKey].name } : null,
    decision: decide(conviction),
    topReason: (bullOk[0] || bearOk[0])?.title || '',
    events: (c.events || []).slice(0, 6),
    headline: ed.headline && !/\d/.test(ed.headline) ? ed.headline : mock.editor(c, fs, { bullOk, bearOk, kpiOut }).headline,
    verdict: resolve(verdict, fs),
    summary: ed.summary && !resolve(ed.summary, fs).rawNumbers ? resolve(ed.summary, fs) : resolve(mock.editor(c, fs, { bullOk, bearOk, kpiOut }).summary, fs),
    overview: research.overview, howItMakesMoney: research.how_it_makes_money, keyTerms: research.key_terms || [],
    kpis: kpiTable, peerSummary: resolve(kpiOut.peer_summary, fs),
    bull: claims.filter((x) => x.side === 'bull'), bear: claims.filter((x) => x.side === 'bear'),
    risks: ed.risks.map((x) => resolve(x, fs)).filter((x) => !x.rawNumbers),
    watch: ed.what_to_watch.filter((w) => findSig(w.key)).map((w) => ({ key: findSig(w.key).key, why: w.why && !/\d/.test(w.why) ? w.why : glossFor(findSig(w.key).key, findSig(w.key).label).good, label: findSig(w.key).label }))
      .filter((w, i, a) => a.findIndex((x) => x.key === w.key) === i),
    removedCount: claims.filter((x) => x.verdict === 'removed').length,
    price: fs.price, priceSeries: (universe.prices[ticker] || []).map((p) => [p.date, p.close]),
    facts: fs.byId,
  };
  packet('genesis', 'city', `conviction ${conviction}`);
  emit({ t: 'done', report });
  return report;
}

// Stress-test a user's own thesis against the data.
export async function stressTest(universe, ticker, thesis) {
  const c = universe.companies.find((x) => x.ticker === ticker);
  if (!c) throw new Error(`Unknown ticker ${ticker}`);
  const fs = buildFactSheet(universe, ticker);
  let raw;
  if (LIVE) {
    const hints = fs.signals.map((s) => `- ${s.key} (${s.label}): ${glossFor(s.key, s.label).plain}`).join('\n');
    raw = await callAgent({ system: sys('the Skeptic. A user pasted their stock pitch. Split it into its individual factual claims and find the facts that test each one'), user: `${companyBlock(c, universe, factSheetText(fs), hints)}\n\nUSER'S PITCH:\n"""${thesis}"""`, schema: SCHEMAS.stress })
      .then((o) => arr(o?.claims).map((x) => (typeof x === 'string' ? { text: x, stance: 'bull', evidence: '' } : x)))
      .catch(() => []);
    // Nothing usable from the model? Fall back to the offline matcher.
    if (!raw.some((x) => x && typeof x === 'object' && (x.text || x.claim))) raw = mock.stressClaims(thesis, fs);
    // Claims the model couldn't tie to data: try the keyword matcher before calling them unverifiable.
    raw = raw.map((x) => (x && typeof x === 'object' && !x.evidence && (x.text || x.claim) ? { ...x, ...mock.stressClaims(str(x.text || x.claim), fs)[0], text: str(x.text || x.claim) } : x));
  } else {
    raw = mock.stressClaims(thesis, fs);
  }
  const claims = arr(raw).filter((x) => x && typeof x === 'object').map((x) => ({ text: str(x.text || x.claim), stance: str(x.stance), evidence: str(x.evidence) })).map((x, i) => {
    const stance = x.stance === 'bear' ? 'bear' : 'bull';
    const cl = { id: `T${i + 1}`, side: stance, title: x.text, resolved: resolve(x.evidence || '', fs) };
    if (!x.evidence) Object.assign(cl, { verdict: 'unverifiable', reason: 'Nothing in the data covers this. Make it specific to a KPI, or back it up yourself.' });
    else Object.assign(cl, checkClaim(cl, stance, fs));
    if (cl.verdict === 'removed') { cl.verdict = 'unverifiable'; cl.reason = 'Could not match this to any sourced number.'; }
    cl.reason = cl.reason || ({ supported: 'Holds up.', weak: 'Only partly true. Expect pushback.', contradicted: 'The data says otherwise. Judges will catch this.' }[cl.verdict]);
    cl.evidence = cl.resolved;
    return cl;
  });
  const pts = claims.reduce((a, x) => a + ({ supported: 1, weak: 0.5 }[x.verdict] || 0), 0);
  return { ticker, claims, score: claims.length ? Math.round((100 * pts) / claims.length) : 0, facts: fs.byId };
}

function pretty(o, depth = 0) {
  const pad = '  '.repeat(depth);
  if (Array.isArray(o)) return o.map((x) => `${pad}• ${typeof x === 'object' ? pretty(x, depth + 1).trimStart() : x}`).join('\n');
  if (o && typeof o === 'object') return Object.entries(o).map(([k, v]) => (typeof v === 'object' ? `${pad}${k}:\n${pretty(v, depth + 1)}` : `${pad}${k}: ${v}`)).join('\n');
  return `${pad}${o}`;
}
