// Prompts for live (Claude API) mode. Every agent sees the same fact sheet and must cite
// fact IDs instead of writing numbers.
const RULES = `HARD RULES:
- Work ONLY from the FACT SHEET. Do not use outside knowledge about this company.
- NEVER type a number or digit yourself. To use any number, cite its fact ID in double brackets, e.g. "occupancy is [[F1]]". The app swaps in the sourced value.
- Only cite fact IDs that exist in the fact sheet.
- Plain English a first-year student understands. Short sentences. No hype.
- Respond with ONLY a JSON object matching the schema. No markdown, no commentary.`;

export function sys(role) {
  return `You are ${role} at "The Desk", an AI equity research team that builds sourced, one-page stock pitches.\n\n${RULES}`;
}

export function companyBlock(c, universe, fsText, glossaryHints) {
  return `COMPANY: ${c.name} (${c.ticker}${c.exchange ? `, ${c.exchange}` : ''})
SECTOR: ${c.sector || universe.sector}
DESCRIPTION (from the dataset): ${c.description || 'n/a'}
PEERS IN THIS DATASET: ${universe.companies.filter((x) => x.ticker !== c.ticker).map((x) => `${x.name} (${x.ticker})`).join(', ') || 'none'}

KPI HINTS (plain-English meaning):
${glossaryHints}

FACT SHEET (ID | what it is | value | source):
${fsText}`;
}

export const SCHEMAS = {
  plan: `{"brief": "one or two sentences: what matters most for this company and why", "focus_kpis": ["kpi_key", "..."], "notes_for_team": "one sentence of direction"}`,
  researcher: `{"overview": "two or three sentences, what the business is", "how_it_makes_money": "one or two sentences", "key_terms": [{"term": "...", "plain": "..."}]}`,
  kpi: `{"picks": [{"key": "kpi_key from the fact sheet", "why_it_matters": "one sentence", "how_to_read": "one sentence on what good looks like"}], "peer_summary": "two sentences comparing to peers, citing fact IDs"}`,
  claims: `{"claims": [{"title": "short punchy title, max eight words", "text": "one or two sentences citing fact IDs like [[F3]]"}]}`,
  skeptic: `{"checks": [{"claim_id": "B1", "verdict": "supported | weak | contradicted", "reason": "one sentence citing fact IDs"}]}`,
  editor: `{"headline": "max twelve words, balanced, not a buy/sell call", "summary": "three sentences balancing the verified bull and bear points, citing fact IDs", "risks": ["one sentence each, cite fact IDs"], "what_to_watch": [{"key": "kpi_key", "why": "one sentence"}]}`,
  verdict: `{"verdict_line": "one sentence for the CEO's final call, balanced, cite fact IDs"}`,
  stress: `{"claims": [{"text": "the user's claim in their own words", "stance": "bull if it says something good about the company, bear if bad", "evidence": "one sentence on what the data says, citing fact IDs, or empty if no data covers it"}]}`,
};
