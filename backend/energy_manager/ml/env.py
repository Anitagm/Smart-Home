"""
A small Gymnasium environment modelling one day of home energy management,
used to train a prescriptive ("what should the home do next") agent.

There's no public dataset of household control decisions to imitate, so —
unlike forecasting/occupancy — this module is necessarily a simulation
grounded in the same domain assumptions already encoded in the dashboard's
mock data (a solar generation curve, a battery, and time-of-use grid
pricing). This is documented as a deliberate scope choice in ROADMAP.md.

State (discretized, 4 factors):
  hour        0-23
  price_tier  0=off-peak 1=mid 2=peak      (time-of-use grid price)
  solar_tier  0=none 1=partial 2=strong    (rooftop solar output)
  battery_tier 0=low(<30%) 1=mid 2=high(>70%)  (battery state of charge)

Actions:
  0 = IDLE               — do nothing this hour
  1 = RUN_FLEXIBLE_LOAD   — run a deferrable appliance (dishwasher/EV/etc.) now
  2 = CHARGE_BATTERY      — draw extra power to charge the battery
  3 = DISCHARGE_BATTERY   — use battery power to cover load instead of the grid

Reward = -(grid energy cost) - (discomfort penalty for indefinitely
deferring the flexible load) + (small bonus for finishing the flexible load
before the comfort deadline).
"""
from __future__ import annotations

import numpy as np
import gymnasium as gym
from gymnasium import spaces

IDLE, RUN_FLEXIBLE_LOAD, CHARGE_BATTERY, DISCHARGE_BATTERY = range(4)
ACTION_NAMES = ['idle', 'run_flexible_load', 'charge_battery', 'discharge_battery']

FLEXIBLE_LOAD_KWH = 1.5     # e.g. a dishwasher cycle
BASE_LOAD_KWH = 0.6         # always-on baseline draw per hour
BATTERY_CAPACITY_KWH = 5.0
BATTERY_STEP_KWH = 1.0      # charge/discharge per action
COMFORT_DEADLINE_HOUR = 22  # flexible load should run before this hour
DISCOMFORT_PENALTY = 3.0    # incurred once, at day end, if load never ran
ON_TIME_BONUS = 0.5


def _solar_kwh(hour: int) -> float:
    """Bell-shaped daylight generation curve peaking at noon."""
    if 6 <= hour <= 19:
        return max(0.0, 3.2 * np.exp(-((hour - 12.5) ** 2) / (2 * 3.2 ** 2)))
    return 0.0


def _price_per_kwh(hour: int) -> float:
    if 17 <= hour <= 21:
        return 0.42   # peak
    if 7 <= hour <= 16 or 22 <= hour <= 23:
        return 0.24   # mid
    return 0.14        # off-peak (night)


def price_tier(hour: int) -> int:
    p = _price_per_kwh(hour)
    return 2 if p >= 0.4 else (1 if p >= 0.2 else 0)


def solar_tier(hour: int) -> int:
    s = _solar_kwh(hour)
    return 2 if s >= 2.0 else (1 if s >= 0.5 else 0)


def battery_tier(soc_kwh: float) -> int:
    frac = soc_kwh / BATTERY_CAPACITY_KWH
    return 2 if frac >= 0.7 else (1 if frac >= 0.3 else 0)


class HomeEnergyEnv(gym.Env):
    metadata = {'render_modes': []}

    def __init__(self):
        super().__init__()
        self.action_space = spaces.Discrete(4)
        self.observation_space = spaces.MultiDiscrete([24, 3, 3, 3])
        self.hour = 0
        self.battery_soc = BATTERY_CAPACITY_KWH * 0.5
        self.flexible_load_done = False

    def _obs(self):
        return np.array([self.hour, price_tier(self.hour), solar_tier(self.hour), battery_tier(self.battery_soc)], dtype=np.int64)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.hour = 0
        self.battery_soc = BATTERY_CAPACITY_KWH * 0.5
        self.flexible_load_done = False
        return self._obs(), {}

    def step(self, action: int):
        solar = _solar_kwh(self.hour)
        price = _price_per_kwh(self.hour)
        load = BASE_LOAD_KWH
        reward = 0.0

        if action == RUN_FLEXIBLE_LOAD and not self.flexible_load_done:
            load += FLEXIBLE_LOAD_KWH
            self.flexible_load_done = True
            if self.hour <= COMFORT_DEADLINE_HOUR:
                reward += ON_TIME_BONUS
        elif action == CHARGE_BATTERY and self.battery_soc < BATTERY_CAPACITY_KWH:
            charge = min(BATTERY_STEP_KWH, BATTERY_CAPACITY_KWH - self.battery_soc)
            load += charge
            self.battery_soc += charge
        elif action == DISCHARGE_BATTERY and self.battery_soc > 0:
            discharge = min(BATTERY_STEP_KWH, self.battery_soc, load)
            self.battery_soc -= discharge
            load -= discharge

        grid_draw = max(0.0, load - solar)
        cost = grid_draw * price
        reward -= cost

        self.hour += 1
        terminated = self.hour >= 24
        if terminated and not self.flexible_load_done:
            reward -= DISCOMFORT_PENALTY

        info = {'cost': cost, 'grid_draw_kwh': grid_draw, 'solar_kwh': solar}
        return self._obs(), reward, terminated, False, info
