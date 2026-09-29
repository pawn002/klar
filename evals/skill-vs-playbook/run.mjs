#!/usr/bin/env node
// Trial runner. One trial = one fresh project + one fresh Claude Code config
// dir + one headless `claude -p` run. Trials are isolated from each other and
// from the host's user-level setup; see ISOLATION below.
//
//   node run.mjs --arms A0,A1,A3 --tasks T1,T2 --model haiku --n 1 --parallel 3 --run smoke
//
// Phrasing: `auto` (default) gives A0 the explicit prompt and every other arm
// the implicit one. A0 with no guidance and no tool named is degenerate: the
// agent has no way to know klar exists.

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeArm } from "./arms.mjs";
import { grade } from "./grade.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARBALL = path.join(HERE, ".cache/klar-cli-3.0.0.tgz");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const arms = (args.arms ?? "A0,A1,A3").split(",");
const taskIds = (args.tasks ?? "T1,T2,T4,T6,T7").split(",");
const model = args.model ?? "haiku";
const n = Number(args.n ?? 1);
const parallel = Number(args.parallel ?? 3);
const phrasing = args.phrasing ?? "auto";
const runName = args.run ?? new Date().toISOString().replace(/[:.]/g, "-");
const maxTurns = args["max-turns"] ?? "30";
// Outside the klar repo on purpose: a trial must not be able to walk up to the real playbook.
const WORK = args.work ?? path.join(os.tmpdir(), "klar-eval");

const suite = JSON.parse(fs.readFileSync(path.join(HERE, "tasks/tasks.json"), "utf8"));
const resultsDir = path.join(HERE, "results", runName);
fs.mkdirSync(path.join(resultsDir, "transcripts"), { recursive: true });

// ---------- one-time template: klar installed from the pinned tarball ----------

const template = path.join(WORK, "template");
if (!fs.existsSync(path.join(template, "node_modules/.bin/klar"))) {
  fs.mkdirSync(template, { recursive: true });
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--silent", TARBALL], { cwd: template, stdio: "inherit" });
}
const playbook = fs.readFileSync(path.join(template, "node_modules/klar-cli/AGENT_PLAYBOOK.md"), "utf8");
const klarVersion = JSON.parse(fs.readFileSync(path.join(template, "node_modules/klar-cli/package.json"), "utf8")).version;

// ---------- ISOLATION ----------
// Strip variables that would load the host session's instructions, skills,
// artifacts or messaging into a trial. Auth/proxy variables stay.
const SCRUB = [
  /^CLAUDECODE$/, /^CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD$/, /^CLAUDE_ADDITIONAL_DIRECTORIES$/,
  /^CLAUDE_CODE_SESSION_ID$/, /^CLAUDE_CODE_CHILD_SESSION$/, /^CLAUDE_CODE_SYNC_/, /^CLAUDE_CODE_MESSAGING_/,
  /^CLAUDE_CODE_ARTIFACT/, /^DOCUMENTS_MCP_/, /^CLAUDE_AFTER_LAST_COMPACT$/, /^CLAUDE_PID$/, /^CLAUDE_EFFORT$/,
  /^CLAUDE_CODE_TEE_SDK_STDOUT$/, /^CLAUDE_CODE_DIAGNOSTICS_FILE$/, /^CLAUDE_CODE_DEBUG$/, /^CLAUDE_AUTO_BACKGROUND_TASKS$/,
  /^CLAUDE_CODE_BG_TASKS_REPORT_RUNNING$/, /^AI_AGENT$/,
];
function trialEnv(projDir, cfgDir) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !SCRUB.some((re) => re.test(k))));
  env.CLAUDE_CONFIG_DIR = cfgDir;
  env.PATH = `${path.join(projDir, "node_modules/.bin")}:${env.PATH}`;
  return env;
}

function sh(cmd, argv, cwd) {
  execFileSync(cmd, argv, { cwd, stdio: "ignore" });
}

function setupTrial(id, arm) {
  const root = path.join(WORK, runName, id);
  const projDir = path.join(root, "acme-design-tokens");
  const cfgDir = path.join(root, "claude-config");
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(projDir, { recursive: true });
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.cpSync(path.join(HERE, "fixtures"), projDir, { recursive: true });
  fs.cpSync(path.join(template, "node_modules"), path.join(projDir, "node_modules"), { recursive: true, verbatimSymlinks: true });
  fs.writeFileSync(path.join(projDir, ".gitignore"), "node_modules/\n");
  writeArm(arm, playbook, projDir);
  sh("git", ["init", "-q"], projDir);
  sh("git", ["add", "-A"], projDir);
  sh("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.invalid", "commit", "-qm", "init"], projDir);
  return { projDir, cfgDir };
}

function runTrial({ id, arm, task, phr }) {
  const { projDir, cfgDir } = setupTrial(id, arm);
  const prompt = (phr === "explicit" ? suite.explicitPrefix : "") + suite.tasks[task].prompt;
  const env = trialEnv(projDir, cfgDir);
  const transcript = path.join(resultsDir, "transcripts", `${id}.jsonl`);
  const out = fs.openSync(transcript, "w");
  const argv = [
    "-p", prompt, "--model", model, "--output-format", "stream-json", "--verbose",
    // dontAsk + an allowlist: bypassPermissions is refused when running as root.
    "--permission-mode", "dontAsk", "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep,Skill",
    "--permission-prompts", "none", "--max-turns", maxTurns,
  ];
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("claude", argv, { cwd: projDir, env, stdio: ["ignore", out, "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    const killer = setTimeout(() => child.kill("SIGINT"), 15 * 60 * 1000);
    child.on("close", (code) => {
      clearTimeout(killer);
      fs.closeSync(out);
      const lines = fs.readFileSync(transcript, "utf8").split("\n");
      let graded;
      try {
        graded = grade({ task, arm, lines, projDir, env, klarBin: path.join(projDir, "node_modules/.bin/klar") });
      } catch (e) {
        graded = { pass: false, error: String(e) };
      }
      const row = {
        id, run: runName, arm, task, phrasing: phr, model, klarVersion, taskSuite: suite.version,
        status: lines.some((l) => l.includes('"type":"result"')) ? "ok" : "infra-error",
        exitCode: code, wallMs: Date.now() - started, stderr: stderr.slice(-500) || undefined, ...graded,
      };
      fs.appendFileSync(path.join(resultsDir, "rows.jsonl"), JSON.stringify(row) + "\n");
      console.log(`${id}  ${row.status === "ok" ? (row.pass ? "PASS" : "fail") : row.status}  loaded=${row.common?.guidanceLoaded}  klar=${row.common?.klarCalls}  $${row.common?.costUsdListPrice?.toFixed?.(3)}`);
      resolve(row);
    });
  });
}

// ---------- schedule ----------

const queue = [];
for (const arm of arms)
  for (const task of taskIds)
    for (let i = 0; i < n; i++) {
      const phr = phrasing === "auto" ? (arm === "A0" ? "explicit" : "implicit") : phrasing;
      queue.push({ id: `${arm}-${task}-${phr}-${model}-${i}`, arm, task, phr });
    }

console.log(`run ${runName}: ${queue.length} trials, klar ${klarVersion}, model ${model}, parallel ${parallel}`);
const workers = Array.from({ length: Math.min(parallel, queue.length) }, async () => {
  while (queue.length) await runTrial(queue.shift());
});
await Promise.all(workers);
