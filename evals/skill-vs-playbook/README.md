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

<!-- RESULTS -->

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
  (`calibrate.mjs`).

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
- **The LLM judge is a proxy.** It was checked against the rule-based grader
  every round and against human labels once. Its decisive calls are listed.
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
