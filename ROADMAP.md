# Roadmap

See also: [THEORY.md](THEORY.md), [ANALYSIS.md](ANALYSIS.md) (esp. its
[Limitations & threats to validity](ANALYSIS.md#limitations--threats-to-validity)
section, which motivates several items below), [INTUITION.md](INTUITION.md),
[ALL_FEATURES.md](ALL_FEATURES.md), [TODO.md](TODO.md).

## Done

- [x] Django + DRF backend scaffolded alongside the existing React app
      (`backend/`, three apps: `forecasting`, `occupancy`, `energy_manager`).
- [x] Direction A — energy forecasting: real UCI dataset, RF + Holt-Winters
      ensemble, prediction intervals, what-if API, Forecast tab in the UI.
- [x] Direction C — occupancy prediction: real UCI dataset, RF + LogReg,
      per-room predictions synthesized onto the dashboard's mock rooms,
      occupancy panel on the Map page.
- [x] Direction D — prescriptive energy management: custom Gymnasium env,
      tabular Q-learning agent, recommend/accept/reject API with a
      persisted decision history, new AI Manager page.
- [x] CORS wired for local dev; end-to-end verified (backend serving real
      inference, frontend rendering it, `npm run build` clean, `oxlint`
      clean on all new files).

## Deliberately deferred (documented scope cuts, not oversights)

These are the gaps between what shipped and the original four-direction
proposal — listed so the paper's "future work" section doesn't have to be
invented from scratch, and so nobody mistakes a scope choice for a bug.

- **Direction B (LSTM-Autoencoder anomaly detection)** was in scope for the
  original brainstorm but not requested in the build; the backend's app
  structure (`ml/dataset.py` / `train.py` / `infer.py` +
  `management/commands/train_<app>.py`) is set up so it can be added the
  same way the other three were.
- **Forecasting ensemble depth**: currently 2 members (RF + Holt-Winters).
  The original plan (LSTM/GRU/CNN-LSTM) is real future work if training
  time stops being a constraint — it would very plausibly beat the current
  RF/ETS numbers, it was just slower to iterate on interactively. The
  scaffolding (`dataset.make_windows`, standardized train/val/test splits)
  was written to make dropping a torch model back in straightforward.
- **Occupancy: one real room, extrapolated to six.** No public
  multi-room-labeled dataset was substituted in; getting real per-room data
  (or at least a second, structurally different dataset) would make this
  claim materially stronger for a paper and is the single highest-value
  next step for Direction C.
- **DRL environment fidelity**: `HomeEnergyEnv` uses hand-set constants
  (appliance kWh, battery capacity, TOU price bands) rather than values
  fit from data. Grounding these in the UCI power dataset's actual
  sub-metering columns (already loaded for Direction A) is a natural next
  step and would let the two directions cite consistent numbers.
- **No authentication / multi-home support** on the backend — it's a
  single-process research prototype, not a deployable multi-tenant
  service. Fine for a paper demo, not fine to expose publicly as-is.
- **No production deployment config** (gunicorn/uwsgi, static file
  serving, `DEBUG=False` hardening, a non-SQLite database). Left for
  whoever actually ships this beyond a demo.
- **Model retraining is manual** (`python manage.py train_<app>`). A
  scheduled retrain + versioned checkpoints would be the natural evolution
  if this moved from "trained once for the paper" to "kept current."

## Explicitly not planned

- Migrating the dashboard's existing mock data (devices, rooms, security,
  notifications, automations) into Django. Decided against during scoping:
  the ask was a new backend service the React app *calls*, not a full
  rewrite of the existing, working, fully-simulated frontend.
