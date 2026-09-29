#!/usr/bin/env node
// Summarize one or more runs:  node report.mjs pilot-haiku-b1 pilot-haiku-b2 ...
// Infra errors are counted and excluded; they are not failures of an arm.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runs = process.argv.slice(2);
const rows = runs.flatMap((r) =>
  fs.readFileSync(path.join(HERE, "results", r, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)),
);

const ok = rows.filter((r) => r.status === "ok");
const infra = rows.length - ok.length;
const arms = [...new Set(ok.map((r) => r.arm))].sort();
const tasks = [...new Set(ok.map((r) => r.task))].sort();
const frac = (xs, f) => (xs.length ? `${xs.filter(f).length}/${xs.length}` : "–");
const sum = (xs, f) => xs.reduce((a, x) => a + (f(x) ?? 0), 0);

console.log(`runs: ${runs.join(", ")}   trials: ${rows.length} (${infra} infra-error excluded)\n`);

console.log("Pass rate by arm × task");
console.log(["arm", ...tasks, "all"].join("\t"));
for (const a of arms) {
  const ra = ok.filter((r) => r.arm === a);
  console.log([a, ...tasks.map((t) => frac(ra.filter((r) => r.task === t), (r) => r.pass)), frac(ra, (r) => r.pass)].join("\t"));
}

console.log("\nPer arm");
console.log(["arm", "guidance loaded", "used klar", "contaminated", "turns (mean)", "list $ total"].join("\t"));
for (const a of arms) {
  const ra = ok.filter((r) => r.arm === a);
  console.log([
    a,
    a === "A0" ? "n/a" : frac(ra, (r) => r.common.guidanceLoaded),
    frac(ra, (r) => r.common.klarCalls > 0),
    frac(ra, (r) => r.common.contaminated),
    (sum(ra, (r) => r.common.turns) / ra.length).toFixed(1),
    sum(ra, (r) => r.common.costUsdListPrice).toFixed(2),
  ].join("\t"));
}

// Outcome split by whether guidance was loaded: separates discovery from application.
console.log("\nPass rate split by guidance loaded (A1/A3)");
for (const a of arms.filter((x) => x !== "A0")) {
  const ra = ok.filter((r) => r.arm === a);
  console.log(`${a}\tloaded ${frac(ra.filter((r) => r.common.guidanceLoaded), (r) => r.pass)}\tnot loaded ${frac(ra.filter((r) => !r.common.guidanceLoaded), (r) => r.pass)}`);
}

console.log(`\nTotal list-price cost: $${sum(rows, (r) => r.common?.costUsdListPrice).toFixed(2)}`);
console.log(`Rows needing human review (prose-read verdicts): ${ok.filter((r) => r.review).length}`);
