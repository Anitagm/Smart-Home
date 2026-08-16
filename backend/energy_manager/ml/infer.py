"""Serve recommendations from the trained Q-table."""
from __future__ import annotations

import threading
from datetime import datetime

import numpy as np
from django.conf import settings

from .env import ACTION_NAMES, BATTERY_CAPACITY_KWH, battery_tier, price_tier, solar_tier

ARTIFACT_DIR = settings.ML_ARTIFACTS_DIR / 'energy_manager'

ACTION_LABELS = {
    'idle': 'Do nothing this hour',
    'run_flexible_load': 'Run a flexible appliance now (dishwasher / EV charging / laundry)',
    'charge_battery': 'Charge the battery',
    'discharge_battery': 'Discharge the battery to cover the load',
}

_lock = threading.Lock()
_cache = {}


class AgentNotReady(Exception):
    pass


def _load():
    with _lock:
        if _cache:
            return _cache
        path = ARTIFACT_DIR / 'q_table.npy'
        if not path.exists():
            raise AgentNotReady("No trained agent found. Run `python manage.py train_energy_manager` first.")
        _cache['q_table'] = np.load(path)
        return _cache


def recommend(hour: int | None = None, battery_percent: float | None = None,
              price_override_tier: int | None = None, solar_override_tier: int | None = None):
    cache = _load()
    q_table = cache['q_table']

    now = datetime.now()
    hour = now.hour if hour is None else int(hour) % 24
    p_tier = price_override_tier if price_override_tier is not None else price_tier(hour)
    s_tier = solar_override_tier if solar_override_tier is not None else solar_tier(hour)
    battery_kwh = (battery_percent / 100.0) * BATTERY_CAPACITY_KWH if battery_percent is not None else BATTERY_CAPACITY_KWH * 0.5
    b_tier = battery_tier(battery_kwh)

    q_values = q_table[hour, p_tier, s_tier, b_tier]
    order = np.argsort(-q_values)
    best = int(order[0])

    explanations = {
        'idle': 'Grid price and solar output don\'t favor any action right now.',
        'run_flexible_load': 'Cheap or solar-covered energy is available — a good window for deferrable loads.',
        'charge_battery': 'Solar output or off-peak pricing makes this a good time to top up the battery.',
        'discharge_battery': 'Grid price is high and the battery has charge to spare — use it instead of buying power.',
    }

    alternatives = [
        {'action': ACTION_NAMES[i], 'action_label': ACTION_LABELS[ACTION_NAMES[i]], 'q_value': round(float(q_values[i]), 3)}
        for i in order
    ]

    return {
        'timestamp': now.isoformat(),
        'state': {'hour': hour, 'price_tier': p_tier, 'solar_tier': s_tier, 'battery_tier': b_tier},
        'recommended_action': ACTION_NAMES[best],
        'recommended_action_label': ACTION_LABELS[ACTION_NAMES[best]],
        'q_value': round(float(q_values[best]), 3),
        'explanation': explanations[ACTION_NAMES[best]],
        'alternatives': alternatives,
    }
