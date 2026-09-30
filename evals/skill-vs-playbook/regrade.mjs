#!/usr/bin/env node
// Re-grade saved transcripts with the current graders, without re-running trials.
//   node regrade.mjs <run> --work <trial work dir>
// Writes rows.regraded.jsonl beside rows.jsonl; the original rows are kept.
// T4 re-runs the agent's audit.sh, so it needs the trial project directories.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grade } from "./grade.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [run] = process.argv.slice(2);
const wi = process.argv.indexOf("--work");
const WORK = wi > 0 ? process.argv[wi + 1] : path.join(os.tmpdir(), "klar-eval");
const dir = path.join(HERE, "results", run);
const rows = fs.readFileSync(path.join(dir, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
// Human/judge adjudications override the grader, visibly, per row.
const adjPath = path.join(HERE, "review", "adjudications.json");
const adjudications = fs.existsSync(adjPath) ? JSON.parse(fs.readFileSync(adjPath, "utf8")) : {};
const out = [];
for (const r of rows) {
  const projDir = path.join(WORK, run, r.id, "acme-design-tokens");
  const env = { ...process.env, PATH: `${path.join(projDir, "node_modules/.bin")}:${process.env.PATH}` };
  const lines = fs.readFileSync(path.join(dir, "transcripts", `${r.id}.jsonl`), "utf8").split("\n");
  const g = grade({ task: r.task, arm: r.arm, lines, projDir, env, klarBin: path.join(projDir, "node_modules/.bin/klar") });
  const adj = adjudications[`${run}/${r.id}`];
  if (adj) Object.assign(g, { graderPass: g.pass, pass: adj.pass, adjudicated: adj });
  if (g.pass !== r.pass) console.log(`${r.id}: ${r.pass ? "PASS" : "fail"} -> ${g.pass ? "PASS" : "fail"}`);
  out.push({ ...r, ...g, regradedAt: new Date().toISOString() });
}
fs.writeFileSync(path.join(dir, "rows.regraded.jsonl"), out.map((r) => JSON.stringify(r)).join("\n") + "\n");
