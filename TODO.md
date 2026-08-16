# TODO

Actionable, in rough priority order. See [ROADMAP.md](ROADMAP.md) for the
narrative version of most of these.

## Before writing the paper

- [ ] Decide whether to push the forecasting ensemble to LSTM/GRU/CNN-LSTM
      (higher potential accuracy, longer training) or keep RF + Holt-Winters
      and write up *why* (see MINDSET.md) as a methodological choice.
- [ ] Re-run `train_forecast` / `train_occupancy` / `train_energy_manager`
      right before collecting final numbers for the results section —
      they're fast enough to be part of the reproducibility checklist, not
      just a one-time setup step.
- [ ] Write the "System Architecture" section describing the Django
      backend / React frontend split and the request flow (see
      FEATURES.md's API list).
- [ ] Decide whether Direction B (anomaly detection) is worth adding for a
      stronger paper, or explicitly scoped out in the paper text too.

## Backend

- [ ] Ground `HomeEnergyEnv`'s constants (appliance kWh, battery capacity,
      TOU price bands) in real sub-metering data from the UCI power dataset
      instead of hand-picked values.
- [ ] Find or build a second occupancy dataset (ideally multi-room) to
      validate the per-room extrapolation described in MINDSET.md.
- [ ] Add basic request validation/tests for the three apps' views
      (currently no automated test coverage — `tests.py` is still the
      Django default stub in each app).
- [ ] Consider caching `/forecasting/forecast/` for a few minutes — it
      recomputes an Exponential Smoothing fit on every request.

## Frontend

- [ ] Handle the "backend not running" state more gracefully across all
      three new features — right now each shows its own inline error, a
      shared banner/toast might read better.
- [ ] Add a loading skeleton for the Forecast chart instead of the plain
      "Loading forecast…" text.
- [ ] Consider a settings toggle for `VITE_API_BASE_URL` in-app (currently
      build-time only, via `.env.local`).

## Nice to have, not blocking

- [ ] Dockerize `backend/` for easier reviewer/grader setup.
- [ ] Add a `Makefile` or npm script that starts both servers together for
      local dev.
