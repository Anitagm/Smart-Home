# Analysis

Quantitative results, what they mean, and where they might mislead a
reviewer if stated carelessly. Numbers below are pulled directly from
`backend/ml_artifacts/<app>/meta.json` after the training run described in
each app's `train.py` — regenerate with `python manage.py train_<app>` and
these numbers will reproduce (fixed seeds throughout: `random_state=42` /
`seed=42`). See [THEORY.md](THEORY.md) for the algorithms behind these
numbers and [INTUITION.md](INTUITION.md) for a plain-language read of them.

---

## A. Energy forecasting

### Results (held-out test set, hourly kW, 48h-horizon windows)

| Model | Test MAE (kW) | Test RMSE (kW) | Fit time |
|---|---|---|---|
| Random Forest (multi-output) | **0.457** | **0.603** | 4.1 s |
| Holt-Winters (trend=None, seasonal='mul') | 0.581 | 0.761 | 0.7 s |
| Seasonal-naive baseline | 0.505 | 0.764 | — |

$n_{train}=30{,}671$ windows, $n_{test}=3{,}302$ windows (chronological
80/10/10 train/val/test split, no shuffling — see
`dataset.py::train_val_test_split`).

### Reading these numbers

- **RF beats the naive baseline on both metrics** (0.457 < 0.505 MAE;
  0.603 < 0.764 RMSE) — a genuine, non-trivial forecasting result. The
  relative MAE improvement is $(0.505-0.457)/0.505 = 9.5\%$.
- **Holt-Winters is roughly tied with naive** (0.581 vs. 0.505 MAE — HW is
  actually *worse* than naive on MAE, though better on RMSE: 0.761 vs.
  0.764). This is an honest, reportable result, not a failure to hide: a
  single-household power series is dominated by **occupant behavior**
  (when someone turns on the oven), which a smooth seasonal model
  structurally cannot capture — only a model with access to more context
  (RF sees sub-metering + calendar features) has a chance at it. This is a
  legitimate, citable finding about the relative value of feature-rich ML
  vs. classical time-series methods on *behavior-driven* (as opposed to
  physically-driven, e.g. weather-driven) series.
