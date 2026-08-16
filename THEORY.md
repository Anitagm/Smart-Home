# Theory

Formal background for the three ML-backed features in `backend/`, written
for someone (human or AI agent) turning this into a paper's Related
Work / Methodology sections. Each part states the problem formally, names
the exact algorithm used, gives its governing equations, and cites the
canonical source. Empirical results belong in [ANALYSIS.md](ANALYSIS.md);
*why* these specific choices over alternatives is in
[INTUITION.md](INTUITION.md) and [MINDSET.md](MINDSET.md). Dataset/API
inventory is in [ALL_FEATURES.md](ALL_FEATURES.md).

---

## A. Energy forecasting

### Problem formulation

Given a univariate (with exogenous calendar features) hourly time series of
household active power draw $\{y_t\}_{t=1}^{T}$, predict the vector
$\hat{y}_{t+1:t+H}$ for horizon $H = 48$ from a lookback window
$y_{t-L+1:t}$ plus engineered features, $L = 72$. This is **direct
multi-horizon forecasting**: a single model outputs all $H$ steps at once,
rather than **recursive forecasting** (predict $t+1$, feed it back in,
repeat), which avoids compounding one-step error but requires the model
class to natively support multi-output regression.

### Feature engineering

Raw minute-level readings are resampled to hourly means (see
`backend/forecasting/ml/dataset.py`). Each timestep's feature vector is:

$$x_t = \big[\, y_t,\ s^{(1)}_t,\ s^{(2)}_t,\ s^{(3)}_t,\ \sin\tfrac{2\pi h_t}{24},\ \cos\tfrac{2\pi h_t}{24},\ \sin\tfrac{2\pi d_t}{7},\ \cos\tfrac{2\pi d_t}{7} \,\big]$$

where $s^{(i)}_t$ are the dataset's three sub-metering channels (kitchen,
laundry, water-heater/AC) and $h_t, d_t$ are hour-of-day and
day-of-week. The sine/cosine pair encodes a cyclical variable without the
discontinuity a raw integer (`hour=23` → `hour=0`) would introduce to a
distance-based or tree-split-based learner.

### Model 1 — Random Forest Regression (multi-output)

Random Forest (Breiman, 2001, *Machine Learning* 45(1):5–32) is an ensemble
of $B$ regression trees, each trained on a bootstrap resample of the
training set with feature subsampling at each split (here
`max_features='sqrt'`). The forest's prediction is the mean over trees:

$$\hat{f}(x) = \frac{1}{B}\sum_{b=1}^{B} T_b(x)$$

For multi-output regression (predicting all 48 horizon steps at once),
scikit-learn's `RandomForestRegressor` extends each tree's split criterion
to minimize the **sum of per-output variances** (multi-output MSE) rather
than a single target's variance — the forest is jointly optimized across
the horizon, not fit as 48 independent single-output forests.

Configuration used: $B = 80$ trees, max depth 10, `min_samples_leaf=5`,
`max_features='sqrt'`. See `backend/forecasting/ml/train.py::_fit_random_forest`.

### Model 2 — Holt-Winters Exponential Smoothing

Holt-Winters (Winters, 1960, *Management Science* 6(3):324–342) decomposes
a series into level $\ell_t$, and — in the seasonal variant used here —
seasonal factors $s_t$ with period $m=24$ (one day of hourly data), with
**no trend term** and a **multiplicative** seasonal component:

$$\hat{y}_{t+h} = \ell_t \cdot s_{t+h-m\lceil h/m \rceil}$$
$$\ell_t = \alpha \frac{y_t}{s_{t-m}} + (1-\alpha)\ell_{t-1}$$
$$s_t = \gamma \frac{y_t}{\ell_t} + (1-\gamma)s_{t-m}$$

