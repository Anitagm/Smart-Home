"""Inference for the occupancy classifier.

The UCI dataset covers a single office room, so a direct per-room
multi-room deployment isn't possible from real sensor logs. Instead we run
the *real, trained* classifier against a feature vector synthesized for
each of the dashboard's rooms from what the panel already knows about that
room (temperature, humidity, whether its lights are on) plus the current
hour/day-of-week — the same feature schema the model was trained on. This
is an honest, documented extrapolation (see ROADMAP.md), not a claim that
each room has its own sensor history.
"""
from __future__ import annotations

import json
import re
import threading
from datetime import datetime

import joblib
import numpy as np
from django.conf import settings

from .dataset import FEATURE_COLUMNS

ARTIFACT_DIR = settings.ML_ARTIFACTS_DIR / 'occupancy'

_lock = threading.Lock()
_cache = {}


class OccupancyModelNotReady(Exception):
    pass


def _load():
    with _lock:
        if _cache:
            return _cache
        meta_path = ARTIFACT_DIR / 'meta.json'
        rf_path = ARTIFACT_DIR / 'random_forest.joblib'
        if not meta_path.exists() or not rf_path.exists():
            raise OccupancyModelNotReady(
                "No trained occupancy model found. Run `python manage.py train_occupancy` first."
            )
        _cache['meta'] = json.loads(meta_path.read_text())
        _cache['rf'] = joblib.load(rf_path)
        lr_path = ARTIFACT_DIR / 'logistic_regression.joblib'
        _cache['lr'] = joblib.load(lr_path) if lr_path.exists() else None
        return _cache


def _parse_celsius(temp_str: str) -> float:
    m = re.search(r'-?\d+(\.\d+)?', temp_str or '')
    return float(m.group()) if m else 21.0


def _parse_humidity(rh_str: str) -> float:
    m = re.search(r'-?\d+(\.\d+)?', rh_str or '')
    return float(m.group()) if m else 45.0


def _synthesize_features(room: dict, now: datetime) -> np.ndarray:
    temperature = _parse_celsius(room.get('temp'))
    humidity = _parse_humidity(room.get('rh'))
    lights_on = any(d.get('on') for d in room.get('devices', []) if 'light' in d.get('label', '').lower())

    # Light (lux): occupied rooms with lights on read high; unlit rooms read
    # near-zero regardless — mirrors the strong Light->Occupancy relationship
    # the trained model actually learned (see feature_importances in meta.json).
    light = 450.0 if lights_on else 15.0
    # CO2 (ppm): baseline ~450ppm outdoor-ish, climbs with occupancy + time indoors.
    hour_factor = 1.0 if 7 <= now.hour <= 22 else 0.3
    co2 = 450.0 + (250.0 if lights_on else 0.0) * hour_factor
    humidity_ratio = 0.0022 * humidity  # rough proxy consistent with the dataset's own HumidityRatio scale

    row = {
        'Temperature': temperature,
        'Humidity': humidity,
        'Light': light,
        'CO2': co2,
        'HumidityRatio': humidity_ratio,
        'hour': now.hour,
        'dow': now.weekday(),
    }
    return np.array([[row[c] for c in FEATURE_COLUMNS]], dtype=np.float32)


def predict_rooms(rooms: list[dict], now: datetime | None = None):
    cache = _load()
    rf, lr, meta = cache['rf'], cache['lr'], cache['meta']
    now = now or datetime.now()

    results = []
    for room in rooms:
        x = _synthesize_features(room, now)
        rf_proba = float(rf.predict_proba(x)[0, 1])
        entry = {
            'room': room.get('name'),
            'occupancy_probability': round(rf_proba, 3),
            'occupied': rf_proba >= 0.5,
        }
        if lr is not None:
            lr_proba = float(lr.predict_proba(x)[0, 1])
            entry['occupancy_probability_logreg'] = round(lr_proba, 3)
            entry['model_agreement'] = (rf_proba >= 0.5) == (lr_proba >= 0.5)
        results.append(entry)

    return {
        'timestamp': now.isoformat(),
        'rooms': results,
        'model_test_metrics': meta['results'],
        'dataset': meta['dataset'],
    }
