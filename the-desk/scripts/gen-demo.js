// Generates FICTIONAL demo data so The Desk runs before the real Onesheet data arrives.
// Companies and numbers are made up. Replace with the hackathon data (drag & drop in the UI,
// or drop files into server/data/live and set DATA_DIR=server/data/live).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'server/data/demo');
mkdirSync(out, { recursive: true });

const periods = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'];

const kpiMeta = {
  occupancy: { label: 'Occupancy', unit: '%', higher_is_better: true, doc: 'MD&A' },
  sp_noi_growth: { label: 'Same-property NOI growth', unit: '%', higher_is_better: true, doc: 'MD&A' },
  affo_payout_ratio: { label: 'AFFO payout ratio', unit: '%', higher_is_better: false, doc: 'MD&A' },
  avg_monthly_rent: { label: 'Average monthly rent', unit: '$', higher_is_better: true, doc: 'Supplementary package' },
  new_lease_spread: { label: 'New-lease rent spread', unit: '%', higher_is_better: true, doc: 'Supplementary package' },
  debt_to_gbv: { label: 'Debt to gross book value', unit: '%', higher_is_better: false, doc: 'Financial statements' },
  interest_coverage: { label: 'Interest coverage', unit: 'x', higher_is_better: true, doc: 'MD&A' },
  affo_per_unit: { label: 'AFFO per unit', unit: '$', higher_is_better: true, doc: 'MD&A' },
};

// Each series is 6 quarters, oldest -> newest. Each company tells a different story.
const companies = [
  {
    ticker: 'LMR.UN', name: 'Larchmere Residential REIT', exchange: 'TSX',
    description: 'Owns about 14,000 mid-rise apartment units across the Greater Toronto Area and Ottawa. Makes money from monthly rent and parking, and grows by raising rents when tenants turn over.',
    drift: 0.05,
    s: {
      occupancy: [97.0, 97.3, 97.1, 97.4, 97.3, 97.2],
      sp_noi_growth: [4.8, 4.6, 4.5, 4.0, 3.6, 3.1],
      affo_payout_ratio: [70.1, 71.5, 73.0, 75.2, 76.9, 78.4],
      avg_monthly_rent: [1781, 1792, 1806, 1815, 1829, 1845],
      new_lease_spread: [14.2, 12.8, 11.0, 9.5, 8.1, 6.9],
      debt_to_gbv: [41.2, 41.0, 41.5, 41.8, 42.0, 42.3],
      interest_coverage: [3.4, 3.3, 3.3, 3.2, 3.1, 3.0],
      affo_per_unit: [0.231, 0.232, 0.230, 0.229, 0.228, 0.226],
    },
  },
  {
    ticker: 'NGL.UN', name: 'Northgate Living REIT', exchange: 'TSX',
    description: 'A turnaround story: owns about 9,000 older apartment units in Montréal and Québec City and is renovating them to charge higher rents. Carries more debt than peers while it fixes the portfolio.',
    drift: 0.32,
    s: {
      occupancy: [93.8, 94.2, 94.9, 95.6, 96.1, 96.5],
      sp_noi_growth: [1.9, 2.4, 3.1, 3.9, 4.6, 5.2],
      affo_payout_ratio: [88.0, 86.9, 85.1, 83.0, 81.6, 80.2],
      avg_monthly_rent: [1302, 1318, 1340, 1366, 1390, 1412],
      new_lease_spread: [9.0, 10.4, 11.9, 13.1, 14.0, 15.2],
      debt_to_gbv: [53.1, 52.9, 52.6, 52.4, 52.0, 51.8],
      interest_coverage: [2.1, 2.2, 2.2, 2.3, 2.4, 2.5],
      affo_per_unit: [0.141, 0.145, 0.150, 0.156, 0.160, 0.165],
    },
  },
  {
    ticker: 'BFA.UN', name: 'Bayfront Apartments REIT', exchange: 'TSX',
    description: 'Owns about 11,000 apartment units in Vancouver suburbs and Calgary. Grew fast by buying buildings with debt, and is now dealing with new supply pulling tenants away.',
    drift: -0.28,
    s: {
      occupancy: [96.1, 95.7, 95.0, 94.1, 93.2, 92.5],
      sp_noi_growth: [3.2, 2.5, 1.6, 0.4, -0.8, -1.9],
      affo_payout_ratio: [91.0, 93.4, 95.8, 98.7, 101.2, 103.6],
      avg_monthly_rent: [1955, 1958, 1950, 1941, 1930, 1922],
      new_lease_spread: [5.1, 3.0, 0.8, -1.4, -3.2, -4.5],
      debt_to_gbv: [49.0, 49.8, 50.9, 52.1, 53.4, 54.6],
      interest_coverage: [2.6, 2.4, 2.3, 2.1, 1.9, 1.8],
      affo_per_unit: [0.198, 0.193, 0.188, 0.181, 0.176, 0.171],
    },
  },
  {
    ticker: 'MCC.UN', name: 'Maple Crest Communities REIT', exchange: 'TSX',
    description: 'A conservative owner of about 6,500 apartment units in mid-size Ontario cities like Kitchener, London and Hamilton. Known for low debt and slow, steady growth.',
    drift: 0.12,
    s: {
      occupancy: [97.9, 98.0, 98.1, 98.0, 98.2, 98.3],
      sp_noi_growth: [3.3, 3.4, 3.5, 3.4, 3.6, 3.7],
      affo_payout_ratio: [74.0, 73.8, 73.5, 73.6, 73.1, 72.9],
      avg_monthly_rent: [1540, 1551, 1563, 1572, 1585, 1597],
      new_lease_spread: [7.2, 7.0, 7.4, 7.1, 7.3, 7.5],
      debt_to_gbv: [37.9, 37.6, 37.4, 37.5, 37.1, 36.8],
      interest_coverage: [4.1, 4.1, 4.2, 4.2, 4.3, 4.3],
      affo_per_unit: [0.188, 0.190, 0.191, 0.193, 0.195, 0.197],
    },
  },
  {
    ticker: 'RRT.UN', name: 'Riverside Rental Trust', exchange: 'TSXV',
    description: 'A small, fast-growing trust that buys neglected apartment buildings in Atlantic Canada, renovates them and re-leases at higher rents. Growth comes mostly from acquisitions funded with new units and debt.',
    drift: 0.18,
    s: {
      occupancy: [94.5, 94.9, 95.3, 95.0, 95.4, 95.8],
      sp_noi_growth: [6.5, 7.1, 7.8, 8.0, 8.4, 8.9],
      affo_payout_ratio: [84.0, 85.5, 86.1, 87.4, 88.0, 89.2],
      avg_monthly_rent: [1188, 1205, 1226, 1244, 1263, 1285],
      new_lease_spread: [18.0, 19.5, 20.1, 21.4, 22.0, 22.8],
      debt_to_gbv: [55.2, 56.0, 56.9, 57.4, 58.1, 58.8],
      interest_coverage: [1.9, 1.9, 1.8, 1.8, 1.7, 1.7],
      affo_per_unit: [0.088, 0.090, 0.091, 0.092, 0.093, 0.094],
    },
  },
];

