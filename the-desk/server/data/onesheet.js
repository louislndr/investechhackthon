// Onesheet company profiles (schema company-profile-consumer-v2) -> The Desk's sourced facts.
// Each company reports metrics under its own names, so we map them onto a small set of "lenses"
// per index. That way Killam's apartment occupancy and Granite's occupancy line up as one KPI.

export const INDEXES = {
  reits: {
    name: 'REITs across borders',
    tickers: ['CAR.UN', 'GRT.UN', 'KMP.UN', 'NXR.UN', 'REI.UN'],
    holdings: 'EGP, O, DLR, SPG, MAA, INVH, AMT, VICI, KIM, BXP, CCI, PLD, PSA, REXR, plus IRS (Argentina) and LRE (Japan)',
    thesis: 'Quality real estate owners from several countries: full buildings, a payout that is covered by cash flow, sensible leverage and growing income per unit. A Canadian name should add something the US-heavy basket lacks without lowering the quality bar.',
  },
  acquirers: {
    name: 'Serial acquirers & consolidators',
    tickers: ['CSU', 'TOI', 'WSP', 'TFII', 'ARE'],
    holdings: 'BSP, AME, WCN, BRO, IEX, ETN, ROP, TDY, TDG, ACM, HEI, J, POOL, WSO, DHR',
    thesis: 'Companies that compound by buying many smaller businesses again and again, funded by their own cash flow: a steady stream of acquisitions, growth that keeps going, strong free cash flow and leverage they can carry. One big deal is not a serial acquirer.',
  },
};

// Lens = one comparable KPI. `match` picks the company's metric; first match wins.
const LENSES = {
  reits: [
    { key: 'occupancy', pct: true, label: 'Occupancy', hib: true, match: [/^occupancy$/, /^committed_occupancy_pct$/, /^apartment_occupancy$/, /^industrial_occupancy$/, /^residential_suites_occupancy$/, /^committed_occupancy$/, /occupancy$/] },
    { key: 'payout_ratio', pct: true, label: 'Payout ratio (FFO/AFFO)', hib: false, match: [/^affo_payout_ratio$/, /^core_affo_payout_ratio$/, /^adjusted_ffo_payout_ratio$/, /^ffo_payout_ratio$/, /payout_ratio$/] },
    { key: 'same_store_noi_growth', pct: true, label: 'Same-property NOI growth', hib: true, match: [/^same_store_noi_change_pct$/, /^same_property_noi_change_pct$/, /^commercial_same_property_noi_growth_change_pct$/, /^cash_noi_change_pct$/, /same_.*noi.*change_pct/] },
    { key: 'debt_to_assets', pct: true, label: 'Debt to assets', hib: false, match: [/^total_debt_to_gross_book_value_ratio$/, /^total_indebtedness_ratio$/, /^debt_ratio$/], skipQuote: /floating|unsecured|fixed rate|secured debt/i, maxAgeDays: 550 },
    { key: 'affo_per_unit', label: 'AFFO per unit', hib: true, match: [/^affo_per_share$/, /^core_affo_per_unit$/, /^core_ffo_per_share$/, /^ffo_per_share$/] },
    { key: 'affo_growth', pct: true, label: 'AFFO growth', hib: true, match: [/^affo_change_pct$/, /^affo_change_ex_fx_per_share$/, /^core_ffo_change_pct$/, /^ffo_change_pct$/] },
    { key: 'rent_growth', pct: true, label: 'Rent growth', hib: true, match: [/^rent_per_unit_change_pct$/, /^leasing_spread$/, /^leasing_spread_pct$/] },
    { key: 'revenue_growth', pct: true, label: 'Revenue growth', hib: true, match: [/^revenue_change_pct$/, /^revenue_change_ex_fx$/] },
  ],
  acquirers: [
    { key: 'revenue_growth', pct: true, label: 'Revenue growth', hib: true, match: [/^revenue_change_pct$/, /^revenue_change_pct_ex_fx$/] },
    { key: 'organic_growth', pct: true, label: 'Organic growth', hib: true, match: [/^organic_growth_change_pct$/, /organic.*change_pct$/] },
    { key: 'acquisition_spend', abs: true, label: 'Cash spent on acquisitions', hib: true, match: [/^acquisitions$/] },
    { key: 'free_cash_flow', label: 'Free cash flow', hib: true, match: [/^free_cash_flow$/, /^operating_cash_flow$/] },
    { key: 'fcf_growth', pct: true, label: 'Cash flow growth', hib: true, match: [/^fcfa2s_change_pct$/, /^free_cash_flow_change_pct$/, /^operating_cash_flow_change_pct$/] },
    { key: 'margin', pct: true, label: 'Operating margin', hib: true, match: [/^adjusted_ebitda_margin$/, /^operating_income_margin$/, /^operating_margin$/, /^adjusted_adjusted_ebitda_margin$/, /^net_income_margin$/] },
    { key: 'leverage', label: 'Net debt to EBITDA', hib: false, match: [/net_debt_to_adjusted_ebitda_ratio$/, /debt_to_.*ebitda_ratio$/, /^debt_to_capitalization_ratio$/] },
    { key: 'eps_growth', pct: true, label: 'EPS growth', hib: true, match: [/^adjusted_eps_change_pct$/, /^eps_change_pct$/], maxAbs: 150 },
  ],
};

