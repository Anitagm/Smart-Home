"""Fit the forecasting ensemble on the UCI household power dataset.

Deliberately uses established, off-the-shelf estimators rather than a
hand-rolled deep-learning training loop:

  * RandomForestRegressor (scikit-learn) — multi-output regression predicts
    the full 48h horizon directly from a lagged/calendar feature vector.
    Handles nonlinearity and feature interactions well, fits in seconds.
  * Holt-Winters Exponential Smoothing (statsmodels) — a classical, widely
    deployed statistical forecaster with double (trend + daily) seasonality,
    fit independently per forecast origin.
  * Seasonal-naive — the "yesterday same hour" baseline every forecasting
    paper benchmarks against.

Ensembling two structurally different models (tree-based ML vs. classical
statistical) gives a meaningful disagreement-based prediction interval
without the training-time cost/instability of a neural sequence model, and
without depending on a hosted pretrained checkpoint. See ROADMAP.md for why
this replaced the original LSTM/GRU/CNN-LSTM plan.

Run via: python manage.py train_forecast
"""
from __future__ import annotations

import json
import time
import warnings

import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from sklearn.ensemble import RandomForestRegressor
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from .dataset import FEATURE_COLUMNS, TARGET_COLUMN, load_hourly_series, make_windows, train_val_test_split

ARTIFACT_DIR = settings.ML_ARTIFACTS_DIR / 'forecasting'
LOOKBACK = 72   # 3 days of hourly history used as RF input features
HORIZON = 48    # predict the next 48 hours


def _flatten(x):
    """(n, lookback, n_features) -> (n, lookback * n_features) for the RF."""
    return x.reshape(x.shape[0], -1)


def _fit_random_forest(x_train, y_train, x_test, y_test):
    model = RandomForestRegressor(
        n_estimators=80, max_depth=10, max_features='sqrt',
        n_jobs=-1, random_state=42, min_samples_leaf=5,
    )
    t0 = time.time()
    model.fit(_flatten(x_train), y_train)
    fit_seconds = time.time() - t0
    pred = model.predict(_flatten(x_test))
    mae = float(np.mean(np.abs(pred - y_test)))
    rmse = float(np.sqrt(np.mean((pred - y_test) ** 2)))
    return model, {'fit_seconds': fit_seconds, 'test_mae_kw': mae, 'test_rmse_kw': rmse}


def _fit_holt_winters(train_series, test_df):
    """Fit one seasonal ETS model on the training series; evaluate it by
    rolling it forward over the test set in HORIZON-sized chunks (refit is
    cheap — each fit is <1s on an hourly series)."""
    t0 = time.time()
    train_values = np.asarray(train_series.values, dtype=np.float64)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        fitted = ExponentialSmoothing(
            train_values, trend=None, seasonal='mul', seasonal_periods=24,
            initialization_method='estimated',
        ).fit()
    fit_seconds = time.time() - t0

    errors = []
    step = HORIZON
    test_vals = np.asarray(test_df[TARGET_COLUMN].values, dtype=np.float64)
    history = train_values.copy()
    for start in range(0, len(test_vals) - HORIZON, step * 4):  # sample every 4th window, full walk-forward is slow
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            local_fit = ExponentialSmoothing(
                history[-24 * 30:], trend=None, seasonal='mul', seasonal_periods=24,
                initialization_method='estimated',
            ).fit()
        pred = np.asarray(local_fit.forecast(HORIZON))
        truth = test_vals[start:start + HORIZON]
        errors.append(np.abs(pred - truth))
        history = np.concatenate([history, test_vals[start:start + step]])

    errors = np.concatenate(errors) if errors else np.array([0.0])
    return fitted, {
        'fit_seconds': fit_seconds,
        'test_mae_kw': float(np.mean(errors)),
        'test_rmse_kw': float(np.sqrt(np.mean(errors ** 2))),
    }


def _seasonal_naive_metrics(x_test, y_test):
    last24 = x_test[:, -24:, FEATURE_COLUMNS.index(TARGET_COLUMN)]
    reps = int(np.ceil(HORIZON / 24))
    pred = np.tile(last24, (1, reps))[:, :HORIZON]
    mae = float(np.mean(np.abs(pred - y_test)))
    rmse = float(np.sqrt(np.mean((pred - y_test) ** 2)))
    return {'test_mae_kw': mae, 'test_rmse_kw': rmse}


def train_all(force_reload_data: bool = False):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    df = load_hourly_series(force_reload=force_reload_data)
    train_df, val_df, test_df = train_val_test_split(df)
    # RF/ETS get train+val combined (no gradient-descent early stopping to tune here).
    rf_train_df = pd.concat([train_df, val_df])

    x_train, y_train = make_windows(rf_train_df, LOOKBACK, HORIZON)
    x_test, y_test = make_windows(test_df, LOOKBACK, HORIZON)

    print(f'Training windows: {x_train.shape[0]}, test windows: {x_test.shape[0]}')

    rf_model, rf_metrics = _fit_random_forest(x_train, y_train, x_test, y_test)
    joblib.dump(rf_model, ARTIFACT_DIR / 'random_forest.joblib')
    print(f"[random_forest] fit in {rf_metrics['fit_seconds']:.1f}s  "
          f"test MAE={rf_metrics['test_mae_kw']:.3f} kW  RMSE={rf_metrics['test_rmse_kw']:.3f} kW")

    hw_model, hw_metrics = _fit_holt_winters(rf_train_df[TARGET_COLUMN], test_df)
    hw_model.save(str(ARTIFACT_DIR / 'holt_winters.pickle'))
    print(f"[holt_winters] fit in {hw_metrics['fit_seconds']:.1f}s  "
          f"test MAE={hw_metrics['test_mae_kw']:.3f} kW  RMSE={hw_metrics['test_rmse_kw']:.3f} kW")

    naive_metrics = _seasonal_naive_metrics(x_test, y_test)
    print(f"[seasonal_naive] test MAE={naive_metrics['test_mae_kw']:.3f} kW  RMSE={naive_metrics['test_rmse_kw']:.3f} kW")

    meta = {
        'lookback': LOOKBACK,
        'horizon': HORIZON,
        'feature_columns': FEATURE_COLUMNS,
        'target_column': TARGET_COLUMN,
        'dataset': 'UCI Individual Household Electric Power Consumption (resampled to hourly)',
        'models': ['random_forest', 'holt_winters'],
        'trained_at': time.time(),
        'train_seconds': time.time() - t0,
        'results': {
            'random_forest': rf_metrics,
            'holt_winters': hw_metrics,
            'seasonal_naive': naive_metrics,
        },
    }
    with open(ARTIFACT_DIR / 'meta.json', 'w') as f:
        json.dump(meta, f, indent=2)

    print(f'Done in {time.time() - t0:.1f}s. Artifacts written to {ARTIFACT_DIR}')
    return meta