const filed = { Q1: 'May', Q2: 'Aug', Q3: 'Nov', Q4: 'Feb' };
const json = {
  _note: 'FICTIONAL DEMO DATA for The Desk. Not real companies. Replace with Onesheet hackathon data.',
  sector: 'Canadian Residential REITs',
  kpis: Object.fromEntries(Object.entries(kpiMeta).map(([k, v]) => [k, { label: v.label, unit: v.unit, higher_is_better: v.higher_is_better }])),
  companies: companies.map((c) => ({
    ticker: c.ticker, name: c.name, exchange: c.exchange, sector: 'Residential REIT', description: c.description,
    kpis: Object.fromEntries(Object.entries(c.s).map(([k, arr]) => [k, arr.map((v, i) => {
      const p = periods[i];
      const q = p.split('-')[1];
      return {
        period: p, value: v,
        source: { type: 'Filing', doc: `${p.replace('-', ' ')} ${kpiMeta[k].doc}`, note: `Filed ${filed[q]} ${q === 'Q4' ? Number(p.slice(0, 4)) + 1 : p.slice(0, 4)} (demo)`, url: '' },
      };
    })])),
  })),
  sector_facts: [
    { key: 'toronto_vacancy', label: 'Toronto purpose-built rental vacancy', unit: '%', higher_is_better: false, series: [{ period: '2025-Q2', value: 1.9 }, { period: '2026-Q2', value: 2.6 }], source: { type: 'Third-party', doc: 'National rental market survey (demo)', url: '' } },
    { key: 'vancouver_completions', label: 'Vancouver-area rental completions (YoY)', unit: '%', higher_is_better: false, series: [{ period: '2025-Q2', value: 12.0 }, { period: '2026-Q2', value: 31.0 }], source: { type: 'Third-party', doc: 'Housing starts & completions survey (demo)', url: '' } },
  ],
};
writeFileSync(join(out, 'companies.json'), JSON.stringify(json, null, 2));

// Daily prices: seeded random walk with a per-company drift, ~18 months of trading days.
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const lines = ['date,ticker,close'];
const start = new Date('2025-01-02T00:00:00Z');
const end = new Date('2026-11-11T00:00:00Z');
companies.forEach((c, ci) => {
  const r = rng(1234 + ci * 77);
  let px = [14.2, 9.8, 17.5, 21.3, 6.4][ci];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const shock = (r() - 0.5) * 0.028;
    px = Math.max(1, px * (1 + c.drift / 252 + shock));
    lines.push(`${d.toISOString().slice(0, 10)},${c.ticker},${px.toFixed(2)}`);
  }
});
writeFileSync(join(out, 'prices.csv'), lines.join('\n'));
console.log('Demo data written to', out);