export const isOnesheetProfile = (j) => j && typeof j === 'object' && /^company-profile/.test(String(j.schemaVersion || '')) && j.document?.profile;

const TODAY = new Date().toISOString().slice(0, 10);
const FORM = { 'annual-mdna': 'Annual MD&A', 'interim-mdna': 'Interim MD&A', 'interim-financial-statements': 'Interim financial statements', 'annual-financial-statements': 'Annual financial statements', 'press-release': 'Press release', 'aif': 'Annual information form' };

function periodLabel(p) {
  if (p.periodType === 'Quarterly' && p.calendarYear && p.calendarQuarter) return `${p.calendarYear}-Q${p.calendarQuarter}`;
  if (p.periodType === 'Annual') return `FY${p.fiscalYear || String(p.reportDate).slice(0, 4)}`;
  return String(p.reportDate).slice(0, 10);
}
function toSource(v, p) {
  const s = (v.sources || [])[0] || {};
  const form = FORM[s.formType] || (s.formType ? s.formType.replace(/-/g, ' ') : 'Filing');
  return {
    type: s.source === 'sedar' ? 'SEDAR+ filing' : s.source ? `${s.source} filing` : 'Onesheet profile',
    doc: `${form}${s.filedOn ? `, filed ${s.filedOn}` : ''}`,
    note: s.quote ? `"${String(s.quote).slice(0, 220)}"` : `Period ending ${p.reportDate}`,
    url: '',
  };
}

function shortName(doc, id) {
  const aliases = (doc.profile.entities || []).find((e) => e.kind === 'company')?.aliases || [];
  const best = aliases.filter((a) => a.length >= 5 && a.length < (id.name || '').length).sort((a, b) => a.length - b.length)[0];
  return best || id.name;
}

export function indexOf(ticker) {
  return Object.entries(INDEXES).find(([, ix]) => ix.tickers.includes(ticker))?.[0];
}

