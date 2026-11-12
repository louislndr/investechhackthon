// Offline agents: no API key needed. They write from the same fact sheet with the same rules
// (fact IDs only), so the whole pipeline, UI and fact-checking behave exactly like live mode.
import { glossFor } from '../sectors.js';

const by = (f) => (a, b) => f(b) - f(a);
const strength = (s) => (s.trend === 'improving' ? 1 : s.trend === 'deteriorating' ? -1 : 0) + (s.vsMedian || 0) + (s.rank && s.peerCount ? (s.rank <= Math.ceil(s.peerCount / 3) ? 0.5 : s.rank > s.peerCount - Math.ceil(s.peerCount / 3) ? -0.5 : 0) : 0);
const trendWord = (t, side) => (t === 'improving' ? 'improving' : t === 'deteriorating' ? 'getting worse' : 'roughly flat') + (side ? '' : '');

export function plan(c, fs) {
  const ranked = [...fs.signals].sort(by((s) => Math.abs(strength(s))));
  const focus = ranked.slice(0, 4).map((s) => s.key);
  return {
    brief: `${c.name} lives or dies on ${ranked.slice(0, 3).map((s) => s.label.toLowerCase()).join(', ')}. Those are moving the most, so the team should start there.`,
    focus_kpis: focus,
    notes_for_team: 'Researcher and KPI Analyst go first. Bull and Bear build cases only from the fact sheet. Skeptic checks every citation.',
  };
}

export function researcher(c, fs) {
  const terms = fs.signals.slice(0, 4).map((s) => ({ term: s.label, plain: glossFor(s.key, s.label).plain }));
  const desc = c.description || `${c.name} is one of the companies in this dataset.`;
  const [first, ...rest] = desc.split(/(?<=\.)\s+/);
  const moves = (c.events || []).slice(0, 3).map((e) => e.summary.split('. ')[0].replace(/\.$/, '')).join('. ');
  return {
    overview: first,
    how_it_makes_money: rest.join(' ') || (moves ? `Recent moves: ${moves}.` : 'The dataset does not describe the revenue model in detail.'),
    key_terms: terms,
  };
}

export function kpi(c, fs, planOut) {
  const focus = new Set(planOut?.focus_kpis || []);
  const ordered = [...fs.signals].sort(by((s) => (focus.has(s.key) ? 10 : 0) + Math.abs(strength(s))));
  const picks = ordered.slice(0, 5).map((s) => {
    const g = glossFor(s.key, s.label);
    return { key: s.key, why_it_matters: g.plain, how_to_read: g.good };
  });
  const best = [...fs.signals].filter((s) => s.rankId).sort((a, b) => a.rank - b.rank)[0];
  const worst = [...fs.signals].filter((s) => s.rankId).sort((a, b) => b.rank - a.rank)[0];
  const peer_summary = best && worst && best.key !== worst.key
    ? `Against peers, its strongest spot is ${best.label} at [[${best.latestId}]], ranking [[${best.rankId}]]. Its weakest is ${worst.label} at [[${worst.latestId}]], ranking [[${worst.rankId}]].`
    : 'Not enough peer data in this dataset to rank it.';
  return { picks, peer_summary };
}

function claimFor(s, side) {
  const g = glossFor(s.key, s.label);
  const parts = [`${s.label} is [[${s.latestId}]]`];
  if (s.yoyId) parts.push(`${trendWord(s.yoyTrend)} by [[${s.yoyId}]] over the year`);
  else if (s.qoqId) parts.push(`${trendWord(s.qoqTrend)} by [[${s.qoqId}]] last quarter`);
  let text = parts.join(', ') + '.';
  if (s.rankId) text += ` That ranks [[${s.rankId}]] among peers (median [[${s.medianId}]]).`;
  // Title must match what the data actually shows, not just the side we're arguing.
  const lagsPeers = s.vsMedian < 0 || (s.rank && s.rank > s.peerCount / 2);
  const leadsPeers = s.vsMedian > 0 || (s.rank && s.rank <= Math.ceil(s.peerCount / 3));
  let title;
  if (side === 'bull') title = s.trend === 'improving' ? g.up : leadsPeers ? `${s.label} leads peers` : `${s.label} is holding steady`;
  else title = s.trend === 'deteriorating' ? g.down : lagsPeers ? `${s.label} trails peers` : `${s.label} has little room to improve`;
  return { title, text };
}

export function bull(c, fs) {
  const good = [...fs.signals].sort(by(strength)).slice(0, 3);
  const claims = good.map((s) => claimFor(s, 'bull'));
  if (fs.price?.r1yId && fs.price.r1y > 0) claims.push({ title: 'The market is starting to notice', text: `The units are up [[${fs.price.r1yId}]] over the past year.` });
  // A deliberately unsourced, hype-y claim: the Skeptic should catch and remove it.
  claims.push({ title: 'Management sees huge upside', text: 'Management says growth could double next year as the strategy pays off.' });
  return { claims };
}

export function bear(c, fs) {
  const bad = [...fs.signals].sort(by((s) => -strength(s))).slice(0, 3);
  const claims = bad.map((s) => claimFor(s, 'bear'));
  if (fs.price?.r1yId && fs.price.r1y < 0) claims.push({ title: 'The market has already lost faith', text: `The units are down [[${fs.price.r1yId}]] over the past year.` });
  const sec = fs.sectorFacts.find((s) => s.trend === 'deteriorating');
  if (sec) claims.push({ title: 'The whole sector faces headwinds', text: `${sec.label} is [[${sec.id}]], which means more competition for tenants.` });
  return { claims };
}

