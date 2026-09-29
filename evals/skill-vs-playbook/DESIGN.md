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

- [x] Harness: `run.mjs` (runner), `arms.mjs` (arm fixtures), `grade.mjs` (graders), JSONL rows
- [x] Task prompts for the lean round (T1, T2, T4, T6, T7), versioned in `tasks/tasks.json`
- [x] Deterministic graders for T1, T2, T4, T6, T7
- [x] Smoke run: A1 × T1 × Haiku × n=1, end to end (`results/smoke/`)
- [ ] Hand-label the pilot's `review: true` rows to calibrate the prose-reading graders
- [ ] Graders for T3, T5, T8, T9, T0 (main round only)
- [ ] Judge prompt + calibration set for T2/T3 (main round only)
- [ ] Second harness (pi) if the result needs checking outside Claude Code

## Changelog

- **2026-09-29:** Initial design. Trap ground truth verified on klar 3.0.0.
- **2026-09-29, before any pilot trial (pre-run changes):**
  - **Lean pilot replaces the 180-run pilot** for budget reasons. Scope:
    arms A0, A1, A3. Tasks T1, T2, T4, T6, T7. Haiku 4.5, then Sonnet 5.5 only
    if Haiku shows a signal. n=3 per cell, 45 trials per model. A2, A4, T0,
    T3, T5, T8 and T9 wait for the main round.
  - **Phrasing rule:** A0 runs the *explicit* prompt; A1 and A3 run the
    *implicit* prompt. A0 with no guidance and no tool named is degenerate,
    because the agent can't know klar exists. A1 vs A3 on implicit phrasing
    is the core comparison.
  - **Skill description fixed** as `SKILL_DESCRIPTION` in `arms.mjs`. It is the
    one authored string in the skill arms and could decide triggering on its
    own, so it is frozen before the first pilot trial.
  - **Harness:** Claude Code headless (`claude -p`, stream-json), run on the
    author's subscription rather than an API key. `--bare` would give the
    cleanest isolation but refuses subscription login. Instead, each trial
    gets its own project and its own `CLAUDE_CONFIG_DIR`, the host session's
    instruction/skill/sync environment variables are stripped, and the work
    directory sits outside the klar repo. Every row records the loaded skills
    and a contamination flag.
  - **Known constant:** Claude Code's built-in skills (dataviz, claude-api
    and others) load in every trial. None concerns klar, and they're
    identical across arms, so they're disclosed rather than removed.
  - **Permissions:** `dontAsk` plus an allowlist
    (Bash, Read, Write, Edit, Glob, Grep, Skill). `bypassPermissions` is
    refused when running as root. `--permission-prompts none` removes
    `AskUserQuestion`, so a trial reports tradeoffs in its answer instead of
    pausing for a human.
  - **Smoke result (harness validation, not data):** A1 × T1 × Haiku passed.
    It used 2 turns, $0.066 at list price, and 29.7K tokens of cache write.
    The playbook was never opened: the minimal CLAUDE.md snippet already
    shows `klar contrast <fg> <bg>`, and that was enough for T1. So A1's
    "guidance loaded" undercounts the guidance the agent actually had. The
    pilot reports outcome by arm regardless of load status.
