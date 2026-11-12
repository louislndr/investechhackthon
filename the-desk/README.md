# The Desk: your AI analyst city

> "Most people can't afford a team of analysts. Now you get a whole city of them."

Pick any stock, and a team of AI agents researches it live: Genesis (the CEO) briefs the team, the
Researcher explains the business, the KPI Analyst picks the sector numbers that matter and ranks peers,
Bull and Bear argue, the Skeptic fact-checks everything, and the Editor writes a **one-page pitch where
every number links to its source**. You watch it all happen in an animated city: one tower per stock,
one floor per agent.

**The key rule:** the AI never types a number. Agents cite fact IDs like `[[F12]]`; the code fills in
the real value and source from Onesheet's data. Anything unsourced gets thrown out by the Skeptic.

---

## Quick start

```bash
npm install
npm run dev          # API on :8787 + UI on http://localhost:5173
```

No API key? It still runs end to end with **offline agents** that follow the same rules on the same data.

**Live AI agents:** `cp .env.example .env`, set `ANTHROPIC_API_KEY`, restart. The header badge turns green.

Production-style single server: `npm run build && npm start` → http://localhost:8787

Browser-only demo (no server, offline agents run in the page): `npx vite build --mode static` → `dist-static/`

## Plugging in tonight's data (do this first at 5pm)

1. **Easiest:** click **⇪ Load Onesheet data** in the city and drop the CSV/JSON files. The loader guesses
   the shape: long rows (`ticker, metric, value, period, source, url`), wide rows (`ticker, period, kpi1, kpi2…`),
   nested JSON (`companies[].kpis{key:[{period,value,source}]}`), and price CSVs (`date, ticker, close`).
2. **API:** `npm run pull -- "<endpoint url>"` saves responses to `server/data/live/` (set `ONESHEET_API_KEY`
   in `.env`). Restart the server.
3. Check the header: it shows how many companies and facts were read. Open the **Data Vault** floor in any
   tower to see every fact with its source.
4. Optional, 10 minutes: add plain-English entries for the new sector's KPIs in `server/sectors.js`
   (this improves the offline agents and the stress-test keyword matching; live agents don't need it).

Demo data is **fictional** (5 made-up Canadian REITs) and labeled as such in the UI.

## Demo script (3 min)

1. **Problem (20s):** "You have a week to pitch a small cap nobody covers. You'll burn days figuring out what matters."
2. **City (30s):** hit **▶ Research every stock**. The towers rise, floors light up, and data flows from the Onesheet vault.
3. **Inside a tower (60s):** click one. Genesis briefs, packets ride the elevator. Click the **Skeptic** floor and
   show it removing the unsourced "Management sees huge upside" claim.
4. **One-pager (30s):** open it and click any number to show its source. Export the PDF.
5. **Stress-test (20s):** paste a pitch and watch each claim turn ✅ / ⚠️ / ❌.
6. **Close (20s):** "Next week: time travel." Set **As of 2025-Q2**, run, and show what actually happened next.

**Stage safety:** every run is cached. **⏵ Replay** re-plays the last run with the same animation and no API
calls. If any live API call fails, that agent falls back to offline mode and the run continues.

## How it works

```
Data Vault (Onesheet files/API) -> loader.js (any shape -> sourced facts)
        -> analytics.js (fact sheet: values, changes, peer ranks, prices, each with an ID + source)
        -> pipeline.js:
             Genesis plans
               -> Researcher + KPI Analyst (parallel)
               -> Bull + Bear (parallel)
               -> Skeptic (code check: no refs / raw numbers = removed; then LLM judgment, stricter wins)
               -> Editor -> Genesis signs off -> conviction score
        -> SSE events -> City (isometric CSS 3D) / Tower (floors, elevator packets, live terminals)
```

- **Conviction** = how much of the bull vs bear case survived fact-checking (0–100). It sets the tower height.
  It's not a buy/sell signal.
- **Time travel:** `asOf` filters facts and prices to what was known at that date, then compares the call with
  what happened next.

| File | What |
|---|---|
| `server/data/loader.js` | Universal loader + point-in-time filter |
| `server/analytics.js` | Fact sheet math (agents never compute numbers) |
| `server/refs.js` | `[[F#]]` → source chips, raw-number detection, code-level fact check |
| `server/agents/pipeline.js` | Genesis orchestration, events, stress test |
| `server/agents/prompts.js` | Live agent prompts |
| `server/agents/mock.js` | Offline agents |
| `server/sectors.js` | Plain-English KPI glossary |
| `web/src/components/City.jsx` | Animated city |
| `web/src/components/Tower.jsx` | Floors, elevator, live agent drawer |
| `web/src/components/Report.jsx` | One-pager + PDF export |

## Roadmap (Nov 19)

- Full 3D city (react-three-fiber), free camera, WASD "PM mode" walking the floors
- Time travel across all quarters + a performance review scoring each agent's past calls
- "Hire" agents (Short-seller, Dividend analyst), comparisons against competitors, MCP connection to Onesheet

*Educational research tool. Not investment advice.*
