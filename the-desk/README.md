# The Desk

> *Most people can't afford a team of analysts. Now you get a whole city of them.*

**[Live demo →](https://investechhackthon-hwcj-i67u2ewf1-louis-c9b6.vercel.app/)**

The Desk is an AI-powered equity research platform built as an animated 3D city. Pick any stock and a team of seven specialized AI agents researches it in parallel — you watch them work in real time, floor by floor, in a living tower. The result is a one-page investment pitch where every single number is sourced and fact-checked.

---

## What makes it different

**The AI never types a number.** Agents write in citations like `[[F12]]`; the platform fills in the real value and its source from the data. Any agent that invents a figure gets caught by the Skeptic and the claim is removed before it reaches the report. This isn't a vibe check — it's a structured, verifiable research pipeline.

**Seven agents, one tower, one floor each:**

| Floor | Agent | Role |
|---|---|---|
| 6 | **Genesis** | CEO — briefs the team, sets the thesis, signs off on the final call |
| 5 | **Editor** | Turns verified research into a balanced one-page pitch |
| 4 | **Skeptic** | Checks every claim against the data; removes anything without a source |
| 3 | **Bull / Bear** | Argue the strongest honest case for and against |
| 2 | **KPI Analyst** | Picks the sector metrics that matter and ranks the company against peers |
| 1 | **Researcher** | Explains the business and how it makes money, in plain English |
| 0 | **Data Vault** | Every sourced fact the team can use — nothing else |

**The output:** a one-page pitch where every number is a clickable chip linking back to its source. Export it as a PDF. Run the same analysis as of any past quarter to see what the model would have called — and what actually happened next.

---

## Demo

```
1. Hit ▶ Research every stock — towers rise, floors light up agent by agent
2. Click a tower → walk inside → watch each agent's terminal fill live
3. Click the Skeptic floor → see it remove an unsourced claim in real time
4. Open the one-pager → click any number → see its source
5. Paste a pitch into Stress Test → every claim gets ✅ / ⚠️ / ❌
6. Set "As of 2025-Q2" → re-run → compare the call with what happened next
```

---

## Architecture

```
Onesheet data (CSV / JSON / API)
  └─ loader.js          universal ingestion → sourced fact objects
       └─ analytics.js  fact sheet: values, changes, peer ranks, prices, each with an ID + source
            └─ pipeline.js
                 Genesis plans
                   ├─ Researcher + KPI Analyst  (parallel)
                   ├─ Bull + Bear               (parallel)
                   ├─ Skeptic                   (code check → LLM judgment; stricter wins)
                   └─ Editor → Genesis signs off → conviction score
                        └─ SSE events → 3D city (React Three Fiber) + live agent terminals
```

**Conviction** (0–100) measures how much of the bull case survived fact-checking relative to the bear case. It drives tower height in the city. It is not a buy/sell signal.

**Time travel:** `asOf` filters every fact and price to what was publicly known at that date, then runs the full pipeline. The report shows the call and the subsequent price move.

---

## Running locally

```bash
npm install
npm run dev        # API on :8787  •  UI on http://localhost:5173
```

No API key needed — offline agents follow the same rules on the same data and produce a complete report. The city looks and behaves identically.

**To enable live AI agents:**

```bash
cp .env.example .env
# set ANTHROPIC_API_KEY=your-key
npm run dev
```

The header badge turns green. Live agents use `claude-sonnet-4-5` by default; override with `ANTHROPIC_MODEL`.

**Production build:**
```bash
npm run build && npm start      # Express server on :8787
vite build --mode static        # Browser-only, no server (outputs dist-static/)
```

---

## Loading data

1. **In the UI:** click **Load data** and drop any CSV or JSON file. The loader handles long format (`ticker, metric, value, period, source, url`), wide format, nested JSON, and price CSVs automatically.
2. **Via API:** `npm run pull -- "<endpoint>"` saves to `server/data/live/` (set `ONESHEET_API_KEY` in `.env`).
3. The header shows how many companies and facts loaded. Open any tower's **Data Vault** floor to browse every fact with its source.

The included demo dataset contains five fictional Canadian REITs, labeled as such throughout the UI.

---

## Key files

| File | What it does |
|---|---|
| `server/data/loader.js` | Universal data ingestion + point-in-time filter |
| `server/analytics.js` | Fact sheet math — agents never compute numbers themselves |
| `server/refs.js` | `[[F#]]` → source chips, raw-number detection, code-level fact check |
| `server/agents/pipeline.js` | Orchestration, SSE events, stress test |
| `server/agents/prompts.js` | Live agent system prompts |
| `server/agents/mock.js` | Offline agents (same rules, no API key) |
| `server/sectors.js` | Plain-English KPI glossary by sector |
| `web/src/components/Office.jsx` | 3D office floors (React Three Fiber) |
| `web/src/components/Exterior.jsx` | Animated city exterior, tower lighting |
| `web/src/components/Report.jsx` | One-pager + PDF export |

---

*Educational research tool. Not investment advice.*
