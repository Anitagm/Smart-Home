"""
Data loading for the occupancy-prediction module.

Source: UCI "Occupancy Detection" dataset
(https://archive.ics.uci.edu/dataset/357). Minute-level readings of
Temperature, Humidity, Light, CO2 and HumidityRatio from a single office
room, ground-truth Occupancy (0/1) captured from time-stamped photos.
Published train/test split is used as-is (datatraining.txt for training,
datatest.txt + datatest2.txt concatenated for evaluation).
"""
from __future__ import annotations

import pandas as pd
from django.conf import settings

DATA_DIR = settings.ML_ARTIFACTS_DIR / 'datasets' / 'occupancy'

FEATURE_COLUMNS = ['Temperature', 'Humidity', 'Light', 'CO2', 'HumidityRatio', 'hour', 'dow']
TARGET_COLUMN = 'Occupancy'


def _read(path: str) -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / path, index_col=0)
    df['date'] = pd.to_datetime(df['date'])
    df['hour'] = df['date'].dt.hour
    df['dow'] = df['date'].dt.dayofweek
    return df


def load_splits():
    train_df = _read('datatraining.txt')
    test_df = pd.concat([_read('datatest.txt'), _read('datatest2.txt')], ignore_index=True)
    return train_df, test_df
