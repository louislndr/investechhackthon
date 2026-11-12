// Turns agent text containing [[F12]] references into segments the UI renders as source chips.
// Anything that isn't a real fact ID becomes a "bad ref". Any digit written outside a reference
// is flagged: agents are not allowed to type numbers themselves.
import { toneOf } from './analytics.js';

// Accepts [[F3]], [F3] and [[F3, F4]] (models vary).
const REF = /\[\[?\s*(F\d+(?:\s*,\s*F\d+)*)\s*\]\]?/g;

export function resolve(text, fs) {
  const segments = [];
  const refIds = [], badRefs = [];
  let last = 0;
  const s = String(text || '');
  for (const m of s.matchAll(REF)) {
    if (m.index > last) segments.push({ type: 'text', text: s.slice(last, m.index) });
    m[1].split(/\s*,\s*/).forEach((id, j) => {
      const f = fs.byId[id];
      if (j) segments.push({ type: 'text', text: ', ' });
      if (f) { segments.push({ type: 'ref', id: f.id, display: f.display }); refIds.push(f.id); }
      else { segments.push({ type: 'badref', id }); badRefs.push(id); }
    });
    last = m.index + m[0].length;
  }
  if (last < s.length) segments.push({ type: 'text', text: s.slice(last) });
  // Digits inside KPI names (e.g. "delinquency (90+ days)") aren't numbers the agent made up.
  let base = s.replace(REF, '');
  for (const lbl of fs.labels || []) if (/\d/.test(lbl)) base = base.split(lbl).join('');
  const stripped = base.replace(/\bQ[1-4]\b/g, '').replace(/\b(19|20)\d\d\b/g, '').replace(/\bF\d+\b/g, '');
  const rawNumbers = /\d/.test(stripped);
  return { text: s, segments, refIds: [...new Set(refIds)], badRefs, rawNumbers };
}

// Code-level fact check. Runs in both live and offline mode, and always has the final say
// on removals (the LLM can't "approve" an unsourced claim).
export function checkClaim(claim, stance, fs) {
  const r = claim.resolved;
  if (r.rawNumbers) return { verdict: 'removed', reason: 'Uses a number that is not linked to any source.' };
  if (!r.refIds.length && r.badRefs.length) return { verdict: 'unverifiable', reason: `Cites data that doesn't exist (${r.badRefs.join(', ')}).` };
  if (!r.refIds.length) return { verdict: 'removed', reason: 'No data cited. Opinion, not evidence.' };
  const tones = r.refIds.map((id) => toneOf(fs, id)).filter((t) => t != null);
  if (!tones.length) return { verdict: 'weak', reason: 'Cites real data, but only context (no trend or comparison) so it proves little.' };
  const score = tones.reduce((a, b) => a + b, 0) / tones.length;
  const s = stance === 'bear' ? -score : score; // bear claims are "supported" when the data is bad
  const verdict = s >= 0.34 ? 'supported' : s > -0.34 ? 'weak' : 'contradicted';
  return { verdict, score: s, tones };
}

export const VERDICT_WEIGHT = { supported: 1, weak: 0.35, contradicted: -0.5, unverifiable: 0, removed: 0 };
