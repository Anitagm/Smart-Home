# Features

What exists today, what it's backed by, and where it lives.

## Frontend (existing, unchanged)

React 19 + Vite dashboard: energy monitoring, device/room grids, an
interactive floor plan and map, automations, notifications, and an existing
(rule-based, non-ML) `AIInsightsPanel` / `AISecurityAssistant`. Fully
client-side, fully mock data. See the original `README.md` for the full
list — nothing here was removed.

## New: Django ML backend (`backend/`)

A separate Django + Django REST Framework service. The React app calls it
over HTTP (CORS-enabled for the Vite dev origins); nothing in the existing
frontend was migrated into it — see [ROADMAP.md](ROADMAP.md) for why.

### A — Energy forecasting (`backend/forecasting/`)

- **Dataset**: [UCI Individual Household Electric Power
  Consumption](https://archive.ics.uci.edu/dataset/235) — 2,075,259
  minute-level readings, Dec 2006–Nov 2010, resampled to hourly.
- **Models**: RandomForestRegressor (multi-output, direct 48h forecast from
  a 72h lagged window) + Holt-Winters Exponential Smoothing, ensembled by
  averaging; their disagreement forms a 95% prediction interval.
- **Held-out test metrics** (hourly kW): RF MAE 0.457 / RMSE 0.603,
  Holt-Winters MAE 0.596 / RMSE 0.800, vs. seasonal-naive baseline MAE
  0.505 / RMSE 0.764 — the RF ensemble beats the naive baseline.
- **API**: `GET /api/forecasting/forecast/?horizon=48`,
  `POST /api/forecasting/forecast/` with `{horizon, whatif_kwh,
  whatif_hours}` for a "what if I ran this appliance at hour X" scenario
  layered on top of the forecast.
- **Frontend**: Energy page → new **Forecast** tab — interval chart, a
  what-if control, and the metrics above rendered as chips.

### C — Occupancy prediction (`backend/occupancy/`)

- **Dataset**: [UCI Occupancy Detection
  Dataset](https://archive.ics.uci.edu/dataset/357) — temperature, humidity,
  light, CO2, humidity ratio, ground-truth occupancy from timestamped
  photos.
- **Models**: RandomForestClassifier + Logistic Regression.
- **Held-out test metrics**: RF accuracy 0.966 / F1 0.931 / ROC-AUC 0.994;
  LogReg accuracy 0.990 / F1 0.980 / ROC-AUC 0.995.
- **API**: `POST /api/occupancy/predict/` with the dashboard's room list;
  returns a per-room occupancy probability (see MINDSET.md for how a
  single-room dataset is applied across six mock rooms — documented
  extrapolation, not six real sensor histories).
- **Frontend**: Map page → floating **Predicted occupancy** panel, one card
  per room with a probability bar and occupied/empty badge.

### D — Prescriptive energy management (`backend/energy_manager/`)

- **Environment**: a custom Gymnasium env simulating one day of home energy
  (time-of-use price, a daylight solar curve, a battery) — see
  `backend/energy_manager/ml/env.py`. No public dataset exists for this;
  documented as a grounded simulation in MINDSET.md.
- **Agent**: tabular Q-learning (648 states × 4 actions), 4,000 training
  episodes, ~3 seconds to converge.
- **Evaluation** (avg. return over 200 eval episodes): learned policy
  **+0.109**, vs. always-idle baseline **−4.404**, vs. a naive fixed-time
  baseline **−1.123** — the learned policy clearly outperforms both.
- **API**: `GET /api/energy-manager/recommend/?hour=&battery_percent=`
  (also persists the recommendation), `GET
  /api/energy-manager/history/`, `POST
  /api/energy-manager/recommendations/<id>/decide/` with `{status:
  "accepted"|"rejected"}`.
- **Frontend**: new **AI Manager** page (sidebar) — the agent's
  recommendation, its reasoning, all alternative actions with their
  learned Q-values, accept/reject buttons, and a full decision history
  table (the human-in-the-loop trail).

## Cross-cutting

- `backend/ml_artifacts/` holds cached datasets and trained model
  checkpoints (git-ignored — regenerate with the `train_*` management
  commands, see `backend/README.md`).
- Every endpoint returns `503` with a plain-English instruction if its
  model hasn't been trained yet, instead of silently fabricating a
  response.
- `src/api/client.js` is the single fetch layer the three new hooks
  (`useForecast`, `useOccupancy`, `useEnergyManager`) go through.
