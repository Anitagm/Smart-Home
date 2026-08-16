"""
Data loading for the energy-forecasting module.

Source: UCI "Individual Household Electric Power Consumption" dataset
(https://archive.ics.uci.edu/dataset/235). ~2.07M minute-level readings from a
single household in Sceaux, France, Dec-2006 to Nov-2010. We resample to
hourly active power (kW) — this both matches the cadence a "next 24-48h"
smart-home forecast needs and keeps sequence lengths (and training time)
sane on CPU.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from django.conf import settings

RAW_PATH = settings.ML_ARTIFACTS_DIR / 'datasets' / 'household_power_consumption.txt'
HOURLY_CACHE_PATH = settings.ML_ARTIFACTS_DIR / 'datasets' / 'hourly_power.parquet'


def load_hourly_series(force_reload: bool = False) -> pd.DataFrame:
    """Return a DataFrame indexed by hourly timestamp with columns:
    global_active_power (kW, mean over the hour), sub_metering_1..3 (Wh),
    and calendar features (hour, day-of-week, month) used as model inputs.
    """
    if HOURLY_CACHE_PATH.exists() and not force_reload:
        return pd.read_parquet(HOURLY_CACHE_PATH)

    if not RAW_PATH.exists():
        raise FileNotFoundError(
            f"Raw UCI dataset not found at {RAW_PATH}. Download it from "
            "https://archive.ics.uci.edu/dataset/235 and unzip into "
            f"{RAW_PATH.parent}."
        )

    df = pd.read_csv(
        RAW_PATH,
        sep=';',
        na_values=['?'],
        low_memory=False,
        usecols=[
            'Date', 'Time', 'Global_active_power',
            'Sub_metering_1', 'Sub_metering_2', 'Sub_metering_3',
        ],
    )
    df['timestamp'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], format='%d/%m/%Y %H:%M:%S')
    df = df.set_index('timestamp').drop(columns=['Date', 'Time'])
    df = df.apply(pd.to_numeric, errors='coerce')

    hourly = df.resample('1h').mean()
    hourly = hourly.rename(columns={
        'Global_active_power': 'global_active_power',
        'Sub_metering_1': 'sub_metering_1',
        'Sub_metering_2': 'sub_metering_2',
        'Sub_metering_3': 'sub_metering_3',
    })
    value_cols = ['global_active_power', 'sub_metering_1', 'sub_metering_2', 'sub_metering_3']
    hourly[value_cols] = hourly[value_cols].interpolate(limit=6)
    hourly = hourly.dropna(subset=value_cols)

    hourly['hour'] = hourly.index.hour
    hourly['dow'] = hourly.index.dayofweek
    hourly['month'] = hourly.index.month
    hourly['hour_sin'] = np.sin(2 * np.pi * hourly['hour'] / 24)
    hourly['hour_cos'] = np.cos(2 * np.pi * hourly['hour'] / 24)
    hourly['dow_sin'] = np.sin(2 * np.pi * hourly['dow'] / 7)
    hourly['dow_cos'] = np.cos(2 * np.pi * hourly['dow'] / 7)

    hourly[['global_active_power', 'sub_metering_1', 'sub_metering_2', 'sub_metering_3',
            'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos']].to_parquet(HOURLY_CACHE_PATH)
    return pd.read_parquet(HOURLY_CACHE_PATH)


FEATURE_COLUMNS = [
    'global_active_power', 'sub_metering_1', 'sub_metering_2', 'sub_metering_3',
    'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
]
TARGET_COLUMN = 'global_active_power'


def make_windows(df: pd.DataFrame, lookback: int, horizon: int):
    """Slide a (lookback -> horizon) window over the series.

    Returns X of shape (n_samples, lookback, n_features) and y of shape
    (n_samples, horizon) — the future `global_active_power` values.
    """
    values = df[FEATURE_COLUMNS].values.astype(np.float32)
    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    n = len(values)
    xs, ys = [], []
    for start in range(0, n - lookback - horizon + 1):
        xs.append(values[start:start + lookback])
        ys.append(values[start + lookback:start + lookback + horizon, target_idx])
    return np.stack(xs), np.stack(ys)


def train_val_test_split(df: pd.DataFrame, val_frac=0.1, test_frac=0.1):
    n = len(df)
    n_test = int(n * test_frac)
    n_val = int(n * val_frac)
    n_train = n - n_val - n_test
    return df.iloc[:n_train], df.iloc[n_train:n_train + n_val], df.iloc[n_train + n_val:]
