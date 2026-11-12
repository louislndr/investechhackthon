# The Desk

One stock. Seven AI analysts. Every number sourced.

The Desk turns a company's data into a sourced, one-page stock pitch. A team of AI agents researches the
stock while you watch them work inside a tower in a 3D city. Walk into the office, click any analyst's
computer, and see exactly what they're working on.

Built at Trimestre Q4 (Montréal) on data from [Onesheet](https://onesheet.ca).

## The team

| Floor | Agent | Job |
|---|---|---|
| 6 | Genesis | Runs the team: reads the data, decides what matters, signs off on the final call |
| 5 | Editor | Writes the one-page pitch |
| 4 | Skeptic | Fact-checks every claim and throws out anything without a source |
| 3 | Bull / Bear | Build the strongest honest case for and against |
| 2 | KPI Analyst | Picks the numbers that matter for the sector and ranks the company against peers |
| 1 | Researcher | Explains the business in plain English |

## The rule that makes it trustworthy

The AI never writes a number. Agents can only cite facts by ID (like `[[F12]]`), and the code fills in the
real value and its source. Claims with no source get removed by the Skeptic. Every number in the final
one-pager links back to the filing or dataset it came from.

## What you get

- **One-pager:** the business in plain English, sector KPIs vs peers, the case for and against, risks,
  what to watch, and a full source list
- **Pitch stress-test:** paste your own pitch and each claim is marked supported, weak, contradicted or
  unverifiable
- **Time travel:** run the team using only the data available at a past date, then see what actually happened

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without an API key it runs with offline agents that follow the same rules.
For live AI agents, copy `.env.example` to `.env` and add your `ANTHROPIC_API_KEY`.

## Your own data

Click **Load Onesheet data** and drop in CSV or JSON files. The loader handles:

- long rows: `ticker, metric, value, period, source, source_url`
- wide rows: `ticker, period, kpi_1, kpi_2, ...`
- nested JSON: `companies[].kpis{ key: [{ period, value, source }] }`
- prices: `date, ticker, close`

Sample files are in `samples/`.

## Stack

React, three.js (react-three-fiber), Node/Express, the Claude API.

| Path | What |
|---|---|
| `server/data/loader.js` | Turns any data shape into sourced facts |
| `server/analytics.js` | Changes, peer ranks and returns (all math is done in code) |
| `server/refs.js` | Source links and the fact check |
| `server/agents/` | The agents, their prompts and the orchestration |
| `web/src/components/Exterior.jsx` | The city |
| `web/src/components/Office.jsx` | The office floor and live screens |
| `web/src/components/Report.jsx` | The one-pager |

The bundled demo data is fictional.

*Educational project. Not investment advice.*
