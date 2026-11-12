// Floors of every tower, top to bottom. Colours follow road-sign meanings.
export const AGENTS = {
  genesis: { name: 'Genesis', role: 'CEO, runs the team', color: '#c9b6ff', floor: 6, blurb: 'Reads the assignment, briefs the team and signs off on the final call.' },
  editor: { name: 'Editor', role: 'Writes the one-pager', color: '#ffb38a', floor: 5, blurb: 'Turns the verified research into a balanced one-page pitch.' },
  skeptic: { name: 'Skeptic', role: 'Fact-checks every claim', color: '#ffd36b', floor: 4, blurb: 'Checks every claim against the data and throws out anything without a source.' },
  bull: { name: 'Bull', role: 'Argues for', color: '#5fe0a0', floor: 3, blurb: 'Builds the strongest honest case for the company.' },
  bear: { name: 'Bear', role: 'Argues against', color: '#ff6b6b', floor: 3, blurb: 'Builds the strongest honest case against the company.' },
  kpi: { name: 'KPI Analyst', role: 'Sector numbers and peers', color: '#7fd6ff', floor: 2, blurb: 'Picks the sector numbers that actually matter and ranks the company against its peers.' },
  researcher: { name: 'Researcher', role: 'Explains the business', color: '#9fb4ff', floor: 1, blurb: 'Explains what the company does and how it makes money, in plain English.' },
  vault: { name: 'Data vault', role: 'Onesheet data', color: '#a8b3c2', floor: 0, blurb: 'Every sourced fact the team is allowed to use. No source, no number.' },
};
export const TOWER_AGENTS = ['genesis', 'editor', 'skeptic', 'bull', 'bear', 'kpi', 'researcher'];
export const VERDICT = {
  supported: { icon: '✓', label: 'Supported', cls: 'v-ok' },
  weak: { icon: '~', label: 'Weak', cls: 'v-weak' },
  contradicted: { icon: '✕', label: 'Contradicted', cls: 'v-bad' },
  removed: { icon: '—', label: 'Removed, no source', cls: 'v-removed' },
  unverifiable: { icon: '?', label: 'Unverifiable', cls: 'v-unk' },
};
export const stanceColor = (c) => (c == null ? '#5d6b7d' : c >= 62 ? '#5fe0a0' : c <= 38 ? '#ff6b6b' : '#ffd36b');
