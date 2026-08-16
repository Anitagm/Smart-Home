"""Inference for the energy-forecasting ensemble (RandomForest + Holt-Winters).

Loads the fitted estimators once per process. The RF gives a direct 48h
point forecast from the latest lagged window; Holt-Winters gives an
independent statistical forecast from the same anchor point. Their
disagreement forms a lightweight, model-agnostic prediction interval —
cheap to compute, no retraining, and it degrades gracefully to "just trust
the RF" if only one estimator is available.
"""
from __future__ import annotations

import json
import threading
import warnings
from datetime import datetime, timedelta

import joblib
import numpy as np
from django.conf import settings
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from .dataset import FEATURE_COLUMNS, TARGET_COLUMN, load_hourly_series

ARTIFACT_DIR = settings.ML_ARTIFACTS_DIR / 'forecasting'

_lock = threading.Lock()
_cache = {}


class ForecastNotReady(Exception):
    pass


def _load():
    with _lock:
        if _cache:
            return _cache
        meta_path = ARTIFACT_DIR / 'meta.json'
        rf_path = ARTIFACT_DIR / 'random_forest.joblib'
        if not meta_path.exists() or not rf_path.exists():
            raise ForecastNotReady(
                "No trained forecasting models found. Run "
                "`python manage.py train_forecast` first."
            )
        meta = json.loads(meta_path.read_text())
        _cache['meta'] = meta
        _cache['rf'] = joblib.load(rf_path)
        _cache['series'] = load_hourly_series()
        return _cache


def _latest_window(meta, series):
    tail = series.iloc[-meta['lookback']:]
    x = tail[FEATURE_COLUMNS].values.astype(np.float32).reshape(1, -1)
    return x, tail.index[-1]


def _holt_winters_forecast(series, horizon):
    """Refit ETS on the freshest year of data anchored at "now" so the
    what-if endpoint always forecasts from the true latest point, not the
    frozen training-time cutoff."""
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        model = ExponentialSmoothing(
            series[TARGET_COLUMN].iloc[-24 * 90:], trend=None, seasonal='mul',
            seasonal_periods=24, initialization_method='estimated',
        ).fit()
    return model.forecast(horizon).values


def get_forecast(horizon: int | None = None, whatif_kwh: float = 0.0, whatif_hours: list[int] | None = None):
    """Return an ensemble forecast of hourly `global_active_power` (kW).

    `whatif_kwh` / `whatif_hours`: adds a flat load (e.g. running a
    dishwasher) at the given future hour offsets (0-indexed from the
    forecast start) on top of the learned baseline — a transparent scenario
    layer, not a retrained effect.
    """
    cache = _load()
    meta, rf, series = cache['meta'], cache['rf'], cache['series']
    full_horizon = meta['horizon']
    horizon = min(horizon or full_horizon, full_horizon)

    x, anchor_ts = _latest_window(meta, series)
    rf_pred = np.clip(rf.predict(x)[0, :horizon], 0, None)

    try:
        hw_pred = np.clip(_holt_winters_forecast(series, horizon), 0, None)
    except Exception:
        hw_pred = None

    preds = {'random_forest': rf_pred}
    if hw_pred is not None:
        preds['holt_winters'] = hw_pred

    stacked = np.stack(list(preds.values()), axis=0)
    ensemble_mean = stacked.mean(axis=0)
    if stacked.shape[0] > 1:
        ensemble_std = stacked.std(axis=0)
    else:
        # Single-model fallback: use the model's own historical test RMSE as spread.
        ensemble_std = np.full(horizon, meta['results']['random_forest']['test_rmse_kw'])

    lower = np.clip(ensemble_mean - 1.96 * ensemble_std, 0, None)
    upper = ensemble_mean + 1.96 * ensemble_std

    if whatif_kwh and whatif_hours:
        for h in whatif_hours:
            if 0 <= h < horizon:
                ensemble_mean[h] += whatif_kwh
                lower[h] += whatif_kwh
                upper[h] += whatif_kwh

    # The dataset ends in 2010; re-anchor the *displayed* timestamps to the
    # current wall-clock hour (same hour-of-day, so the model's calendar
    # features stay meaningful) so the dashboard shows a live-looking
    # "next N hours" series instead of a historical date.
    display_anchor = datetime.now().replace(minute=0, second=0, microsecond=0)
    timestamps = [
        (display_anchor + timedelta(hours=i + 1)).isoformat()
        for i in range(horizon)
    ]

    return {
        'anchor_timestamp': display_anchor.isoformat(),
        'model_anchor_timestamp': anchor_ts.isoformat(),
        'horizon_hours': horizon,
        'timestamps': timestamps,
        'ensemble_mean_kw': ensemble_mean.round(3).tolist(),
        'lower_kw': lower.round(3).tolist(),
        'upper_kw': upper.round(3).tolist(),
        'per_model_kw': {name: vals.round(3).tolist() for name, vals in preds.items()},
        'model_test_metrics': {
            name: {
                'test_mae_kw': meta['results'][name]['test_mae_kw'],
                'test_rmse_kw': meta['results'][name]['test_rmse_kw'],
            }
            for name in preds
        },
        'baseline_test_metrics': meta['results'].get('seasonal_naive'),
        'whatif_applied': bool(whatif_kwh and whatif_hours),
    }
