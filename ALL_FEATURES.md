# All Features

The complete feature inventory of this repository — the original
client-only dashboard *and* the Django-backed AI additions — in one place.
(Named `ALL_FEATURES.md`, not `all features.md`, to keep filenames
shell/tool-friendly; content is what was asked for.) For narrower views:
[FEATURES.md](FEATURES.md) covers just the new AI backend in more depth,
[THEORY.md](THEORY.md)/[ANALYSIS.md](ANALYSIS.md) cover the algorithms and
results behind the 🤖 items below.

Legend: 🤖 = real trained model, served by `backend/`. Everything else is
client-side/simulated (see [README.md](README.md#note-on-the-ai-features)
for what "simulated" means precisely where it isn't obvious).

## Routes

| Route | Page | Backend dependency |
|---|---|---|
| `/` | Dashboard | none |
| `/energy` | Energy (5 tabs, see below) | Forecast tab only |
| `/map` | Map | occupancy panel only |
| `/automations` | Automations | none |
| `/ai-manager` | AI Manager 🤖 | yes |
| `/profile` | Profile | none |
| `/settings` | Settings | none |

## Dashboard (`/`)

- Device grid: per-device on/off toggles, persisted to `localStorage`.
- Room cards: per-room device summaries, temperature/humidity display.
- Security status card, presence card (who's home).
- Network status card.
- Energy distribution overview widget.
- Interactive floor plan (`FloorPlanInteractive`) with clickable room
  markers.
- Draggable dual-setpoint thermostat (`ThermostatCard`).
- **AI Insights panel** — rule-based heuristics over live app state
  (`useAIInsights`), *not* model-backed; see the README's note on AI
  features for the precise distinction from the 🤖 items.
- **AI Security Assistant** — scripted break-in-response demo
  (motion detected while away → reasons through it → locks doors, arms
  security); the *effects* are real app-state changes, the *reasoning* is
  scripted, not inferred.
- **Activity log** (`ActivityLogModal`) — combined seeded history + live
  notification stream.
- **Manage devices modal**, **history modal** for auditing changes.

## Energy (`/energy`)

Five tabs:

1. **Summary** — today's solar/grid/battery/cost stat cards, energy
   distribution diagram, sources table, power-sources line chart,
   electricity usage stacked bar chart, gas/water charts.
2. **Electricity** — full electricity usage breakdown, solar production
   chart, per-device monthly/total usage charts, a hover-to-highlight
   Sankey-style power-flow diagram (`EnergyFlowSankey`), grid balance bar,
   gauge donuts (net imported, self-consumed solar %, self-sufficiency %),
   detailed sources table.
3. **Gas** — gas consumption chart + period bar + totals.
4. **Water** — water consumption chart + period bar + totals.
5. **Now** — simulated *live* power feed (`useLivePower`, 2s-tick bounded
   random walk): live solar/grid/battery stat cards, a full-day
   power-sources area chart built up to "now" and blank afterward (mimics
   a real Home Assistant energy dashboard), live gauges, live power-flow
   diagram.
6. **Forecast 🤖** — 48h ensemble energy forecast (RandomForest +
   Holt-Winters) with a 95% prediction interval band, an hour-by-hour data
   table (per-model + ensemble + interval columns), a what-if scenario
   tool ("run this appliance at hour X"), and model test-metric chips.
   Backed by `GET/POST /api/forecasting/forecast/`.

## Map (`/map`)

- Leaflet map, home-zone radius circle, family-member markers with
  home/away styling and popups.
- **Predicted occupancy 🤖** — floating panel, one card per dashboard room
  (Living Room, Bedroom, Kitchen, Bathroom, Office, Garage), each with an
  occupancy-probability bar, percentage, and occupied/empty badge; "Live"
  badge, auto-refreshes every 30s. Backed by `POST /api/occupancy/predict/`.

## Automations (`/automations`)

- Automation rule list (trigger → condition → action), toggleable.
- Scene activation cards.

## AI Manager (`/ai-manager`) 🤖

- Hour / battery-charge input controls.
- Current recommendation: action label, plain-language explanation, state
  chip (hour/price-tier/solar-tier/battery-tier).
- Accept / Reject buttons — persists the decision.
- Horizontal bar chart of the Q-value the agent learned for *every*
  action in the current state (not just the recommended one).
- Full list of alternatives with their Q-values, color-coded to the chart.
- Recommendation history table (time, hour, action, Q-value, status),
  newest first.
- Backed by `GET /api/energy-manager/recommend/`,
  `GET /api/energy-manager/history/`,
  `POST /api/energy-manager/recommendations/<id>/decide/`.

## Notifications

- Real notification center (bell icon) — every meaningful app-state change
  (device toggle, thermostat setpoint, room device, AI Assistant action)
  is recorded, viewable, dismissible. Persisted via `useNotifications`.

## Profile / Settings (`/profile`, `/settings`)

- Theme toggle (light/dark), persisted.
- Localization: timezone, number/date/time format, first day of week.
- Home-Assistant-style settings landing page layout.

---

## Backend API surface (`backend/`, all under `/api/`)

| Method & path | App | Purpose |
|---|---|---|
| `GET /forecasting/forecast/?horizon=` | forecasting | Ensemble forecast |
| `POST /forecasting/forecast/` | forecasting | Forecast + what-if scenario |
| `POST /occupancy/predict/` | occupancy | Per-room occupancy probabilities |
| `GET /energy-manager/recommend/?hour=&battery_percent=` | energy_manager | Get + persist a recommendation |
| `GET /energy-manager/history/` | energy_manager | Recent recommendations |
| `POST /energy-manager/recommendations/<id>/decide/` | energy_manager | Accept/reject a recommendation |

## Models & algorithms used (see [THEORY.md](THEORY.md) for details)

| Direction | Algorithms | Library |
|---|---|---|
| A — Forecasting | RandomForestRegressor (multi-output), Holt-Winters Exponential Smoothing, seasonal-naive baseline | scikit-learn, statsmodels |
| C — Occupancy | RandomForestClassifier, LogisticRegression | scikit-learn |
| D — Prescriptive energy management | Tabular Q-learning over a custom Gymnasium MDP | gymnasium (env only; agent is a hand-rolled NumPy Q-table, no RL library dependency) |

## Datasets used

| Dataset | Used by | Size | Source |
|---|---|---|---|
| UCI Individual Household Electric Power Consumption | Forecasting | 2,075,259 minute-level rows (~34k hourly after resampling) | https://archive.ics.uci.edu/dataset/235 |
| UCI Occupancy Detection Dataset | Occupancy | 8,143 train + 12,417 test rows | https://archive.ics.uci.edu/dataset/357 |
| *(none — simulated MDP)* | Prescriptive energy management | n/a | see `energy_manager/ml/env.py`, documented in THEORY.md/ROADMAP.md |

## Tech stack summary

- **Frontend**: React 19, React Router 7, Vite, Chart.js/react-chartjs-2,
  Leaflet/react-leaflet, Oxlint, plain CSS.
- **Backend**: Django 4.2, Django REST Framework, django-cors-headers,
  scikit-learn, statsmodels, pandas, numpy, joblib, gymnasium, SQLite.
