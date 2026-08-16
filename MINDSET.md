# Mindset

Why this project is built the way it is — read this before changing an approach,
not just what the approach is.

## The premise

`SmartHome-portal` started as a fully client-side, fully simulated dashboard —
no backend, no real data, no model. The ask was to turn it into the
visualization/interaction layer for a real intelligent system, in support of
a scientific paper spanning IoT + ML/DL, without hardware. That means two
things have to both be true for anything we build:

1. **The model has to be real.** Trained on a real, cited, public dataset,
   with held-out test metrics that could go in a paper's results table. Not a
   number the UI makes up.
2. **The integration has to be real.** The dashboard calls a live API and
   renders whatever the model actually returns — not a canned response.

Everything else is negotiable.

## Why three directions, not one

The candidate directions (forecasting, anomaly detection, occupancy,
prescriptive DRL) aren't equally hard, and a paper is stronger showing a
system that reasons about a home in more than one way. We took the
requested subset — **A (forecasting), C (occupancy), D (prescriptive
DRL)** — and built them in that order deliberately: easiest and
best-evidenced first, so there's always a working, demoable system even if
we stop partway, and each later direction reuses the same backend
conventions (Django app per direction, `ml/` subpackage with
`dataset.py` / `train.py` / `infer.py`, a management command to (re)train,
one or two DRF endpoints) instead of inventing a new shape each time.

## Why off-the-shelf estimators instead of custom deep nets

The original plan for Direction A was an LSTM/GRU/CNN-LSTM ensemble trained
with a hand-rolled PyTorch loop. It worked, but it was slow and opaque to
watch train (silent for minutes at a time with nothing to show for it,
which is a bad trade in an interactive session where the person on the
other end can't tell "training" apart from "stuck"). We pivoted, on
explicit request, to well-established estimators that fit in single-digit
seconds:

- **Forecasting**: RandomForestRegressor (multi-output) + Holt-Winters
  Exponential Smoothing, benchmarked against a seasonal-naive baseline.
- **Occupancy**: RandomForestClassifier + Logistic Regression.
- **Prescriptive energy management**: tabular Q-learning over a small
  discretized state space (648 states × 4 actions) rather than
  stable-baselines3/DQN — the state space is small enough that a Q-table
  converges in ~3 seconds and is directly inspectable, so the extra
  machinery of a neural policy buys nothing here.

This is a legitimate methodological choice, not just a shortcut: for a
paper, "we ensembled a tree-based model with a classical statistical
model and beat the seasonal-naive baseline" is a fine, honest claim. It's
weaker than a well-tuned LSTM ensemble *could* be, and that gap is recorded
in [ROADMAP.md](ROADMAP.md) as real future work, not hidden.

## What's genuinely simulated vs. genuinely real

Be precise about this in the paper — it's the difference between a claim
that survives review and one that doesn't:

- **Real**: the forecasting dataset (UCI household power, 2.07M rows) and
  the occupancy dataset (UCI Occupancy Detection) are the actual public
  datasets, downloaded and split as published. Model metrics are computed
  on held-out test data, not training data.
- **Extrapolated, documented**: the occupancy model was trained on a single
  real office room, then applied per-room across the dashboard's six mock
  rooms by synthesizing a feature vector from what the dashboard already
  knows about each room (temperature, humidity, whether its lights are on)
  — see the docstring in `backend/occupancy/ml/infer.py`. This is not six
  rooms of real sensor history; it's one real model run six times on
  synthesized-but-schema-correct inputs.
- **Simulated by necessity**: there's no public dataset of "what should a
  smart home do next" control decisions, so Direction D's environment
  (`backend/energy_manager/ml/env.py`) is a designed simulation — a
  time-of-use price curve, a daylight solar curve, a battery — grounded in
  the same assumptions already present in the dashboard's original mock
  energy data, not invented from nothing.

## Working style for this repo

- Every ML app follows the same shape: `ml/dataset.py` (load + cache),
  `ml/train.py` (fit + evaluate + save), `ml/infer.py` (load cached
  artifacts once, serve), a `management/commands/train_<app>.py` entry
  point, and a couple of DRF views. Copy that shape for any new direction
  rather than inventing a new one.
- Training must stay fast enough to run synchronously in a normal terminal
  (single-digit seconds to low minutes) unless there's a specific,
  documented reason a slower model is worth it. If a training run's silent
  for more than ~30s, that's a signal to check it, not just wait.
- Every model reports honest held-out metrics against at least one naive
  baseline. No endpoint is allowed to fabricate numbers when the model
  hasn't been trained yet — it returns 503 with instructions instead (see
  `ForecastNotReady` / `OccupancyModelNotReady` / `AgentNotReady`).
