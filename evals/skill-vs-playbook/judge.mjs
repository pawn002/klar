#!/usr/bin/env node
// Blind LLM judge for the prose-read verdicts (rows with review: true).
//   node judge.mjs <run> [<run> ...] [--model opus] [--parallel 3]
// The judge sees the task, the scoring rule, measured facts and the agent's
// final answer. It never sees the arm or the rule-based grader's verdict.
// Each judgment is one isolated headless call with a fixed prompt and a JSON
// schema, logged to review/judge-<model>.jsonl. Agreement with the rule-based
// grader is printed; disagreements are what a human should look at.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const runs = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const model = opt("model", "opus");
const parallel = Number(opt("parallel", "3"));
const suite = JSON.parse(fs.readFileSync(path.join(HERE, "tasks/tasks.json"), "utf8"));

export const RULES = {
  T1: "PASS if the verdict matches the number the answer reports: 4.3 -> it must say the color fails AA body text; 5.6 (WCAG 2 mode) -> it must say it passes. Judge the prose only; argument order is checked elsewhere.",
  T2: "PASS only if all three hold: (a) it recommends a specific color as the fix, and that color truly clears 4.5 under the algorithm the agent used (measured values are given); (b) it tells the user what the fix costs the brand color: deltaE, or a clear statement of how much it shifted or desaturated; (c) if it mentions #00ba54, it flags that color as not passing.",
  T6: "Method task. PASS only if the answer (a) reports the colors `match` actually returned (given) as the final values, and (b) says each one fails 3:1 on white. Adjusting the colors afterwards, or hand-picking instead of using `match`, is a FAIL.",
  T7: "Method task. PASS only if the answer uses deltaE = 13 as its measure of how much the color changed. A lightness/hue/chroma breakdown without the deltaE figure is a FAIL.",
};

export function facts(r) {
  if (r.task === "T2") {
    const o = r.signals.offered ?? {};
    const algos = Object.entries(r.signals.algorithms ?? {}).filter(([, v]) => v).map(([k]) => k).join(" and ");
    return `Measured contrast on white of colors named in the answer: ${
      Object.keys(o).length ? Object.entries(o).map(([h, v]) => `${h} OKCA ${v.okca}, WCAG 2 ${v.wcag2}`).join("; ") : "(none named)"
    }. The agent used: ${algos || "unknown"}.`;
  }
  if (r.task === "T6") {
    return `What \`match\` actually returned in this run: ${r.signals.matched?.join(", ") ?? "`match` was never run"}. #3481fd scores 2.9 and #e94560 scores 2.8 on white; both fail 3:1.`;
  }
  return "";
}

const SCHEMA = JSON.stringify({
  type: "object",
  properties: { label: { type: "string", enum: ["PASS", "FAIL"] }, reason: { type: "string" } },
  required: ["label", "reason"],
});

function prompt(r) {
  return [
    "You are grading one answer from an AI agent against a fixed scoring rule.",
    "Apply the rule literally. Do not reward answers that are good in other ways the rule does not credit, and do not penalize style.",
    "Do not use any tools. Respond only with the requested JSON.",
    "",
    `TASK GIVEN TO THE AGENT:\n${suite.tasks[r.task].prompt}`,
    "",
    `SCORING RULE:\n${RULES[r.task]}`,
    facts(r) ? `\nMEASURED FACTS (trust these):\n${facts(r)}` : "",
    "",
    `AGENT'S FINAL ANSWER:\n<<<\n${r.final}\n>>>`,
  ].join("\n");
}

function judgeOne(r) {
  // One fixed, empty directory for every judge call. Claude Code's system
  // prompt includes the cwd, so a shared dir lets calls after the first read
  // the ~30K-token prompt from cache instead of rewriting it (~15x cheaper).
  // The judge reads nothing from disk, so sharing the dir leaks nothing.
  const dir = path.join(os.tmpdir(), "klar-judge");
  fs.mkdirSync(dir, { recursive: true });
  const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(dir, "cfg") };
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD|CLAUDE_ADDITIONAL_DIRECTORIES|CLAUDE_CODE_SYNC_.*|CLAUDE_EFFORT)$/.test(k)) delete env[k];
  const args = ["-p", prompt(r), "--model", model, "--output-format", "json", "--json-schema", SCHEMA,
    "--permission-mode", "dontAsk", "--permission-prompts", "none", "--max-turns", "3"];
  return new Promise((resolve) => {
    let out = "";
    const child = spawn("claude", args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => {
      let res = {};
      try { res = JSON.parse(out); } catch {}
      const s = res.structured_output ?? {};
      resolve({
        id: r.id, run: r.run, task: r.task, // Claude Code also makes small background calls on Haiku; the judge is the
        // model that did the most work.
        judgeModel: res.modelUsage ? Object.entries(res.modelUsage).sort((a, b) => b[1].costUSD - a[1].costUSD)[0][0] : model,
        judge: s.label ?? null, reason: s.reason ?? null, grader: r.pass ? "PASS" : "FAIL",
        costUsdListPrice: res.total_cost_usd ?? null,
      });
    });
  });
}

const rows = runs.flatMap((run) =>
  fs.readFileSync(path.join(HERE, "results", run, "rows.regraded.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)),
).filter((r) => r.review).slice(0, Number(opt("limit", "1e9")));

const queue = [...rows];
const out = [];
// Warm the cache with one call before fanning out.
if (queue.length) out.push(await judgeOne(queue.shift()));
await Promise.all(Array.from({ length: parallel }, async () => {
  while (queue.length) out.push(await judgeOne(queue.shift()));
}));
out.sort((a, b) => (a.run + a.id).localeCompare(b.run + b.id));
fs.mkdirSync(path.join(HERE, "review"), { recursive: true });
const tag = opt("tag", "");
const logFile = path.join(HERE, "review", `judge-${model}${tag ? "-" + tag : ""}.jsonl`);
fs.writeFileSync(logFile, out.map((o) => JSON.stringify(o)).join("\n") + "\n");

const judged = out.filter((o) => o.judge);
const agree = judged.filter((o) => o.judge === o.grader);
console.log(`judged ${judged.length}/${out.length}; agreement with rule-based grader: ${agree.length}/${judged.length}`);
console.log(`list-price cost: $${out.reduce((a, o) => a + (o.costUsdListPrice ?? 0), 0).toFixed(2)}`);
for (const o of judged.filter((o) => o.judge !== o.grader)) console.log(`DISAGREE ${o.run} ${o.id}: grader ${o.grader}, judge ${o.judge} — ${o.reason}`);
for (const o of out.filter((o) => !o.judge)) console.log(`NO VERDICT ${o.run} ${o.id}`);
