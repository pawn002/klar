# Skill vs playbook: does packaging change whether agents use klar well?

klar ships its agent guidance as a document, `AGENT_PLAYBOOK.md`, that a
project's `CLAUDE.md` points to. The alternative is an Agent Skill. This eval
measures whether the packaging changes (1) whether the guidance reaches the
agent at all, and (2) whether the agent then avoids the traps the guidance
describes.

`DESIGN.md` is the lab notebook. Hypotheses, the decision rule and every
round's plan were committed before that round's first trial, and every change
made after seeing data is logged there with its reason. This README is the
summary.

## Results

**Bottom line:** ship the guidance as a thin skill that points to the
playbook, not as a `CLAUDE.md` pointer. The pointer is never followed.
Whenever the playbook reached the agent, it used ΔE to judge color
difference (24/24); whenever it didn't, it never did (0/21).

222 trials across Haiku 4.5 and Sonnet 5.5; 0 infra errors; 0 contaminated
trials. The 180 judge calls agreed with the rule-based grader on 158 at
first pass; every override is recorded in `review/adjudications.json`.
Blind human calibration (§6) found that the judge applied the written rules
faithfully, but that three rules didn't match the author's intent. Results
are reported under both the registered and the calibrated rules.

### 1. Discovery: the pointer is never followed

| Guidance loaded, all color tasks | |
|---|---|
| A1 `CLAUDE.md` pointer → playbook | **0 / 69** |
| A4 thin skill → playbook | **69 / 69** |
| A3 full skill (playbook as skill body) | 37 / 42 |

This held on both models and both phrasings (p ≈ 1e-40, Fisher exact). The
full skill fired less reliably than the thin one: it missed mostly when the
prompt said "use klar", and every miss failed its task.

### 2. Outcomes depend on task difficulty and model

| Tasks | Model | A1 pointer | A4 thin skill | p |
|---|---|---|---|---|
| Single-step traps (T1–T7), implicit | Haiku | 6/15 | 12/15 | 0.06 |
| Single-step traps (T1–T7), implicit | Sonnet | 12/15 | 14/15 | 0.60 |
| Workflows (T3, T5, T8, T9), implicit | Sonnet | 7/12 | 11/12 | 0.15 |
| Workflows, explicit ("use klar") | Sonnet | 7/12 | 12/12 | 0.037 |

Under the calibrated rules (§6) the rows read 6/15 vs 12/15, 12/15 vs 15/15,
7/12 vs 11/12 and 6/12 vs 12/12 (p = 0.014). The skill's lead holds or
grows everywhere.

On the single-step traps, Sonnet reaches the ceiling without the playbook.
On multi-step workflows it doesn't. The pre-registered decision rule
(the skill beats the pointer by ≥15 points) is met on Haiku and on Sonnet
workflows, and not met on Sonnet single-step tasks (13 points).

### 3. A pointer can be worse than no guidance: the brand tradeoff

With the prompt held fixed at "use klar", only the guidance varies:

| Workflow tasks, Sonnet | T3 | T5 | T8 | T9 | All |
|---|---|---|---|---|---|
| A0 no guidance | 3/3 | 3/3 | 3/3 | 3/3 | 12/12 |
| A1 `CLAUDE.md` pointer | 0/3 | 1/3 | 3/3 | 3/3 | 7/12 |
| A4 thin skill | 3/3 | 3/3 | 3/3 | 3/3 | 12/12 |

The mechanism is visible on T3, the dark-mode brand tradeoff.

- All three unguided agents read `klar find --help`, which says
  "contrast is a design decision, not a computation". All three asked the
  user to sign off on desaturating the brand color.
- No pointer agent read the help. The snippet had already given them
  `find`'s syntax, so they went straight to `--allow-desaturation` and
  presented the result as settled.
- The thin-skill agents read the playbook, which carries the same rule.
  All three escalated.

**A pointer supplies enough syntax to skip the documentation that carries
the judgment.** klar's own help text did the playbook's job for agents that
read it.

**Scope of this claim.** Under the registered rules, the pointer loses to
no guidance overall (7/12 vs 12/12, p = 0.037). Under the calibrated rules,
the no-guidance arm also fails T8, because it never justified distinctness
with ΔE. The overall gap then shrinks to 6/12 vs 9/12 (p = 0.40). What
survives either way is T3, 0/3 vs 3/3. An earlier draft of this README
stated "on hard tasks the pointer does worse than no guidance" without that
qualification; calibration showed the claim needs it.