// Returns { company, kpis: { lensKey: [{ period, value, source }] }, meta: { lensKey: { label, unit, higher_is_better } } }
export function convertProfile(j) {
  const doc = j.document;
  const id = doc.profile.identity || {};
  const listing = (id.listings || [])[0] || {};
  const ticker = listing.symbol || String(j.companyKey || id.key || '').toUpperCase().replace('-UN', '.UN');
  const ixKey = indexOf(ticker) || 'acquirers';
  const ix = INDEXES[ixKey];
  const metrics = Object.fromEntries((doc.metrics || []).map((m) => [m.metricId, m]));

  // observations per metric, oldest first, nothing dated in the future (guidance)
  const obs = {};
  const periods = [...(doc.data || [])].filter((p) => String(p.reportDate) <= TODAY && ['Quarterly', 'Annual', 'PointInTime'].includes(p.periodType))
    .sort((a, b) => String(a.reportDate).localeCompare(String(b.reportDate)));
  for (const p of periods) for (const [mid, v] of Object.entries(p.metricValues || {})) {
    if (v == null || typeof v.value !== 'number') continue;
    (obs[mid] ||= []).push({ p, v });
  }

  const kpis = {}, meta = {};
  for (const lens of LENSES[ixKey]) {
    const ok = (k) => !/guidance/.test(k) && (!lens.pct || metrics[k]?.metricFormat === '%');
    const mid = lens.match.map((re) => Object.keys(obs).find((k) => re.test(k) && ok(k))).find(Boolean);
    if (!mid) continue;
    const m = metrics[mid] || {};
    // pick the period type with the most observations, so the series is consistent
    const byType = {};
    // some companies reuse a metric name for something else (e.g. RioCan's "debt_ratio" is floating-rate share)
    const usable = obs[mid].filter((o) => !lens.skipQuote || !lens.skipQuote.test(String((o.v.sources || [])[0]?.quote || '')));
    if (!usable.length) continue;
    // stale data (over ~15 months old) is not a fair comparison against peers' latest numbers
    // one-off swings (e.g. EPS up 386% off a tiny base) distort the peer ranking
    if (lens.maxAbs && Math.abs(usable.at(-1).v.value * (metrics[mid]?.metricFormat === '%' ? 100 : 1)) > lens.maxAbs) continue;
    for (const o of usable) (byType[o.p.periodType] ||= []).push(o);
    const best = Object.values(byType).sort((a, b) => b.length - a.length)[0];
    if ((Date.parse(TODAY) - Date.parse(String(best.at(-1).p.reportDate))) / 864e5 > (lens.maxAgeDays || 450)) continue;
    const pct = m.metricFormat === '%';
    const unit = pct ? '%' : /ratio/.test(mid) && !pct ? 'x' : m.isCurrency ? '$' : '';
    kpis[lens.key] = best.slice(-8).map(({ p, v }) => ({ period: periodLabel(p), value: pct ? +(v.value * 100).toFixed(2) : lens.abs ? Math.abs(v.value) : v.value, source: toSource(v, p) }));
    meta[lens.key] = { label: lens.key === 'leverage' && unit === '%' ? 'Debt to capital' : lens.label, unit, higher_is_better: lens.hib, origin: m.metricName || mid };
  }

  // Deal activity from the events log: the clearest serial-acquirer signal.
  const events = (doc.events || []).filter((e) => e.date?.occurredOn && e.date.occurredOn <= TODAY)
    .sort((a, b) => String(b.date.occurredOn).localeCompare(String(a.date.occurredOn)));
  const since = new Date(); since.setFullYear(since.getFullYear() - 2);
  const cut = since.toISOString().slice(0, 10);
  const deals = events.filter((e) => /acquisition/.test(e.type) && e.date.occurredOn >= cut);
  if (deals.length || ixKey === 'acquirers') {
    kpis.deals_24m = [{
      period: TODAY,
      value: deals.length,
      source: { type: 'Onesheet events log', doc: `Acquisitions recorded since ${cut}`, note: deals.slice(0, 3).map((e) => `${e.date.occurredOn}: ${String(e.summary).slice(0, 120)}`).join(' | ') || 'None recorded', url: '' },
    }];
    meta.deals_24m = { label: 'Acquisitions in the last 2 years', unit: '', higher_is_better: true, origin: 'events' };
  }

  return {
    company: {
      ticker, name: shortName(doc, id) || ticker, legalName: id.name || ticker, exchange: listing.exchange || '', sector: ix.name, indexKey: ixKey,
      description: doc.profile.overview?.description || '',
      events: events.slice(0, 12).map((e) => ({ date: e.date.occurredOn, type: e.type, summary: String(e.summary || '').slice(0, 260) })),
    },
    kpis, meta,
  };
}
