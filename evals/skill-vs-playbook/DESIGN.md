# Eval: Agent Skill vs Agent Playbook

**Status:** pre-registration draft, 2026-09-29. No trials run yet. Hypotheses and
the decision rule below are fixed *before* the first run; any later change is
logged in the Changelog at the bottom with its reason.

**Pinned:** klar-cli 3.0.0. Trap behaviors in the task table were verified
against this build on 2026-09-29.

---

## Question

klar ships its agent contract as a document, `AGENT_PLAYBOOK.md`, that an agent
reaches through a pointer in the host project's `CLAUDE.md`. The alternative is
an Agent Skill: a `SKILL.md` whose one-line description is always in context
and whose body loads when the agent decides the task matches.

**Does packaging the same klar knowledge as a skill instead of a playbook
change how successfully an agent uses klar?**

That question has two parts, and they fail differently:

1. **Discovery.** Does the guidance reach the agent's context when it's
   relevant? A playbook depends on the agent following a pointer. A skill
   depends on the agent matching a description.
2. **Application.** Once the guidance is loaded, does the agent avoid the
   traps it describes?

Content is held constant across the playbook and skill arms, so a difference
in outcome is a difference in *delivery*. If both arms load the guidance
equally often and apply it equally well, the packaging doesn't matter and the
choice comes down to maintenance and reach.

## Arms

| Arm | Setup | What it isolates |
|---|---|---|
| **A0 bare** | klar on PATH. No CLAUDE.md, no skill. | The floor. Also a direct test of the domain-CLI post's claim that agents fail where training data runs out. |
| **A1 playbook-pointer** | Minimal CLAUDE.md snippet (from the playbook) pointing at `AGENT_PLAYBOOK.md` | Today's recommended light integration. |
| **A2 playbook-full** | Full CLAUDE.md snippet (always in context) plus the pointer | Today's recommended heavy integration. |
| **A3 skill-verbatim** | `.claude/skills/klar/SKILL.md` = description + playbook body, verbatim. No CLAUDE.md. | Same content as A1, delivered as a skill. **A1 vs A3 is the core comparison.** |
| **A4 skill-pointer** | `SKILL.md` = description + "read `AGENT_PLAYBOOK.md`" | The zero-duplication shipping option: the skill triggers, the playbook stays the single source. |

Phase 2, only after A0–A4 answer the clean question: **A5 skill-restructured**
(short SKILL.md plus per-workflow reference files). This one changes content
structure as well as delivery, so it's confounded by design. It's the arm that
answers "what would I actually ship," not "which delivery is better."

The playbook itself is the one thing no arm edits. If a trial exposes a
playbook defect, it gets logged and fixed *between* rounds, with a version
bump on the task suite.

## Tasks

Each task is phrased the way an art director would ask. Each targets at least
one documented trap, and every trap was reproduced on 3.0.0.

| ID | Prompt (gist) | Trap | Verified ground truth (3.0.0) |
|---|---|---|---|
| T1 | "Is `#0055ff` OK for body text on white?" | Polarity. Measuring bg/fg returns a pass. | fg/bg = 4.3 → **fails AA**. Reversed = 4.5. |
| T2 | "Make `#22c55e` pass on white for body text, keep it on brand." | `find` exits 1 but still prints `#00ba54`. | `lightness-exhausted`. Honest fix costs ΔE 22. Must not ship `#00ba54` as the fix. |
| T3 | "Dark-mode version of `#3b82f6` on `#1a1a2e`." | Deciding the brand tradeoff alone (`--allow-desaturation`). | `lightness-exhausted`, `resolvableBy.deltaE` 13. Must report the cost, not pick silently. |
| T4 | "Write a CI script that audits these tokens" (OKLCH file, some outside sRGB, `set -e`) | Bare `$(klar contrast …)` aborts the run at the first out-of-gamut token. | `oklch(0.7 0.3 150)` exits 1. Script must finish and flag it. |
| T5 | "Give me a 4×3 grid of shades of `#3b82f6`." | Fixed-step mode emits `""` cells. | 9 of 12 cells empty. Output must contain no empty or invalid colors. |
| T6 | "Match saturation of `#3b82f6` and `#e94560`, then check both still work on white." | Assuming `match` keeps its first argument. Skipping the re-verify. | Returns `#3481fd`, not `#3b82f6`. |
| T7 | "I nudged `#e94560` to `#bf103f`. Did it change much?" | Answering with a contrast ratio instead of ΔE. | ΔE 13, "clearly different." |
| T8 | "Five accent colors, mutually distinct, all AA on white." | Padding the list with failing colors. | Workflow 5: 6 survivors from the adaptive grid. |
| T9 | Composite audit of a small token set with fixes | T1 + T2 + T7 together | Oracle computes every pair itself. |
| T0 | **Control:** a non-color task in the same repo | False triggering, context overhead | No klar call expected. Measures tokens spent on guidance that wasn't needed. |

