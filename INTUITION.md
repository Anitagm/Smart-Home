# Intuition

Plain-language mental models for the three ML features — no equations
(those are in [THEORY.md](THEORY.md)), no result tables (those are in
[ANALYSIS.md](ANALYSIS.md)). The point of this file is that whoever writes
the paper's introduction/motivation should be able to explain *why this
approach makes sense* to a non-specialist reader before diving into
formalism, and an AI agent extending this project should understand the
reasoning well enough to make consistent choices when it hits a decision
the docs didn't anticipate.

---

## A. Why forecast energy at all, and why this way

**The intuition for forecasting**: a smart home that can only tell you
what's happening *right now* is a dashboard. A smart home that can tell you
what's about to happen can *act* — pre-cool a room before a price spike,
warn you before a battery runs low overnight. Forecasting is the
prerequisite for everything prescriptive (Direction D leans on this
directly: an agent can't plan around a price spike it doesn't know is
coming).

**Why an ensemble of a tree model and a classical statistical model,
specifically**: think of Random Forest as "a model that's good at picking
up on *your* specific habits" — it sees sub-metering (which circuit is
drawing power) and calendar features, so it can learn things like "this
household's washing machine tends to run Sunday mornings." Think of
Holt-Winters as "a model that only knows the *shape* of a typical day" —
it has no idea about appliances or habits, it just knows power tends to
dip at 3am and peak at 7pm. Neither is right on its own. When they
**agree**, you can be more confident; when they **disagree**, that
disagreement itself is useful information — it's telling you "the
behavior-aware model and the generic-shape model see this moment
differently," which is exactly when a forecast is least trustworthy. That
disagreement is what becomes the shaded confidence band on the chart.

**Why the what-if tool matters more than it looks**: a forecast nobody can
act on is a curiosity. "What happens if I run the dishwasher at 6pm instead
of now" turns a passive prediction into a decision-support tool — the same
shift in framing that separates Direction A from Direction D (forecasting
tells you what will happen; the AI Manager tells you what to *do* about
it).

---

## C. Why occupancy prediction, and why it's simpler than it sounds

**The intuition**: most smart-home automations key off *time* ("turn off
lights at 11pm") when what they actually want to key off is *whether
anyone's there*. A house that infers occupancy from ambient signals
(is the CO2 rising? are the lights on?) can automate on the right variable
instead of a proxy for it.

**Why Light and CO2 turn out to matter most**: this is genuinely intuitive
once you say it out loud — a room with the lights off is very likely
empty (during hours when lights would be on if someone were there), and
a room with rising CO2 has a person in it, breathing. The model isn't
finding some exotic hidden pattern; it's recovering the two features a
human would guess first. That's a feature, not a limitation — it means the
result is legible and the model's "reasoning" can be explained to a
non-technical reader in one sentence, which matters for a paper's
credibility with reviewers checking whether a black box is doing something
sensible.

**Why the simplest model won**: Logistic Regression beating Random Forest
here is the ML-methodology equivalent of "don't bring a bazooka to a knife
fight." Once two features are strong, mostly-linear predictors of the
outcome, a straight line separating "probably occupied" from "probably
not" already gets you most of the way there — a forest's extra ability to
carve curved decision boundaries has nothing valuable to carve. This is a
useful intuition to generalize: **model complexity should track problem
complexity, not the other way around**, and checking a linear baseline
before reaching for an ensemble is good practice this project's own
results happen to validate.

**Why one room, extrapolated, is honestly labeled rather than dressed up**:
it would be easy to let a dashboard showing "six rooms, all with
percentages" imply six rooms of real data. It doesn't have that, and
overclaiming it does is exactly the kind of thing that damages a paper's
credibility once a reviewer notices. Framing it instead as "we show what a
real, validated model *would* predict given plausible per-room sensor
readings" is both true and still useful to demonstrate the concept.

---

## D. Why prescriptive, and why Q-learning over something fancier

**The intuition for going prescriptive**: forecasting says "here's what
will probably happen." Occupancy says "here's who's probably home."
Neither *decides* anything. The natural next step — and the most
ambitious of the three directions — is a system that says "given all of
that, here's what to do, and here's why," while still leaving the human in
control (accept/reject). This closes the loop from *sensing* to
*informing* to *acting*, which is the fuller "smart" in smart home.

**Why reinforcement learning and not just a rule engine**: you *could*
hand-write "if price is high and battery > 50%, discharge" — and for a
system this small, hand-written rules would probably work about as well.
The point of using RL instead is that the same learning procedure
generalizes to a more complex environment (more appliances, more nuanced
comfort constraints, a battery with real charge/discharge losses) without
a human re-deriving the rules by hand every time the environment changes —
Q-learning *discovers* the equivalent of "if price high and battery
available, discharge" by trial and error rather than being told it, and
would rediscover a *different* rule automatically if the environment's
prices or appliances changed.

**Why a table instead of a neural network**: this is the single most
important intuition in this whole project's ML design, worth
internalizing for any future extension: **the size of your state space
should determine your function-approximation strategy, not habit or
prestige**. A neural network earns its keep when the state space is too
big to enumerate (image pixels, continuous sensor streams with no natural
discretization) — you *need* it to generalize across states you'll never
visit during training. Here, the state space is 648 cells. You can visit
every one of them thousands of times in seconds of wall-clock training.
A table isn't a simplification of the "real" solution — for this
particular problem, a table converged by enough visits to every cell *is*
the exact optimal solution, with zero approximation error and zero
mystery about what it learned (you can print the whole policy). Reach for
a neural network's generalization power only once you actually have a
state space too large to enumerate — the discretized version of this
environment doesn't, yet.

**Why the agent explains itself instead of just acting**: the point of
`recommended_action_label` + `explanation` + the full Q-value table for
every alternative isn't cosmetic — it's the difference between "a black
box that controls your house" (which most people, reasonably, won't
trust) and "an advisor that shows its work and lets you decide." The
accept/reject history is what turns this from a one-shot demo into
something that could, in principle, accumulate evidence over time about
whether the agent's recommendations are actually good ones a household
wants to keep following.

---

## The throughline across all three

Each direction answers a different question a smart home should be able
to answer, in increasing order of how much it commits to on the user's
behalf:

1. **A (Forecasting)**: "What's likely to happen?" — purely informational.
2. **C (Occupancy)**: "What's likely true right now, that I can't directly
   observe?" — inference, still informational.
3. **D (Prescriptive)**: "Given all of that, what should I do?" —
   actionable, but kept human-in-the-loop rather than autonomous.

That ordering (inform → infer → advise, never *act without asking*) is a
deliberate design stance worth keeping consistent in any future extension
of this system — see [MINDSET.md](MINDSET.md) for the working-style
principles that follow from it.
