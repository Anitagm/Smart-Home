"""Tabular Q-learning on the HomeEnergyEnv.

The discretized state space is tiny (24 * 3 * 3 * 3 = 648 states x 4
actions), so a plain Q-table converges in a couple thousand episodes —
well under a second of wall-clock time, with no neural network, no GPU, and
a policy you can print and audit directly (see meta.json's `q_table`
summary). This is why energy_manager doesn't reach for stable-baselines3 /
DQN: the extra machinery buys nothing at this state-space size.

Run via: python manage.py train_energy_manager
"""
from __future__ import annotations

import json
import time

import numpy as np
from django.conf import settings

from .env import ACTION_NAMES, HomeEnergyEnv

ARTIFACT_DIR = settings.ML_ARTIFACTS_DIR / 'energy_manager'

N_EPISODES = 4000
ALPHA = 0.1        # learning rate
GAMMA = 0.95        # discount factor
EPS_START = 1.0
EPS_END = 0.05
EPS_DECAY_EPISODES = 3000


def _epsilon(ep):
    frac = min(1.0, ep / EPS_DECAY_EPISODES)
    return EPS_START + frac * (EPS_END - EPS_START)


def train_all(seed: int = 42):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    rng = np.random.default_rng(seed)

    env = HomeEnergyEnv()
    q_table = np.zeros((24, 3, 3, 3, 4), dtype=np.float32)

    episode_returns = []
    for ep in range(N_EPISODES):
        obs, _ = env.reset(seed=int(rng.integers(0, 1_000_000)))
        eps = _epsilon(ep)
        done = False
        total_reward = 0.0
        while not done:
            state = tuple(obs)
            if rng.random() < eps:
                action = int(rng.integers(0, 4))
            else:
                action = int(np.argmax(q_table[state]))

            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            next_state = tuple(next_obs)

            best_next = 0.0 if done else np.max(q_table[next_state])
            td_target = reward + GAMMA * best_next
            q_table[state][action] += ALPHA * (td_target - q_table[state][action])

            obs = next_obs
            total_reward += reward
        episode_returns.append(total_reward)

    np.save(ARTIFACT_DIR / 'q_table.npy', q_table)

    # Evaluate the greedy (learned) policy vs. a no-battery/no-flexibility
    # "always idle" baseline and vs. a naive "run flexible load immediately" policy.
    def rollout(policy_fn, episodes=200):
        rets = []
        for _ in range(episodes):
            obs, _ = env.reset()
            done = False
            total = 0.0
            while not done:
                action = policy_fn(obs)
                obs, reward, terminated, truncated, _ = env.step(action)
                done = terminated or truncated
                total += reward
            rets.append(total)
        return float(np.mean(rets))

    greedy_return = rollout(lambda obs: int(np.argmax(q_table[tuple(obs)])))
    idle_return = rollout(lambda obs: 0)
    naive_return = rollout(lambda obs: 1 if obs[0] == 8 else 0)  # always try to run the load at 8am

    last100_avg = float(np.mean(episode_returns[-100:]))
    meta = {
        'episodes': N_EPISODES,
        'alpha': ALPHA,
        'gamma': GAMMA,
        'action_names': ACTION_NAMES,
        'state_space': ['hour(0-23)', 'price_tier(0-2)', 'solar_tier(0-2)', 'battery_tier(0-2)'],
        'train_seconds': time.time() - t0,
        'training_curve_last100_avg_return': last100_avg,
        'eval_episodes': 200,
        'results': {
            'learned_policy_avg_return': greedy_return,
            'always_idle_baseline_avg_return': idle_return,
            'naive_fixed_time_baseline_avg_return': naive_return,
        },
    }
    with open(ARTIFACT_DIR / 'meta.json', 'w') as f:
        json.dump(meta, f, indent=2)

    print(f'Learned policy avg return: {greedy_return:.3f}')
    print(f'Always-idle baseline:      {idle_return:.3f}')
    print(f'Naive fixed-time baseline: {naive_return:.3f}')
    print(f'Done in {time.time() - t0:.2f}s. Artifacts written to {ARTIFACT_DIR}')
    return meta
