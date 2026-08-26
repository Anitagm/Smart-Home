#!/usr/bin/env sh
# Entrypoint for the backend container: migrate, train any missing models
# (idempotent — skips a direction if its checkpoint is already there), then
# serve with gunicorn. Runs every time the container starts so a fresh
# volume trains itself automatically on first `docker compose up`.
set -e

# When SQLITE_DB_PATH points at a mounted volume dir, make sure it exists.
if [ -n "$SQLITE_DB_PATH" ]; then
  mkdir -p "$(dirname "$SQLITE_DB_PATH")"
fi

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

train_if_missing () {
  marker="$1"
  command="$2"
  label="$3"
  if [ -f "$marker" ]; then
    echo "[entrypoint] $label already trained, skipping."
  else
    echo "[entrypoint] Training $label..."
    python manage.py "$command"
  fi
}

train_if_missing "ml_artifacts/forecasting/holt_winters.pickle"  train_forecast        "forecasting"
train_if_missing "ml_artifacts/occupancy/logistic_regression.joblib" train_occupancy   "occupancy"
train_if_missing "ml_artifacts/energy_manager/q_table.npy"       train_energy_manager  "energy manager"

echo "[entrypoint] Starting gunicorn on 0.0.0.0:8000"
exec gunicorn smarthome_ai.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120