- **The ensemble's value is in the interval, not necessarily the point
  forecast.** Averaging RF and HW pulls the ensemble mean toward the
  weaker model on this dataset; a paper reporting this ensemble should
  report RF standalone as the strongest point-forecast and frame the
  2-model ensemble specifically as an uncertainty-quantification device
  (see THEORY.md's ensembling section), not claim the ensemble improves
  point accuracy over RF alone — it doesn't, here.

### Bug: additive Holt-Winters collapsed to zero

Worth recording precisely, since it changed a reported number and is the
kind of error that's invisible in an aggregate metric alone:

- **Original config**: `trend='add', seasonal='add'`. Produced forecasts
  that went negative past hour ~2 of the horizon on the live anchor point
  used for serving (verified directly: `[0.346, -0.09, -0.283, -0.246,
  ...]`), which the serving code then clipped to 0 — so most of a served
  48h forecast was a flat line at zero. Test-set MAE (which is computed by
  refitting/evaluating on **historical**, not live, windows) still showed
  a plausible-looking 0.596 kW because the historical evaluation windows
  didn't happen to trigger the same divergence as badly — this is exactly
  why the bug wasn't caught by the metric alone, only by rendering an
  actual chart from the live-serving code path.
- **Fixed config**: `trend=None, seasonal='mul'`. Multiplicative
  seasonality is a natural fit for a strictly non-negative, non-trending,
  strongly diurnal series — it can't produce negative values by
  construction (level × seasonal-factor, both positive). Test MAE improved
  0.596 → 0.581 kW, RMSE 0.800 → 0.761 kW, and the live-served forecast now
  tracks the daily cycle instead of flatlining.
- **Lesson for future model changes here**: always sanity-check a model by
  looking at a rendered forecast from the actual serving code path
  (`infer.py`), not just the batch-evaluation metric in `train.py` — they
  evaluate different code paths (refit-per-request vs. fit-once) and can
  diverge.

---

## C. Occupancy prediction

### Results (held-out test set: `datatest.txt` + `datatest2.txt`, n=12,417)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Random Forest | 0.966 | 0.923 | 0.939 | 0.931 | 0.994 |
| Logistic Regression | **0.990** | **0.966** | **0.996** | **0.980** | **0.995** |

### Reading these numbers

- **Logistic Regression outperforms Random Forest on every metric here** —
  counter to the (very common) prior that tree ensembles dominate linear
  models. Feature importances from the RF explain why:
  `Light` (0.470) and `CO2` (0.212) dominate, together carrying 68% of
  total importance; the underlying occupancy→sensor relationship is close
  to monotonic and near-linear in these two variables (occupied rooms have
  lights on and CO2 rising; empty rooms don't), which is exactly the
  regime where a linear decision boundary is *sufficient* — the RF's extra
  capacity to model interactions buys nothing and its variance costs a
  little. This is a legitimate paper point about matching model complexity
  to the problem, not a modeling error.
- **ROC-AUC ≈ 0.99 for both** models means the 5-feature representation is
  highly separable regardless of which classifier reads it — most of the
  achievable performance here comes from the *feature set* (Light + CO2
  are strong physical proxies for occupancy), not from classifier choice.
  A paper claiming "our classifier achieves 99% accuracy" should be
  precise that this reflects **feature informativeness on this specific
  single-room dataset**, not a generally-hard classification problem
  solved.
- These numbers are **in line with the original dataset paper**
  (Candanedo & Feldheim, 2016 report accuracies in the 97–99% range with
  similar feature sets), which is a useful external sanity check that this
  reimplementation isn't over- or under-fitting relative to the published
  baseline.

### Construct validity: the occupancy extrapolation

The dashboard shows six rooms' occupancy probabilities; the model was
trained on **one room**. The reported 96.6–99.0% accuracy is the model's
accuracy *on that one room's held-out data* — it is not evidence about
accuracy on the dashboard's six synthesized rooms, because there is no
ground truth for those (they're mock rooms). A paper using this system
must state the extrapolation explicitly:

> "Per-room occupancy estimates for the demonstration dashboard are
> produced by evaluating the single-room-trained classifier on
> schema-matched feature vectors synthesized from each room's known
> temperature/humidity/light state; these are illustrative of the
> classifier's *sensitivity* to plausible inputs, not validated per-room
> predictions."

This is a **construct validity** limitation (does the measurement — model
output on synthetic vectors — actually measure the construct of interest —
real per-room occupancy?) that should be in any paper's limitations
section verbatim or close to it.

---

## D. Prescriptive energy management

### Results (200 held-out evaluation episodes, mean episodic return)

| Policy | Avg. return | vs. always-idle | vs. naive-fixed-time |
|---|---|---|---|
| Learned (Q-learning, greedy) | **+0.109** | +4.51 | +1.23 |
| Naive fixed-time (load @ 8am always) | −1.123 | +3.28 | — |
| Always-idle | −4.404 | — | — |

Training curve: mean return over the last 100 of 4,000 training episodes
was +0.048, vs. the fully-converged greedy-policy evaluation of +0.109 —
consistent with a policy that's still partly exploring ($\varepsilon$ not
yet at its floor) outperforming its own tail-of-training average once
evaluated greedily, as expected.

### Reading these numbers

- **The learned policy beats both baselines by a wide margin.** The gap
  vs. always-idle (+4.51) is dominated by the environment's design: idle
  always eventually incurs the one-time discomfort penalty
  (`DISCOMFORT_PENALTY = 3.0`) for never running the flexible load, so
  "beats idle" is a relatively low bar by construction — report this
  comparison as "the agent learned it must act," not as the paper's
  primary result.
- **The gap vs. naive-fixed-time (+1.23) is the more informative number**:
  it isolates the value of *conditioning on state* (price/solar/battery)
  over a fixed-schedule heuristic that a real household could already
  follow without any ML. This is the number to lead with in a paper.
- **Absolute magnitudes are small** (returns are in the sub-single-digit
  range) because the reward function's units are dollars over one
  simulated day for one household — this is expected and not a red flag,
  but should be reported with units and reward-function definition
  attached (see THEORY.md) rather than as a bare number, which is
  otherwise meaningless.

---

## Limitations & threats to validity

Stated directly, organized by validity type, because a paper reviewer will
ask these questions regardless:

**Internal validity** (did we measure our own system correctly?)
- Forecasting and occupancy metrics are computed on genuine held-out
  splits (chronological for forecasting, the dataset's own published
  train/test split for occupancy) — no leakage from test into train.
- The energy-manager's "held-out" episodes are freshly sampled from the
  *same* environment distribution the agent trained on (there's no
  distributional shift to test against, because the environment is
  itself the ground truth, not an approximation of external data) — so
  "held-out" here means "different random seeds," not "different
  distribution." This is inherent to evaluating an agent inside a
  simulation it was trained in and should be named as such.

**External validity** (do these numbers generalize beyond this exact setup?)
- Forecasting/occupancy models are trained on **one household** / **one
  room** respectively. Reported accuracy is a statement about *that*
  household/room, not households/rooms in general — standard for these
  UCI datasets in prior literature too, but worth restating.
- The energy-manager's environment constants (price bands, appliance
  draw, battery capacity) are hand-set, not fit to any real household —
  results describe agent behavior in *this specific simulated MDP*, not a
  claim about savings achievable in a real home.

**Construct validity** (are we measuring what we claim to measure?)
- The occupancy multi-room extrapolation (above) is the clearest instance
  in this project — flagged explicitly rather than left for a reviewer to
  find.

**Statistical caveats**
- No confidence intervals or repeated-seed variance are currently reported
  for any of the three results tables above — all numbers are single-run
  point estimates. For a paper, re-running each training procedure across
  ≥5 seeds and reporting mean ± std is the natural next step (tracked in
  [TODO.md](TODO.md)) before treating any of these numbers as more than
  illustrative.
