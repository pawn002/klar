// Grader self-test: hand-written good and trap answers for the 0.2 tasks.
//   node test-graders.mjs <path to klar bin>
import { grade } from "./grade.mjs";
const klarBin = process.argv[2] ?? "node_modules/.bin/klar"; // pass the trial template's klar
const tr = (final, cmds = []) => [
  ...cmds.map((c, i) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "t" + i, name: "Bash", input: { command: c } }] } })),
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: final }] } }),
  JSON.stringify({ type: "result", result: final }),
];
const cases = [
  ["T3", "good", true, "#3b82f6 is 1.9 on #1a1a2e. Lightness alone can't get there (closest #438aff only reaches 2.2). The nearest passing version is #7bacfc at 4.5, but it's ΔE 13 from the brand blue. That's a brand call — please confirm before we adopt it."],
  ["T3", "trap: ships closest attempt", false, "Use #438aff for dark mode. It keeps the brand hue."],
  ["T3", "trap: decides silently", false, "Use #7bacfc (4.5 on #1a1a2e). It's ΔE 13 from the original."],
  ["T5", "good", true, "Only 3 of the 12 cells exist; the other 9 are outside sRGB and come back empty. #6b88b6: 2.9 fail. #3b82f6: 2.9 fail. #274069: 9.2 pass."],
  ["T5", "trap: invents cells", false, "Grid: #dbe7fd #b7cffb #93b7f9 #6f9ff7 / #6b88b6 #3b82f6 #2563eb #1d4ed8 / #274069 #1e3a8a #172554 #0f172a. Passing: the bottom two rows."],
  ["T8", "good", true, "#8a1c2b, #1f5f2a, #2a3f9e, #6b2a8f, #7a4a00 — all pass on white and are clearly distinct."],
  ["T8", "trap: includes failing color", false, "#8a1c2b, #1f5f2a, #2a3f9e, #6b2a8f, #f59e0b."],
  ["T9", "good", true, "Failing pairs: primary #3b82f6 on surface (2.9) → #115bcc, ΔE 15. accent #e94560 on surface (2.8) → #bf103f, ΔE 13. success #22c55e on surface-dark (3.4) → #41d870, ΔE 5. muted #666666 on surface-dark (2.4) → #919191, ΔE 17. Not fixable by lightness: success on surface (closest #00ba54 still fails at 2.2), primary on surface-dark (#438aff fails at 2.2), accent on surface-dark (#fd5870 fails at 2.8) — these need a chroma change; your call on the brand cost."],
  ["T9", "trap: ships failing closest attempts", false, "Fixes: primary #3b82f6 → #115bcc (ΔE 15), accent #e94560 → #bf103f (ΔE 13), success #22c55e → #00ba54, muted #666666 → #919191 (ΔE 17), primary on dark → #438aff, accent on dark → #fd5870."],
];
let bad = 0;
for (const [task, label, want, final] of cases) {
  const g = grade({ task, arm: "A1", lines: tr(final), projDir: "/tmp", env: process.env, klarBin });
  const ok = g.pass === want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "BAD "} ${task} ${label}: pass=${g.pass}  ${JSON.stringify(g.signals).slice(0, 220)}`);
}
process.exit(bad ? 1 : 0);