export function skepticReason(check, claim, fs) {
  if (check.verdict === 'removed' || check.verdict === 'unverifiable') return check.reason;
  const ids = claim.resolved.refIds;
  const cite = ids.slice(0, 2).map((id) => `[[${id}]]`).join(' and ');
  if (check.verdict === 'supported') return `Checks out. ${cite} back this up.`;
  if (check.verdict === 'weak') return `Partly true. ${cite} point both ways, so don't lean on this alone.`;
  return `The data says the opposite. ${cite} undercut this claim.`;
}

export function editor(c, fs, { bullOk, bearOk, kpiOut }) {
  const b = bullOk[0], r = bearOk[0];
  const headline = bullOk.length > bearOk.length + 1 ? `${c.name}: the numbers mostly back the bulls` : bearOk.length > bullOk.length + 1 ? `${c.name}: the data leans against it` : `${c.name}: real strengths, real risks`;
  const summary = [
    b ? `The strongest verified point for: ${b.title.toLowerCase()}, ${b.resolved.refIds[0] ? `with ${b.title.toLowerCase().includes('market') ? 'the price' : 'the data'} at [[${b.resolved.refIds[0]}]]` : ''}.` : 'No bull claim survived fact-checking.',
    r ? `The strongest verified point against: ${r.title.toLowerCase()}${r.resolved.refIds[0] ? `, with [[${r.resolved.refIds[0]}]]` : ''}.` : 'No bear claim survived fact-checking.',
    `${bullOk.length} bull and ${bearOk.length} bear points survived the Skeptic.`.replace(/\d+/g, (n) => ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][Number(n)] || 'Several').replace(/ (One|Two|Three|Four|Five|Six|Zero|Several) bear/, (m) => m.toLowerCase()),
  ].map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
  const risks = bearOk.slice(0, 3).map((x) => `${x.title}: ${x.resolved.text.split('.')[0]}.`);
  const movers = [...fs.signals].sort(by((s) => Math.abs(s.yoy ?? s.qoq ?? 0))).slice(0, 3);
  const what_to_watch = movers.map((s) => ({ key: s.key, why: `${s.label} moved the most recently. ${glossFor(s.key, s.label).good}` }));
  return { headline, summary, risks, what_to_watch, picks: kpiOut?.picks };
}

export function verdictLine(c, conviction, bullOk, bearOk, ix) {
  const where = ix ? ` for the ${ix.name} index` : '';
  const why = bullOk[0] ? ` The strongest verified point: ${bullOk[0].title.toLowerCase()}.` : '';
  const risk = bearOk[0] ? ` Main risk: ${bearOk[0].title.toLowerCase()}.` : '';
  if (conviction >= 58) return `Add ${c.name}${where}. More of the case for it held up under fact-checking than the case against.${why}`;
  if (conviction >= 42) return `Add ${c.name}${where} at a small weight. The evidence is mixed.${why}${risk}`;
  return `Pass on ${c.name}${where} for now. The case against held up better.${risk}`;
}

// Offline stress test: split the user's thesis into claims, match each to a KPI by keywords.
const UP = /(ris|grow|increas|accelerat|higher|up\b|climb|expand|surg|improv|gain)/;
const DOWN = /(fall|declin|drop|lower|shrink|slow|decreas|down\b|shrinking|contract|stall)/;
const GOOD = /(strong|solid|safe|healthy|great|best|cheap|undervalued|love|leader|leading|covered|efficient|profitable)/;
const BAD = /(weak|risk|bad|stretched|unsafe|worse|losing|overvalued|expensive|too much|struggl|problem|concern|unprofitable|burning)/;
// Is the claim saying something good or bad about the company? Direction words flip for
// lower-is-better KPIs ("churn is falling" is good news).
function stanceOf(low, sig) {
  if (BAD.test(low)) return 'bear';
  if (GOOD.test(low)) return 'bull';
  const up = UP.test(low), down = DOWN.test(low);
  if (!up && !down) return 'bull';
  const hib = sig ? sig.hib : true;
  return (up && hib) || (down && !hib) ? 'bull' : 'bear';
}
export function stressClaims(thesis, fs) {
  const parts = thesis.split(/(?<=[.!?;])\s+|\s*,\s*(?:and\s+)?|\s+(?:and|but|while|because|plus)\s+/i).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 2);
  return parts.map((text) => {
    const low = text.toLowerCase();
    let best = null, bestScore = 0;
    for (const s of fs.signals) {
      const g = glossFor(s.key, s.label);
      const score = g.words.reduce((a, w) => a + (low.includes(w) ? w.length : 0), 0) + (low.includes(s.label.toLowerCase()) ? 10 : 0);
      if (score > bestScore) { best = s; bestScore = score; }
    }
    const stance = stanceOf(low, best);
    if (!best && /(price|stock|units|share|market|valuation|cheap)/.test(low) && fs.price?.r1yId) {
      return { text, stance, evidence: `The price has moved [[${fs.price.r1yId}]] over the past year, and [[${fs.price.r3mId || fs.price.r1yId}]] recently.` };
    }
    if (!best) return { text, stance, evidence: '' };
    const ids = [best.latestId, best.yoyId || best.qoqId, best.rankId].filter(Boolean);
    return { text, stance, evidence: `${best.label} is [[${ids[0]}]]${ids[1] ? `, a change of [[${ids[1]}]]` : ''}${ids[2] ? `, ranking [[${ids[2]}]] among peers` : ''}.`, key: best.key };
  });
}