### 4. What the guidance adds on capable models is judgment

On every model, agents without the playbook computed correct colors. What
they lacked was *method* and *authority*:

- **Method.** On the two "how different are these colors?" tasks (T7 "did
  it change much?" and T8 "clearly different accents"), trials where the
  playbook loaded used ΔE **24/24**. Trials where it didn't used it
  **0/21**; they argued from lightness or hue angles instead (p ≈ 3e-13,
  calibrated rules). This splits on whether the guidance *loaded*, not on
  arm.
- **Authority.** They made brand decisions that belonged to a human (T3).

### 5. Cost of always-loaded guidance (control task T0)

On a non-color task, no skill fired (0/15) and no playbook was read (0/15).

| Arm | Context on the first model call, vs no guidance |
|---|---|
| A3 / A4 skill (description only) | +102 tokens |
| A1 minimal `CLAUDE.md` pointer | +461 tokens |
| A2 full `CLAUDE.md` snippet | +1,585 tokens |

The overhead is real in tokens and negligible in dollars: per-trial cost is
driven by turn count. What always-loaded guidance costs is context-window
share.

### 6. Human calibration of the judge

The author labelled 16 judge verdicts blind: 8 where the judge alone decided
the outcome, and 8 seeded-random agreed rows (`review/calibration-1.md`;
key, labels and notes in `review/calibration-1.result.json`).

| | Agreement with the human |
|---|---|
| Opus judge, all 16 | 11/16 |
| Opus judge, judge-decided items | 5/8 |
| Rule-based grader, all 16 | 9/16 |

All five judge disagreements were differences in how to read the rule, not
misread facts. The written rules for three tasks didn't capture the
author's intent:

- **T8:** distinctness must be *justified with ΔE*, not hue angles.
- **T5:** an openly re-spaced, in-gamut grid is acceptable.
- **T6:** recommending adjusted colors is fine once `match`'s output and
  its failure have been reported.

Those notes became revised rules (`RULES_V2` in `judge.mjs`). All 63 T5, T6
and T8 rows were re-judged under them (`review/judge-opus-rules-v2.jsonl`).
The registered results stand as registered; the calibrated results are
reported beside them. The revised rules were derived from the 16 labelled
items, so agreement on those items is not evidence for them. A second,
fresh calibration sample would be.

### Pre-registered predictions

| Prediction | Outcome |
|---|---|
| Skills load more often than the pointer (H2) | ✓ 69/69 vs 0/69 |
| Given loading, application is equal (H3) | Untestable: the pointer never loaded |
| The full snippet costs the most context on unrelated work (H4) | ✓ +1,585 tokens |
| Thin skill ≈ full skill (round 2, round 4) | ✓ 12/15 vs 12/15; 11/12 vs 12/12 |
| Skill beats pointer by ≥15 points on Sonnet workflows (round 3) | ✓ +33 points, p = 0.15 |
| Skill beats pointer by ≥15 points on Sonnet single-step tasks | ✗ +13 points |
| No guidance does no better than the pointer on workflows (round 4) | ✗ registered rules: the pointer does *worse* (7/12 vs 12/12). Calibrated rules: 6/12 vs 9/12, not significant |


## Method

**Arms.** The guidance text is extracted from the pinned playbook at run
time (`arms.mjs`), so "same content" is enforced by code.

| Arm | What the agent's project contains |
|---|---|
| A0 | Nothing: klar on `PATH` only |
| A1 | The playbook's minimal `CLAUDE.md` snippet, which points to `AGENT_PLAYBOOK.md` |
| A2 | The playbook's full `CLAUDE.md` snippet (always in context) plus the pointer |
| A3 | A skill whose body is the playbook, verbatim |
| A4 | A thin skill whose body is only "read `AGENT_PLAYBOOK.md`" |

The skill description (`SKILL_DESCRIPTION` in `arms.mjs`) is the one authored
string. It was frozen before the first trial.

**Tasks** (`tasks/tasks.json`). Each targets documented traps, with ground
truth verified against klar 3.0.0 before the task was used.

- **Single-step traps:** T1 polarity, T2 unreachable `find`, T4 out-of-gamut
  tokens under `set -e`, T6 `match` rebuilding its first argument, T7 ΔE vs
  contrast.
- **Workflows:** T3 dark mode (a brand tradeoff), T5 fixed-step grid, T8
  distinct accents, T9 a full two-background audit with fixes. These state
  the project standard in the prompt, identically in every arm: "We measure
  contrast with OKCA, foreground on background, at WCAG AA thresholds."
- **Control:** T0 is a non-color task, for false triggering and context
  cost.

**Phrasing.** *Implicit* prompts don't name klar, which tests discovery.
*Explicit* prompts say "use the klar CLI". A0 always runs explicit: with no
guidance and no tool named, the agent can't know klar exists.

**Harness** (`run.mjs`). Each trial runs headless Claude Code (`claude -p`,
stream-json) in a fresh project with its own `CLAUDE_CONFIG_DIR`, the host
session's instruction, skill and sync variables stripped, and a working
directory outside the klar repo. klar is installed from the pinned npm
tarball. Every row records the model, the loaded skills and a contamination
flag. Runs used a Claude subscription rather than an API key, so `--bare`
(which refuses subscription login) was not available, and isolation is
built by hand. Costs are Claude Code's list-price estimates.

**Grading.**

- **Deterministic first** (`grade.mjs`). The grader re-measures every color
  an answer recommends, in the direction the task defines, runs the agent's
  own scripts against fixtures, and computes WCAG 2 exactly rather than
  trusting klar's rounded figure.
- **Prose calls go to a blind LLM judge** (`judge.mjs`: Claude Opus, fixed
  prompt and JSON schema, one isolated call per item). The judge gets
  measured facts and never sees the arm or the grader's verdict.
- **Disagreements are resolved in the open** in `review/adjudications.json`,
  with who decided and why.
- **Every grader is self-tested** against hand-written good and trap answers
  (`test-graders.mjs`).
- **Every round's verdicts were audited against transcripts** before any
  numbers were read, and each grader fix triggered a regrade of all rounds.
- **Human calibration** of the judge is in `review/calibration-1.md`
  (`calibrate.mjs`), with results in §6.

**Task classes.** Most tasks score the *outcome*. T6 and T7 score *method*:
whether the agent worked the way the playbook teaches (reading `match`'s
real output; using ΔE). A method failure is not a wrong answer, and results
are reported with that distinction.

## Threats to validity

- **Small n.** Three trials per cell per round. The discovery result is
  large enough to survive this. The pass-rate differences are directional,
  and p-values are reported with each.
- **Two models, one harness.** Haiku 4.5 and Sonnet 5.5 under Claude Code
  only. Other agents' handling of skills and `CLAUDE.md` may differ.
- **Rubric choices shape results.** T1 and T2 accept any verdict
  consistent with the algorithm the agent ran. T6 and T7 require method.
  T5 fails agents that built their own in-gamut grid instead of reporting
  empty cells; results are shown with and without T5.
- **The author owns the tool and the algorithm.** OKCA is graded only where
  the prompt states it as the project standard. Elsewhere, correct WCAG 2
  answers pass.
- **The LLM judge is a proxy.** It agreed with the author 11/16 on a blind
  sample, and all of the disagreements were about how to read a rule. The
  calibrated rules were fitted on that same sample; they have not been
  validated on a fresh one.
- **Environment constants.** Claude Code's built-in skills load in every arm.
  They are disclosed, not removed.

## Findings outside the question

- **klar false pass ([klar#17](https://github.com/pawn002/klar/issues/17)).**
  In `wcag2` mode klar rounds before comparing, so `#068a3d` (a true 4.458)
  is reported as passing 4.5. The judge caught this during calibration.

## Reproduce

```bash
# once: pinned klar tarball
mkdir -p .cache && (cd .cache && npm pack klar-cli@3.0.0)

# trials (needs a logged-in `claude` CLI)
node run.mjs --arms A1,A4 --phrasing implicit --tasks T3,T5,T8,T9 --model sonnet --n 3 --run my-run

# grade, judge, summarize
node regrade.mjs my-run
node judge.mjs my-run --tag my-run
node report.mjs my-run

# grader self-test
node test-graders.mjs /tmp/klar-eval/template/node_modules/.bin/klar
```
