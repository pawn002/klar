// Deterministic graders. Each verdict is backed by a signal that can be
// re-derived from the saved transcript. Where a verdict leans on reading the
// agent's prose (a regex over the final answer), the row is marked
// `review: true` so a human spot-check can calibrate it before it counts.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------- transcript parsing ----------

export function parseTranscript(lines) {
  const events = lines.filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const toolUses = [];
  const results = new Map();
  for (const e of events) {
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (e.type === "assistant" && b.type === "tool_use") toolUses.push({ id: b.id, name: b.name, input: b.input ?? {} });
      if (e.type === "user" && b.type === "tool_result") {
        const text = Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : String(b.content ?? "");
        results.set(b.tool_use_id, text);
      }
    }
  }
  const init = events.find((e) => e.type === "system" && e.subtype === "init") ?? {};
  const result = events.find((e) => e.type === "result") ?? {};
  return { events, toolUses, results, init, result, final: result.result ?? "" };
}

const bashCmds = (t) => t.toolUses.filter((u) => u.name === "Bash").map((u) => ({ ...u, cmd: u.input.command ?? "" }));
const klarCmds = (t) => bashCmds(t).filter((u) => /(^|[\s;&|(`$])klar\s/.test(u.cmd));

// ---------- signals common to every task ----------

export function commonSignals(t, arm) {
  const inputs = t.toolUses.map((u) => JSON.stringify(u.input));
  const playbookRead = inputs.some((s) => s.includes("AGENT_PLAYBOOK"));
  const skillFired = t.toolUses.some((u) => u.name === "Skill" && JSON.stringify(u.input).includes("klar"));
  const guidanceLoaded = {
    A0: null,
    A1: playbookRead,
    A2: playbookRead,
    A3: skillFired,
    A4: skillFired && playbookRead,
  }[arm];
  const initSkills = t.init.skills ?? [];
  return {
    klarCalls: klarCmds(t).length,
    playbookRead,
    skillFired,
    guidanceLoaded,
    handRolledMath: bashCmds(t).some((u) => /0\.2126|relative.?luminance|srgb.?to.?linear/i.test(u.cmd)),
    // Anything outside the trial project that could carry klar guidance.
    contaminated:
      inputs.some((s) => /\/home\/user\/klar|skill-vs-playbook\/\.cache/.test(s)) ||
      (!["A3", "A4"].includes(arm) && initSkills.includes("klar")),
    model: t.init.model ?? null,
    claudeCodeVersion: t.init.claude_code_version ?? null,
    costUsdListPrice: t.result.total_cost_usd ?? null,
    turns: t.result.num_turns ?? null,
    durationMs: t.result.duration_ms ?? null,
    usage: t.result.usage
      ? {
          input: t.result.usage.input_tokens,
          cacheRead: t.result.usage.cache_read_input_tokens,
          cacheWrite: t.result.usage.cache_creation_input_tokens,
          output: t.result.usage.output_tokens,
        }
      : null,
    isError: t.result.is_error ?? null,
  };
}

// ---------- helpers ----------

const WHITE = /^#(fff|ffffff)$|^white$/i;
const FAIL_WORDS = /\b(fails?|failing|does ?n[o’']t (pass|meet|work)|do ?n[o’']t (pass|meet|work)|not (meet|pass|sufficient|enough|compliant|accessible)|below|insufficient|falls? short|won[’']t work|no longer (passes|works|meets))\b/i;
const hexesIn = (s) => [...new Set((s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map((h) => h.toLowerCase()))];
const colorArgs = (cmd) => (cmd.match(/#[0-9a-fA-F]{3,8}\b|\bwhite\b|oklch\([^)]*\)/g) ?? []);

function measure(klarBin, fg, bg) {
  const r = spawnSync(klarBin, ["contrast", fg, bg, "-q"], { encoding: "utf8" });
  return r.status === 2 ? null : parseFloat(r.stdout);
}

function near(text, needle, pattern, radius = 160) {
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return false;
  return pattern.test(text.slice(Math.max(0, i - radius), i + needle.length + radius));
}

// ---------- per-task graders ----------

const graders = {
  T1(t) {
    const orders = klarCmds(t).filter((u) => /\bcontrast\b/.test(u.cmd)).map((u) => colorArgs(u.cmd).map((c) => c.toLowerCase()));
    const wrongOrder = orders.some(([a, b]) => a && b && WHITE.test(a) && b === "#0055ff");
    const rightOrder = orders.some(([a, b]) => a === "#0055ff" && b && WHITE.test(b));
    const pass = /\b4\.3\b/.test(t.final) && FAIL_WORDS.test(t.final);
    return { pass, review: true, signals: { wrongOrder, rightOrder, reports43: /\b4\.3\b/.test(t.final) } };
  },

  T2(t, { klarBin }) {
    const offered = hexesIn(t.final).filter((h) => !["#22c55e", "#fff", "#ffffff"].includes(h));
    const measured = Object.fromEntries(offered.map((h) => [h, measure(klarBin, h, "#ffffff")]));
    const passingOffered = offered.some((h) => measured[h] >= 4.5);
    const mentionsClosest = t.final.toLowerCase().includes("00ba54");
    const closestFlagged = mentionsClosest && near(t.final, "00ba54", /2\.2|fail|not enough|doesn|insufficient|closest|only/i);
    const costReported = /delta\s?e|ΔE|perceptual|less saturated|desaturat|chroma|visibly different|brand (shift|cost|change)/i.test(t.final);
    const allowDesat = klarCmds(t).some((u) => u.cmd.includes("--allow-desaturation"));
    const pass = passingOffered && costReported && (!mentionsClosest || closestFlagged);
    return { pass, review: true, signals: { offered: measured, passingOffered, mentionsClosest, closestFlagged, costReported, allowDesat } };
  },

  T4(t, { projDir, env }) {
    const script = path.join(projDir, "audit.sh");
    if (!fs.existsSync(script)) return { pass: false, review: false, signals: { scriptExists: false } };
    const r = spawnSync("bash", [script], { cwd: projDir, env, encoding: "utf8", timeout: 120000 });
    const out = `${r.stdout}\n${r.stderr}`;
    const tokens = ["text-primary", "text-muted", "brand", "success", "danger", "accent"];
    const reported = tokens.filter((k) => new RegExp(`\\b${k}\\b`).test(r.stdout));
    const lineFor = (k) => out.split("\n").filter((l) => new RegExp(`\\b${k}\\b`).test(l)).join("\n");
    const gamutFlag = /gamut|srgb|mapped|out.of.range/i;
    const flagged = ["success", "danger"].filter((k) => gamutFlag.test(lineFor(k)));
    const usesSetE = /set -[a-z]*e/.test(fs.readFileSync(script, "utf8"));
    const pass = usesSetE && reported.length === tokens.length && flagged.length === 2;
    return {
      pass,
      review: false,
      signals: { scriptExists: true, usesSetE, exitCode: r.status, reported, gamutFlagged: flagged, stdoutTail: r.stdout.slice(-1500) },
    };
  },

  T6(t) {
    const matchCall = klarCmds(t).find((u) => /\bmatch\b/.test(u.cmd));
    let matched = null;
    if (matchCall) {
      const raw = t.results.get(matchCall.id) ?? "";
      try { matched = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).colors?.map((c) => c.toLowerCase()); } catch {}
      if (!matched) matched = hexesIn(raw);
    }
    const idx = matchCall ? t.toolUses.indexOf(t.toolUses.find((u) => u.id === matchCall.id)) : -1;
    const reverified =
      !!matched &&
      t.toolUses.slice(idx + 1).some((u) => u.name === "Bash" && /\bcontrast\b/.test(u.input.command ?? "") && matched.some((m) => (u.input.command ?? "").toLowerCase().includes(m)));
    const reportsMatched = !!matched?.length && matched.every((m) => t.final.toLowerCase().includes(m));
    const reportsFailure = FAIL_WORDS.test(t.final);
    const pass = reportsMatched && reverified && reportsFailure;
    return { pass, review: true, signals: { matchRan: !!matchCall, matched, reportsMatched, reverified, reportsFailure } };
  },

  T7(t) {
    const ranDeltaE = klarCmds(t).some((u) => /--type\s+deltae/i.test(u.cmd));
    const mentionsDeltaE = /delta\s?e|ΔE|CIEDE/i.test(t.final);
    const reports13 = /\b13(\.\d)?\b/.test(t.final);
    const pass = (ranDeltaE || mentionsDeltaE) && reports13;
    return { pass, review: true, signals: { ranDeltaE, mentionsDeltaE, reports13 } };
  },
};

export function grade({ task, arm, lines, projDir, env, klarBin }) {
  const t = parseTranscript(lines);
  const g = graders[task](t, { projDir, env, klarBin });
  return { ...g, common: commonSignals(t, arm), final: t.final };
}