- **2026-09-29, after pilot batch 1 of 3 (grader validation, which the pilot
  exists for; no hypothesis read from it):**
  - **T6 grader bug fixed.** Two correct answers were failed: one wrote
    "just misses" / "neither quite clears", which the failure-word check
    missed; the other ran an exploratory `match` call first, and the grader
    parsed that one. The grader now uses the `match` call whose output the
    answer reports. Regrading changed exactly those two rows.
  - **T1 scoring changed to algorithm-consistent (author's decision).**
    Without guidance, A0 read "WCAG AA", ran `--type wcag2`, got 5.6 and said
    it passes. That's correct under WCAG 2.x. A pass now requires the verdict
    to match the algorithm the agent ran, with OKCA measured in fg/bg order.
    Algorithm choice is recorded as its own signal. Reason: the eval
    shouldn't grade its author's algorithm preference as correctness.
  - **T7 unchanged: ΔE required (author's decision).** A0 and A1 answered
    "noticeable darkening" from OKLCH components. That's a reasonable verdict
    reached without the perceptual metric. T7 is kept as a test of whether
    guidance changes method, and the post must say so.
  - Batch 1 rows are regraded from the saved transcripts
    (`rows.regraded.jsonl`); the run-time rows are kept.
- **2026-09-29, after pilot batch 2 of 3 (grader validation):**
  - **Failure-word bug fixed.** "doesn't quite meet… just short" was missed,
    which failed a correct T1 answer. Optional adverbs, "clear/reach" and
    "just short" are now matched. Regrading changed only that row.
  - **T2 made algorithm-consistent,** extending the T1 decision: offered
    colors are measured with each algorithm the agent actually ran. No
    verdict changed. A0-T2 still fails, because it called the shift "modest"
    without quantifying the cost.
  - **T6 unchanged: method required (author's decision).** Two answers were
    correct by outcome but skipped or went beyond `match`. One hand-picked
    colors with matched chroma 0.19 at exactly 3.0. The other matched, then
    re-adjusted both colors to 3.3. Both are scored as failures.
  - **Task classes, for the write-up:** T1, T2 and T4 score *outcome*
    (algorithm-consistent). T6 and T7 score *method*: did the agent work the
    way the playbook teaches. Report the two classes separately; a method
    failure is not a wrong answer.
- **2026-09-29, after pilot batch 3 of 3 (grader validation):** three more
  grader bugs, all fixed, with all 45 trials regraded:
  - Algorithm detection missed the short flag `-t wcag2` (T1, T2).
  - The final answer was taken from the last message only. Agents often
    state the answer, run one closing command, then add a note, so the
    answer now starts at the last text block before the final tool call.
    This also flipped batch 2's A3-T7 to a pass: it had reported "deltaE 13"
    before its closing command. The earlier manual audit of that row
    (logged above as "computed ΔE but never reported it") was wrong for the
    same reason.
  - T4 now treats a klar warning printed on the line after a token's line as
    that token's flag.
- **Pilot result (Haiku 4.5, n=3 per cell, 45 trials, $2.68 at list price).**
  Per the design, the pilot validates the harness and doesn't test the
  hypotheses. Recorded here so the main round can be sized from it:
  - Overall pass rate: A0 8/15, A1 7/15, A3 12/15.
  - Guidance loaded: A1 0/15 (the pointer was never followed), A3 14/15.
  - Outcome tasks (T1, T2, T4): A0 5/9, A1 7/9, A3 8/9.
    Method tasks (T6, T7): A0 3/6, A1 0/6, A3 4/6.
    Most of A3's lead over A1 comes from the method tasks.
  - H3 (equal application once guidance is loaded) can't be evaluated: A1
    never loaded the playbook.
  - "Used klar" reads 14/15 for A1 and A3 only because one T4 trial in each
    called klar inside `audit.sh` rather than directly.
- **2026-09-29, Opus judge calibration of the 36 prose-read verdicts.**
  `judge.mjs` runs a blind judge (claude-opus-5-5, headless, fixed prompt and
  JSON schema, one call per item; log in `review/judge-opus.jsonl`, $1.76 at
  list price). It never sees the arm or the grader's verdict.
  - **First-pass agreement: 34/36.** Both disagreements were T2, and in both
    the judge was right. The grader was then corrected, and agreement is now
    36/36. That second figure is post hoc; report 34/36 as the independent
    agreement.
  - **Disagreement 1 exposed a klar bug.** The agent ran `find -t wcag2` and
    got `#068a3d` back with `success: true`, exit 0, "4.5". Its exact WCAG 2
    ratio is 4.458. klar rounds wcag2 to one decimal (`toFixed(1)`) before
    comparing, so colors whose true ratio falls in [4.45, 4.5) are reported
    as passing. WCAG 2's threshold is unrounded. The grader now computes
    WCAG 2 exactly. OKCA also rounds to one decimal, but that rounding is
    part of OKCA's published output definition, not a comparison applied on
    top of a standard.
  - **Disagreement 2: the cost must be quantified.** The rule asks "how much"
    the fix costs, and "desaturate significantly / more muted" doesn't say
    how much. The grader now requires a figure: ΔE, a percent or amount, or
    a from→to value.
  - Net effect on the pilot: T2 is now A0 1/3, A1 1/3, A3 3/3.
    Overall: A0 7/15, A1 6/15, A3 12/15. Outcome tasks: A0 4/9, A1 6/9,
    A3 8/9.
- **2026-09-29, round 2 plan (fixed before any round-2 trial).**
  - **Cells:** A4 (thin skill → playbook) on implicit phrasing, and A1 and A3
    on explicit phrasing. The explicit runs supply the decision rule's
    "no regression on explicit phrasing" condition, which the pilot never
    ran. Same five tasks, Haiku 4.5, n=3 per cell, 45 trials.
  - **Graders frozen** at the version validated in the pilot, including the
    judge-driven fixes. Round-2 verdicts are graded with them unchanged. Any
    grader bug found in round 2 is logged and fixed, and *all* rounds are
    regraded, so arms stay comparable.
  - **Judge check:** the same blind Opus judge runs on round 2's prose-read
    verdicts, and first-pass agreement is reported.
  - **What round 2 answers:** (1) Is the skill's value in *triggering* or in
    *content*? A4 triggers like A3 but carries only a pointer. If A4 ≈ A3,
    ship the thin skill (the decision rule's preferred outcome). If A4 ≈ A1,
    the content has to live in the skill. (2) Does naming klar close the gap
    between A1 and A3?
- **2026-09-29, round 2 result (Haiku 4.5, n=3 per cell, 45 trials, $2.83
  at list price, plus $1.82 for the judge).**
  - **Grader fixes found by auditing round 2** (all nine runs regraded; no
    pilot verdict changed):
    - T1 now parses each `klar contrast` call separately and strips `$(…)`
      substitutions. A chained `find BG FG && contrast "$(find …)"` had been
      read as reversed argument order.
    - "won't pass" and "N points short" added to the failure words.
    - T4 counts `ERROR` or `N/A` on an out-of-gamut token as flagging it.
      Two scripts marked exactly those tokens that way without saying
      "gamut". Disclosed as an interpretation of the rule.
  - **Judge:** 36/36 first-pass agreement. Independent this time, because
    the fixes above came from the author's audit before the judge ran.
  - **Results across both rounds (pass / guidance loaded):**
    A0 7/15; A1 6/15, 0/15; A3 12/15, 14/15; A4 12/15, 15/15;
    A1-explicit 9/15, 0/15; A3-explicit 10/15, 11/15.
  - **Decision rule, applied as written.**
    - A4 (and A3) beat A1 on implicit phrasing by 40 points (≥15 ✓).
    - A3-explicit is not worse than A1-explicit (10/15 vs 9/15) ✓. A4 was
      not run on explicit phrasing, so that condition is checked on A3 only.
    - A4 ≈ A3 (12/15 each) → per the rule, **ship A4**, the thin skill
      pointing at the playbook.
  - **Strength of evidence (two-sided Fisher exact).**
    - Discovery gap, A4 vs A1 loading guidance (15/15 vs 0/15):
      p = 1.3e-8.
    - Pass rate, A4 vs A1 (12/15 vs 6/15): p = 0.06, suggestive rather
      than conclusive at n=15.
    - Outcome tasks alone, A4 vs A1 (9/9 vs 6/9): p = 0.21.
    - Explicit phrasing, A3 vs A1 (10/15 vs 9/15): p = 1.0.
  - **Observations for the write-up:**
    - Naming klar in the prompt raised A1's outcome score from 6/9 to 9/9,
      yet the playbook was still never opened, and method stayed 0/6.
    - With "use klar" in the prompt, A3's skill fired less often (14 → 11
      of 15). All four trials where it didn't fire failed.
    - T6 stopped discriminating between arms: 0/9 in round 2. Agents that
      found both matched colors failing 3:1 went on to fix them, which the
      method rule scores as a failure. The T6 rule should be revisited
      before any further round.
- **2026-09-29, confirmation round plan (fixed before any Sonnet trial).**
  - **Model:** Sonnet 5.5 (`--model sonnet`; the resolved ID is recorded
    per row). **Cells:** A1 implicit, A4 implicit, A4 explicit. Tasks T1,
    T2, T4, T6, T7. n=3 per cell, 45 trials. A0 and A3 are omitted for
    budget: A0 is the floor, and A3 ≈ A4 on Haiku.
  - **Graders frozen** as of the round-2 commit. The same audit-and-regrade
    policy applies, and the blind Opus judge checks prose verdicts.
  - **Predictions:** (1) the loading gap replicates: A1 ≤ 1/15, A4 ≥ 13/15;
    (2) A4 passes more than A1 on implicit phrasing. The gap may shrink on a
    stronger model, and a shrinking gap is a reportable result, not a
    failure of the round. (3) A4 explicit is not worse than A4 implicit by
    more than the decision rule's 15 points. That settles the rule's
    untested condition for the arm that would ship.
  - **T6:** the method rule stays primary, for comparability. Every result
    is also reported with T6 excluded, as a sensitivity check, because T6
    stopped discriminating in round 2.
