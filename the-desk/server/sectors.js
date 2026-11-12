// Plain-English glossary per KPI. Used by offline (mock) agents and the stress-test keyword
// matcher, and passed to the live agents as hints. Add entries once the real sectors drop.
// Matching is by key OR label keywords, so unknown keys still work generically.
export const GLOSSARY = [
  { match: /occupan/, plain: 'How full the buildings are.', good: 'Above ~95% is strong for apartments.', words: ['occupancy', 'occupied', 'full', 'vacancy', 'empty'], up: 'Buildings are nearly full', down: 'Buildings are emptying out' },
  { match: /vacancy/, plain: 'Share of empty rental units across the whole city.', good: 'Rising city vacancy means more competition for tenants.', words: ['vacancy', 'market', 'supply'], up: 'The local market is tight', down: 'The local market is loosening' },
  { match: /completion|supply|starts/, plain: 'New apartment buildings finishing construction.', good: 'A surge in new supply pulls tenants away from older buildings.', words: ['supply', 'new buildings', 'completions', 'construction'], up: 'Little new competition is coming', down: 'A wave of new supply is coming' },
  { match: /noi/, plain: 'Profit growth from buildings owned a full year (strips out acquisitions).', good: 'Steady 3%+ is healthy; falling growth is a warning.', words: ['noi', 'same-property', 'organic', 'rent growth', 'income growth', 'growth'], up: 'Organic growth is accelerating', down: 'Organic growth is stalling' },
  { match: /payout/, plain: 'Share of cash flow paid out as distributions (dividends).', good: 'Under ~85% means the payout is covered with room to spare. Over 100% means paying more than it earns.', words: ['payout', 'dividend', 'distribution', 'yield'], up: 'The distribution is well covered', down: 'The distribution is getting stretched' },
  { match: /rent(?!.*spread)|avg_monthly/, plain: 'What a typical tenant pays per month.', good: 'Rising faster than inflation means pricing power.', words: ['rent', 'rents', 'pricing'], up: 'Rents keep climbing', down: 'Rents are slipping' },
  { match: /spread|leasing/, plain: 'How much more new tenants pay than the ones who left.', good: 'A big positive spread means the rents are below market and can rise.', words: ['lease', 'leasing', 'new leases', 'spread', 'turnover', 'mark-to-market'], up: 'New tenants are paying a lot more', down: 'New leases are signing at lower rents' },
  { match: /debt|leverage|gbv|ltv/, plain: 'How much of the property value is funded with debt.', good: 'Under ~45% is conservative for a REIT; 55%+ is high.', words: ['debt', 'leverage', 'balance sheet', 'borrow', 'loan'], up: 'The balance sheet is conservative', down: 'Debt is piling up' },
  { match: /coverage|interest/, plain: 'How many times operating income covers interest payments.', good: 'Above ~3x is comfortable; under 2x is tight.', words: ['interest', 'coverage', 'refinanc'], up: 'Interest payments are easily covered', down: 'Interest is eating into cash flow' },
  { match: /affo_per|ffo_per|per_unit|eps/, plain: 'Cash earnings per unit, the number distributions are paid from.', good: 'Growing per-unit cash flow is what drives the unit price over time.', words: ['affo', 'ffo', 'per unit', 'per share', 'earnings', 'cash flow'], up: 'Cash flow per unit is growing', down: 'Cash flow per unit is shrinking' },
  // generic fintech / software / other — so unknown sectors still read well
  { match: /retention|nrr/, plain: 'How much existing customers spend this year versus last year, after some leave.', good: 'Over 100% means the customer base grows on its own; 120%+ is excellent.', words: ['retention', 'nrr', 'expansion', 'upsell', 'existing customers'], up: 'Existing customers keep spending more', down: 'Existing customers are spending less' },
  { match: /payback|cac/, plain: 'Months it takes to earn back the cost of winning a new customer.', good: 'Under ~12 months is efficient; rising payback means growth is getting expensive.', words: ['payback', 'cac', 'acquisition cost', 'marketing', 'efficient'], up: 'New customers pay back fast', down: 'Growth is getting expensive' },
  { match: /charge.?off|delinquen|default/, plain: 'Share of loans written off as unpaid.', good: 'Rising charge-offs eat directly into profit for a lender.', words: ['charge-off', 'charge off', 'defaults', 'bad loans', 'credit losses', 'delinquen', 'credit quality'], up: 'Borrowers are paying back', down: 'More borrowers are defaulting' },
  { match: /payment_volume|tpv|gmv/, plain: 'Total value of payments flowing through the platform.', good: 'Volume growth leads revenue growth for payment companies.', words: ['volume', 'tpv', 'gmv', 'payments processed', 'transactions'], up: 'Payment volume is surging', down: 'Payment volume is slowing' },
  { match: /ebitda/, plain: 'Operating profit before interest, taxes and non-cash costs, as a share of revenue.', good: 'Moving from negative to positive is the key turning point for a growth company.', words: ['ebitda', 'profitab', 'profit', 'break even', 'breaking even', 'losses'], up: 'Profitability is improving', down: 'Losses are widening' },
  { match: /churn/, plain: 'Share of customers who leave each period.', good: 'Lower is better; falling churn means a stickier product.', words: ['churn', 'retention', 'leave', 'cancel'], up: 'Customers are sticking around', down: 'Customers are leaving' },
  { match: /margin/, plain: 'How much of each dollar of revenue is kept as profit.', good: 'Expanding margins mean the business is scaling.', words: ['margin', 'profitab'], up: 'Margins are expanding', down: 'Margins are shrinking' },
  { match: /revenue|sales/, plain: 'Total money coming in from customers.', good: 'Faster growth than peers means taking market share.', words: ['revenue', 'sales', 'top line', 'growth'], up: 'Revenue is growing fast', down: 'Revenue growth is fading' },
  { match: /arr|recurring/, plain: 'Annualized subscription revenue.', good: 'Shows how fast the predictable part of the business grows.', words: ['arr', 'recurring', 'subscription'], up: 'Recurring revenue is compounding', down: 'Recurring revenue is slowing' },
  { match: /user|customer|account|subscriber/, plain: 'Number of active customers.', good: 'Growth here usually comes before revenue growth.', words: ['users', 'customers', 'accounts', 'subscribers'], up: 'The customer base is growing', down: 'The customer base is shrinking' },
];

export function glossFor(key, label = '') {
  const s = `${key} ${label}`.toLowerCase();
  return GLOSSARY.find((g) => g.match.test(s)) || {
    plain: `${label || key} as reported by the company.`,
    good: 'Compare the trend and the peer ranking to judge it.',
    words: String(label || key).toLowerCase().split(/[\s_]+/).filter((w) => w.length > 3),
    up: `${label || key} is a strength`,
    down: `${label || key} is a weak spot`,
  };
}
