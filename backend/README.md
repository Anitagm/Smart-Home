# SmartHome AI backend

Django + Django REST Framework service providing the three ML-backed
features described in [../FEATURES.md](../FEATURES.md):

| App              | Direction | What it serves                          |
|-------------------|-----------|------------------------------------------|
| `forecasting`     | A         | 24-48h energy forecast + what-if scenarios |
| `occupancy`       | C         | per-room occupancy probability            |
| `energy_manager`  | D         | Q-learning action recommendations + history |

See [../MINDSET.md](../MINDSET.md) for *why* it's built this way and
[../ROADMAP.md](../ROADMAP.md) for what's intentionally out of scope.

## Setup

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
python manage.py migrate
```

## Train the models

Each app trains independently and fast (single-digit seconds to a couple
minutes) — no GPU required. The first run also downloads its public
dataset automatically via `dataset.py` if the raw file isn't already under
`ml_artifacts/datasets/`.

```bash
python manage.py train_forecast        # UCI household power → RF + Holt-Winters, ~15s
python manage.py train_occupancy       # UCI occupancy detection → RF + LogReg, ~8s
python manage.py train_energy_manager  # tabular Q-learning, ~3s
```

Trained artifacts land in `ml_artifacts/<app>/` (git-ignored — see
`.gitignore`). Every endpoint returns HTTP 503 with a plain-English message
telling you which command to run if you hit it before training.

## Run the API

```bash
python manage.py runserver 127.0.0.1:8000
```

The React app (run separately, `npm run dev` from the repo root) expects
this at `http://127.0.0.1:8000/api` by default — see `../.env.example`. CORS
is pre-configured for the Vite dev origins in `smarthome_ai/settings.py`.

## Endpoints

```
GET  /api/forecasting/forecast/?horizon=48
POST /api/forecasting/forecast/            { horizon, whatif_kwh, whatif_hours }

POST /api/occupancy/predict/               { rooms: [...] }

GET  /api/energy-manager/recommend/?hour=&battery_percent=
GET  /api/energy-manager/history/
POST /api/energy-manager/recommendations/<id>/decide/   { status: "accepted"|"rejected" }
```

## Datasets

Both real datasets are pulled from the UCI Machine Learning Repository the
first time you train:

- [Individual Household Electric Power
  Consumption](https://archive.ics.uci.edu/dataset/235) (forecasting)
- [Occupancy Detection Dataset](https://archive.ics.uci.edu/dataset/357)
  (occupancy)

The energy-manager's environment (`energy_manager/ml/env.py`) has no
dataset — it's a documented simulation, see MINDSET.md.
