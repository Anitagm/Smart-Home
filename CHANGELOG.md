# Changelog

## 2026-08-26 — Dockerize + README overhaul

Full Docker Compose setup for the whole stack (frontend + backend), a
one-command `run.sh` wrapper, and a rewritten README (badges, tech-stack/
feature tables, architecture diagram, how-to-use walkthrough, model
performance table).

### Added

- `Dockerfile` — Node build stage -> nginx runtime for the frontend.
- `backend/Dockerfile` + `backend/entrypoint.sh` — migrate, train any
  missing model, then serve with gunicorn.
- `nginx.conf` — static serving + `/api` and `/admin` reverse proxy to the
  backend container.
- `docker-compose.yml` — `frontend`/`backend` services, named volumes for
  the sqlite DB and trained model artifacts.
- `run.sh` — `up`/`stop`/`down`/`reset`/`logs` one-command wrapper.
- `.dockerignore` (root + backend).

### Changed

- `backend/smarthome_ai/settings.py` — sqlite path now overridable via
  `SQLITE_DB_PATH`, so the Docker image can point it at a mounted volume.
- `README.md` — badges, animated header, table of contents, features/
  tech-stack/model-performance tables, architecture diagram (Mermaid), a
  How to use walkthrough, and Docker-first quickstart.


## 2026-08-23 — Sync

Synced repository state (2026-08-23).

## 2026-08-16 (3) — Paper-facing documentation: theory, analysis, intuition

Added four documents specifically written for someone (human or AI agent)
turning this project into a scientific paper — formal algorithm
descriptions with citations, the actual result tables with an honest read
of what they do and don't show, plain-language reasoning for each design
choice, and a complete feature/route/API/dataset inventory.

### Added

- `THEORY.md` — formal problem statements, algorithms (Random Forest,
  Holt-Winters, Q-learning/Bellman equation), equations, and citations for
  all three directions.
- `ANALYSIS.md` — full result tables pulled live from each app's
  `meta.json`, per-metric interpretation, the Holt-Winters bug write-up
  with before/after numbers, and a "Limitations & threats to validity"
  section (internal/external/construct validity, statistical caveats)
  aimed directly at what a paper reviewer would ask.
- `INTUITION.md` — plain-language mental models for why each approach was
  chosen, no equations, meant to seed a paper's introduction/motivation
  section and to keep future extensions consistent with the project's
  reasoning.
- `ALL_FEATURES.md` — complete feature/route/API/dataset/algorithm
  inventory spanning both the original client-only dashboard and the new
  AI backend (supersedes needing to cross-reference `FEATURES.md` +
  `README.md` for the full picture).

### Changed

- `MINDSET.md`, `ROADMAP.md`, `README.md`: cross-linked to the four new
  documents.

## 2026-08-16 (2) — Visual polish, real demo screenshots/GIF, Holt-Winters fix

### Added

- `ForecastPanel`: an hour-by-hour data table below the chart (per-model +
  ensemble + interval), plus an entrance fade-in animation.
- `AIManagerPage`: a horizontal bar chart of the learned Q-value per action
  (color-matched to the action list), entrance animation on the
  recommendation card.
- `OccupancyHeatmap`: a "Live" badge matching the Energy Now tab's style,
  staggered fade-in per room card.
- `src/styles/ai-features.css`: shared `.ai-fade-in` keyframe animation used
  across all three AI panels.
- Real screenshots (`docs/media/7-forecast.png`, `8-occupancy-map.png`,
  `9-ai-manager.png`) and a new `docs/media/ai-features-demo.gif`, captured
  with a headless-Chromium (Puppeteer) script against the live app —
  embedded in `README.md`'s screenshot gallery.
- Served the built dashboard + backend on the user's server (port 6050
  frontend / 8000 backend) for a live look; opened both ports in `ufw`
  (previously default-deny beyond a fixed allowlist).

### Fixed

- **Holt-Winters forecast collapsing to ~0 past hour 2**: the original
  `trend='add', seasonal='add'` config extrapolated a negative trend that
  got clipped to zero for most of the 48h horizon, badly degrading both the
  chart and the ensemble mean. Switched to `trend=None, seasonal='mul'`,
  which fits this non-negative, non-trending, strongly diurnal series far
  better — Holt-Winters test RMSE improved 0.800 → 0.761 kW, and it now
  tracks the daily cycle sensibly instead of flatlining. Caught by actually
  looking at a rendered chart, not just the aggregate error metric.
- Installed `fonts-noto-color-emoji` so the 🤖 badges used throughout the
  new AI panels render as emoji instead of tofu boxes in screenshots (and
  in any headless-Chromium-rendered context generally).

## 2026-08-16 — Django ML backend + 3 AI features

Added a Django/DRF backend (`backend/`) alongside the existing React
dashboard and wired three real, trained ML features into the UI. See
[FEATURES.md](FEATURES.md) for details, [MINDSET.md](MINDSET.md) for the
reasoning, [ROADMAP.md](ROADMAP.md) for what's next.

### Added

- **Backend scaffold**: Django 4.2 project `smarthome_ai` with
  `djangorestframework` + `django-cors-headers`, three apps
  (`forecasting`, `occupancy`, `energy_manager`), SQLite for persistence.
- **Direction A — energy forecasting** (`forecasting/`): RandomForest +
  Holt-Winters ensemble trained on the real UCI household power dataset
  (2.07M readings), 95% prediction interval from model disagreement, a
  what-if scenario endpoint. New **Forecast** tab on the Energy page.
- **Direction C — occupancy prediction** (`occupancy/`): RandomForest +
  Logistic Regression trained on the real UCI Occupancy Detection dataset,
  applied per-room to the dashboard's mock rooms. New floating **Predicted
  occupancy** panel on the Map page.
- **Direction D — prescriptive energy management** (`energy_manager/`):
  custom Gymnasium environment + tabular Q-learning agent recommending an
  hourly action (idle / run flexible load / charge / discharge battery),
  with a persisted, human-in-the-loop accept/reject history. New **AI
  Manager** page + sidebar entry.
- **Frontend**: `src/api/client.js` fetch layer, `useForecast` /
  `useOccupancy` / `useEnergyManager` hooks, `ForecastPanel` /
  `OccupancyHeatmap` components, `AIManagerPage`, `src/styles/ai-features.css`.
- **Docs**: this file, `MINDSET.md`, `ROADMAP.md`, `FEATURES.md`,
  `TODO.md`, `backend/README.md`, `.env.example`.

### Changed

- `.gitignore`: added backend virtualenv / `db.sqlite3` / `ml_artifacts/`
  / `__pycache__` entries.
- `src/main.jsx`: imports the new `ai-features.css`.
- `src/App.jsx`, `src/layout/Sidebar.jsx`: added the `/ai-manager` route
  and nav entry.
- `src/pages/EnergyPage.jsx`: added the "Forecast 🤖" tab.
- `src/pages/MapPage.jsx`: renders `OccupancyHeatmap` as an overlay panel.

### Notes on process

- Direction A originally trained a custom LSTM/GRU/CNN-LSTM ensemble in
  PyTorch; it worked but was slow to iterate on (minutes of silent
  training). Per explicit request, switched to off-the-shelf, fast-fitting
  estimators (RandomForest, Holt-Winters, tabular Q-learning) — see
  MINDSET.md for the full reasoning and what that trades away.
- Everything was verified end-to-end in this session: both real datasets
  downloaded and trained on, all three APIs smoke-tested with `curl`
  (including CORS from the Vite origin), `npm run build` and `oxlint`
  both clean.
