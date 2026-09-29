#!/usr/bin/env node
// Human calibration of the Opus judge ("calibrated or not trusted").
//
//   node calibrate.mjs sheet  <key-out.json>   writes review/calibration-1.md (blind) and a key
//   node calibrate.mjs score  <key.json> "S1 P, S2 F, ..."   scores the judge against the labels
//
// The sheet shows task, rule, measured facts and the answer. It hides the
// arm, the grader's verdict and the judge's verdict. Sample: every row where
// the judge's verdict became final by overriding the grader (the calls the
// judge alone decided), plus one seeded-random agreed row per task.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RULES, facts } from "./judge.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [mode, keyPath, labels] = process.argv.slice(2);
const suite = JSON.parse(fs.readFileSync(path.join(HERE, "tasks/tasks.json"), "utf8"));

const judged = fs.readdirSync(path.join(HERE, "review")).filter((f) => /^judge-opus.*\.jsonl$/.test(f))
  .flatMap((f) => fs.readFileSync(path.join(HERE, "review", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const adjudications = JSON.parse(fs.readFileSync(path.join(HERE, "review/adjudications.json"), "utf8"));
const rowOf = (j) => fs.readFileSync(path.join(HERE, "results", j.run, "rows.regraded.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === j.id);

if (mode === "sheet") {
  const decisive = judged.filter((j) => adjudications[`${j.run}/${j.id}`] && j.judge !== j.grader);
  // Seeded, reproducible pick: order by a hash of run/id, take the first agreed row per task.
  const h = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const agreed = judged.filter((j) => j.judge === j.grader).sort((a, b) => h(a.run + a.id) - h(b.run + b.id));
  const perTask = [...new Set(agreed.map((j) => j.task))].sort().map((t) => agreed.find((j) => j.task === t));
  const items = [...decisive, ...perTask].sort((a, b) => h(b.id + b.run) - h(a.id + a.run));
  const key = {};
  let md = "# Judge calibration: blind human labels\n\nFor each item, read the task, the rule, the measured facts and the agent's answer, and label it **P** (meets the rule) or **F** (doesn't). Arm, grader verdict and judge verdict are hidden. Reply with one line: `C1 P, C2 F, …`. A note on any rule you think is wrong is as useful as a label.\n\n";
  items.forEach((j, i) => {
    const r = rowOf(j);
    const C = `C${i + 1}`;
    key[C] = { run: j.run, id: j.id, task: j.task, judge: j.judge, grader: j.grader, decisive: decisive.includes(j) };
    const t = suite.tasks[j.task];
    const promptText = (t.okca ? suite.okcaStandard + " " : "") + t.prompt;
    const f = facts(r);
    const answer = r.final.length > 2500 ? r.final.slice(0, 2500) + " …[trimmed]" : r.final;
    md += `---\n\n## ${C} (${j.task})\n\n**Task:** ${promptText}\n\n**Rule:** ${RULES[j.task]}\n\n${f ? `**Measured facts:** ${f}\n\n` : ""}**Agent's answer:**\n\n${answer.split("\n").map((l) => "> " + l).join("\n")}\n\n**Your label:** \n\n`;
  });
  fs.writeFileSync(path.join(HERE, "review/calibration-1.md"), md);
  fs.writeFileSync(keyPath, JSON.stringify(key, null, 2) + "\n");
  console.log(`${items.length} items (${decisive.length} decisive, ${perTask.length} agreed); key -> ${keyPath}`);
}

if (mode === "score") {
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const human = Object.fromEntries([...labels.matchAll(/C(\d+)\s*[:=]?\s*([PF])/gi)].map((m) => [`C${m[1]}`, m[2].toUpperCase() === "P" ? "PASS" : "FAIL"]));
  const rows = Object.entries(key).filter(([c]) => human[c]).map(([c, k]) => ({ c, ...k, human: human[c] }));
  const agree = (xs, who) => `${xs.filter((x) => x[who] === x.human).length}/${xs.length}`;
  console.log(`labelled ${rows.length}/${Object.keys(key).length}`);
  console.log(`judge vs human:  all ${agree(rows, "judge")}; decisive ${agree(rows.filter((r) => r.decisive), "judge")}; agreed-sample ${agree(rows.filter((r) => !r.decisive), "judge")}`);
  console.log(`grader vs human: all ${agree(rows, "grader")}`);
  for (const r of rows.filter((r) => r.judge !== r.human)) console.log(`judge≠human ${r.c} ${r.run} ${r.id}: judge ${r.judge}, human ${r.human}`);
}