**Phrasing factor.** Every task runs in two phrasings: *explicit* ("use klar
to…") and *implicit* (no tool named). The implicit phrasing is where skill
matching vs. pointer-following should diverge most.

## Measures

Per trial, recorded to a JSONL row:

- **Outcome (primary):** pass/fail against the task's oracle.
- **Trap hits:** a flag per documented trap the transcript fell into.
- **Guidance loaded:** A1/A2: did the transcript `Read` `AGENT_PLAYBOOK.md`?
  A3/A4: did the skill fire? Loading doesn't count as success. It's the
  mediator.
- **klar usage:** did the agent call klar at all, or hand-roll the math?
- **Cost:** input/output tokens, turns, tool calls, wall time.
- **Provenance:** Claude Code version, model ID, klar version, arm, task
  version, seed/trial index.

## Grading

**Deterministic first.** The oracle re-runs klar on every hex the agent
recommends, in the fg/bg order the task defines. A color presented as a fix
that doesn't clear the threshold fails the trial, whatever the prose says.
T4 runs the agent's script under `set -e` against the fixture. T5 validates
every emitted color.

**LLM judge only where a string match can't decide.** The main case is T2/T3:
did the agent escalate the tradeoff rather than make it? That judge follows
the same rule as the safety-surface benchmark's C5 judge: *calibrated or not
trusted.* Before its scores count, I hand-label a subset, publish the
agreement rate, and state the judge's model and prompt.

## Design and budget

- **Pilot:** A0, A1, A3 × T0–T9 × both phrasings × one mid-tier model × n=3.
  180 runs. The pilot validates the harness and graders and sizes the effect.
  It doesn't test the hypotheses.
- **Main:** all five arms × three model tiers × n sized from pilot variance.
  Guidance plausibly matters more for smaller models. That interaction is a
  finding in its own right.
- **Isolation:** a fresh temp project per trial. No user-level CLAUDE.md or
  skills leaking in. klar installed from a pinned tarball. Headless
  `claude -p --output-format stream-json` so the full transcript is kept.

## Hypotheses (pre-registered)

- **H1.** A0 fails most trap tasks. klar's traps sit past the training data.
- **H2.** Discovery: A3/A4 load guidance more often than A1, and the gap is
  larger on implicit phrasing.
- **H3.** Application: conditional on guidance being loaded, A1 and A3 succeed
  at the same rate. Identical content should give identical application.
- **H4.** A2 matches A3 on success but costs more tokens on T0, because its
  snippet is always in context.

## Decision rule

Fixed now, so the result can't pick its own threshold later:

- **Convert to a skill** if A3 or A4 beats A1 on primary outcome by ≥15
  points on implicit phrasing without regressing on explicit phrasing.
- **If A4 ≈ A3,** ship A4. A thin skill that points at the playbook keeps one
  source of truth and still serves non-Claude agents that read markdown.
- **Keep the playbook as is** if no arm beats A1 by that margin. Then the
  post's claim ("ship the contract as a document") stands as tested rather
  than asserted.
- **If A0 is close to every other arm,** the playbook isn't what's carrying
  success, and that finding outranks the skill question.

## Open items

- [ ] Harness: runner script, per-arm fixtures, JSONL writer
- [ ] Task prompts written out in both phrasings, versioned
- [ ] Oracles for T1–T9
- [ ] Judge prompt + calibration set for T2/T3
- [ ] Smoke run: 1 arm × 1 task × n=1, end to end
- [ ] Check whether `claude plugin eval` can host this instead of a custom runner

## Changelog

- **2026-09-29:** Initial design. Trap ground truth verified on klar 3.0.0.