Smoothing parameters $\alpha, \gamma \in [0,1]$ are fit by maximum
likelihood (`statsmodels.tsa.holtwinters.ExponentialSmoothing`,
`initialization_method='estimated'`). Why *no trend* and *multiplicative*
seasonal — and not the textbook-default additive-trend/additive-seasonal
triple — is a specific empirical finding of this project, documented with
before/after numbers in [ANALYSIS.md](ANALYSIS.md#bug-additive-holt-winters-collapsed-to-zero).

### Ensembling and uncertainty quantification

The two forecasts are combined by simple averaging:

$$\hat{y}^{ens}_{t+h} = \tfrac{1}{2}\big(\hat{y}^{RF}_{t+h} + \hat{y}^{HW}_{t+h}\big)$$

The **prediction interval** is derived from cross-model disagreement rather
than either model's own parametric uncertainty:

$$\sigma_{t+h} = \left| \hat{y}^{RF}_{t+h} - \hat{y}^{HW}_{t+h} \right| \big/ \sqrt{2} \quad\text{(sample std. of 2 points)}, \qquad \text{PI}_{95\%} = \hat{y}^{ens}_{t+h} \pm 1.96\,\sigma_{t+h}$$

This is a **disagreement-based / ensemble-spread interval**, a cheap
practical substitute for the two rigorous alternatives — quantile
regression (train separate models for the 2.5th/97.5th percentiles) or
Monte-Carlo dropout (many stochastic forward passes of a neural net) —
neither of which applies cleanly to a 2-member classical-ML ensemble. Its
known weakness is stated plainly: with only 2 ensemble members, the
interval reflects *architecture disagreement*, not full predictive
uncertainty, and can be miscalibrated (too narrow when both models share a
blind spot, too wide when they merely differ in noise). This is flagged as
a limitation, not hidden — see [ANALYSIS.md](ANALYSIS.md#limitations--threats-to-validity).

### Baseline

**Seasonal-naive**: $\hat{y}_{t+h} = y_{t+h-24}$ (repeat yesterday's value
at the same hour). This is the standard baseline for sub-daily energy
forecasting — beating it is the minimum bar for any model to be considered
useful, per the M4/M5 forecasting competition conventions (Makridakis et
al., 2020, *International Journal of Forecasting* 36(1):54–74).

### Dataset

**UCI Individual Household Electric Power Consumption**
(Hebrail & Berard, 2012; https://archive.ics.uci.edu/dataset/235).
2,075,259 minute-level measurements from one household in Sceaux, France,
Dec 2006 – Nov 2010 (~47 months). Resampled to hourly (see
`dataset.py::load_hourly_series`), yielding ~34,000 hourly observations
after dropping unresolvable gaps.

---

## C. Occupancy prediction

### Problem formulation

Binary classification: given a feature vector of ambient sensor readings
at time $t$, predict $y_t \in \{0, 1\}$ (unoccupied / occupied).

$$x_t = [\text{Temperature}_t,\ \text{Humidity}_t,\ \text{Light}_t,\ \text{CO}_2{}_t,\ \text{HumidityRatio}_t,\ h_t,\ d_t]$$

### Model 1 — Random Forest Classification

Same ensemble mechanism as above, but each tree minimizes Gini impurity
(scikit-learn default) at each split:

$$\text{Gini}(p) = 1 - \sum_{k\in\{0,1\}} p_k^2$$

with `class_weight='balanced'` reweighting the minority (occupied, ~23% of
rows) class inversely to its frequency, so the loss isn't dominated by the
majority "empty" class. Configuration: 200 trees, max depth 10.

### Model 2 — Logistic Regression

$$P(y_t=1\mid x_t) = \sigma(w^\top x_t + b) = \frac{1}{1+e^{-(w^\top x_t + b)}}$$

fit by maximizing the (class-balanced) log-likelihood via L-BFGS
(`sklearn.linear_model.LogisticRegression`, `max_iter=1000`). Included as a
second, structurally different ensemble member (linear vs. tree-based) —
its disagreement with the RF flags borderline cases, and empirically it
*outperformed* the RF on this dataset (see ANALYSIS.md), which is itself
worth reporting: the relationship between these 5 features and occupancy
is close enough to linearly separable that a simple linear model wins.

### Evaluation metrics

Standard binary-classification suite, all computed on the held-out UCI
test split:

$$\text{Precision} = \frac{TP}{TP+FP}, \quad \text{Recall} = \frac{TP}{TP+FN}, \quad F_1 = \frac{2\cdot P \cdot R}{P+R}$$

**ROC-AUC**: area under the True-Positive-Rate vs. False-Positive-Rate
curve swept over the classifier's decision threshold — threshold-independent,
so it separates "is this feature set informative at all" from "did we pick
a good 0.5 cutoff."

### Dataset

**UCI Occupancy Detection Dataset** (Candanedo & Feldheim, 2016,
*Energy and Buildings* 112:28–39; https://archive.ics.uci.edu/dataset/357).
Minute-level Temperature/Humidity/Light/CO2/HumidityRatio from a single
office room, ground truth from time-stamped photographs. Published
train/test split used as-is: 8,143 training rows (`datatraining.txt`),
12,417 test rows (`datatest.txt` + `datatest2.txt` concatenated).

### The single-room → multi-room extrapolation

The dataset covers **one physical room**. Per-room predictions on the
dashboard's six mock rooms are produced by running the *same trained
model* on a feature vector synthesized per room from what the dashboard
already knows (temperature, humidity, whether that room's lights are on) —
see `backend/occupancy/ml/infer.py::_synthesize_features`. This is
methodologically closer to a **sensitivity analysis** of the trained model
than to "six rooms of real predictions," and must be described as such in
any paper — see [ANALYSIS.md](ANALYSIS.md#construct-validity-the-occupancy-extrapolation).

---

## D. Prescriptive energy management (reinforcement learning)

### Problem formulation

A finite-horizon Markov Decision Process (MDP) $(\mathcal{S}, \mathcal{A}, P, R, \gamma)$
representing one simulated day of home energy decisions:

- **State** $s = (h, p, u, b) \in \{0..23\} \times \{0,1,2\} \times \{0,1,2\} \times \{0,1,2\}$
  — hour of day, discretized grid-price tier, discretized solar-output
  tier, discretized battery state-of-charge tier. $|\mathcal{S}| = 24\times3\times3\times3 = 648$.
- **Action** $a \in \{\text{idle}, \text{run\_flexible\_load}, \text{charge\_battery}, \text{discharge\_battery}\}$, $|\mathcal{A}|=4$.
- **Transition** $P$: deterministic given the environment's price/solar
  curves and the chosen action's effect on battery SoC (see
  `backend/energy_manager/ml/env.py::HomeEnergyEnv.step`).
- **Reward** $R(s,a) = -\text{grid\_cost}(s,a) + \text{bonus/penalty terms}$
  (on-time completion bonus for the flexible load, one-time discomfort
  penalty if it never ran by day's end).
- **Discount** $\gamma = 0.95$.

### Algorithm — Tabular Q-learning

Watkins & Dayan (1992, *Machine Learning* 8:279–292). Learns the
action-value function $Q(s,a)$ — the expected discounted return of taking
action $a$ in state $s$ and acting optimally thereafter — via the
off-policy temporal-difference update:

$$Q(s_t,a_t) \leftarrow Q(s_t,a_t) + \alpha\Big[r_t + \gamma\max_{a'}Q(s_{t+1},a') - Q(s_t,a_t)\Big]$$

with learning rate $\alpha=0.1$. Behavior policy is $\varepsilon$-greedy
with linear decay from $\varepsilon=1.0$ to $\varepsilon=0.05$ over the
first 3,000 of 4,000 training episodes (exploration → exploitation).
Q-learning is proven to converge to the optimal $Q^*$ under standard
conditions (every state-action pair visited infinitely often, appropriately
decaying $\alpha$) — with a state space of only 648 cells, this is a
realistic condition to satisfy in a few thousand episodes, unlike in a
continuous or high-dimensional state space.

**Why tabular and not deep Q-learning (DQN)**: a table of $648 \times 4 =
2{,}592$ floats *is* the exact optimal representation for this MDP — a
neural function approximator would be solving a harder, noisier version of
the same problem for no representational benefit. This is a deliberate,
argued choice, not an oversight; see [INTUITION.md](INTUITION.md) and
[MINDSET.md](MINDSET.md).

### Environment grounding

Reward is computed from an hourly grid price curve (time-of-use: peak
17–21h at \$0.42/kWh, mid 07–16h & 22–23h at \$0.24/kWh, off-peak otherwise
at \$0.14/kWh) and a bell-curve solar generation profile peaking at noon —
see `env.py::_price_per_kwh`, `_solar_kwh`. These constants are
**hand-set, not fit from data** — a documented scope limitation (no public
dataset of home control *decisions* exists to fit them from), tracked in
[ROADMAP.md](ROADMAP.md).

### Evaluation protocol

Trained policy vs. two baselines, each evaluated over 200 held-out episodes
(fresh environment resets, not the training episodes):

1. **Always-idle**: never acts — the "do nothing" counterfactual.
2. **Naive fixed-time**: always attempts the flexible load at 8am regardless
   of price/solar state — a simple non-learned heuristic a real household
   might already use ("run the dishwasher after breakfast").

Comparing against both isolates *what* the agent learned: beating
always-idle shows it found value in acting at all; beating naive-fixed-time
shows it learned something beyond "there exists a fixed good time" — i.e.
that it's actually conditioning on price/solar/battery state.

---

## References

- Breiman, L. (2001). Random Forests. *Machine Learning*, 45(1), 5–32.
- Winters, P. R. (1960). Forecasting sales by exponentially weighted moving
  averages. *Management Science*, 6(3), 324–342.
- Watkins, C. J. C. H., & Dayan, P. (1992). Q-learning. *Machine Learning*,
  8, 279–292.
- Hebrail, G., & Berard, A. (2012). Individual Household Electric Power
  Consumption Data Set. UCI Machine Learning Repository.
  https://archive.ics.uci.edu/dataset/235
- Candanedo, L. M., & Feldheim, V. (2016). Accurate occupancy detection of
  an office room from light, temperature, humidity and CO2 measurements
  using statistical learning models. *Energy and Buildings*, 112, 28–39.
  https://archive.ics.uci.edu/dataset/357
- Makridakis, S., Spiliotis, E., & Assimakopoulos, V. (2020). The M4
  Competition: 100,000 time series and 61 forecasting methods.
  *International Journal of Forecasting*, 36(1), 54–74.
- Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An
  Introduction* (2nd ed.). MIT Press. — standard MDP/Q-learning reference.
