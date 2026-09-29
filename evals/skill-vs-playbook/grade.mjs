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
  // The final answer can span a closing tool call: agents often state the
  // answer, run one more command, then add a closing note. The user sees both,
  // so the answer starts at the last text block before the final tool call.
  const blocks = events.filter((e) => e.type === "assistant").flatMap((e) => e.message?.content ?? [])
    .filter((b) => b.type === "text" || b.type === "tool_use");
  const lastTool = blocks.map((b) => b.type).lastIndexOf("tool_use");
  let start = lastTool + 1;
  for (let i = lastTool - 1; i >= 0 && blocks[i].type === "text"; i--) start = i;
  const tail = blocks.slice(start).filter((b) => b.type === "text").map((b) => b.text).join("\n\n");
  return { events, toolUses, results, init, result, final: tail || result.result || "" };
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
const FAIL_WORDS = /\b(fails?|failing|(does|do) ?n[o’']t (quite |fully )?(pass|meet|work|clear|reach)|just short|not (meet|pass|sufficient|enough|compliant|accessible)|below|insufficient|falls? short|won[’']t (work|pass|meet)|\d(\.\d+)? points? short|no longer (passes|works|meets))\b/i;
const hexesIn = (s) => [...new Set((s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map((h) => h.toLowerCase()))];
const colorArgs = (cmd) => (cmd.match(/#[0-9a-fA-F]{3,8}\b|\bwhite\b|oklch\([^)]*\)/g) ?? []);

function measure(klarBin, fg, bg, type) {
  const r = spawnSync(klarBin, ["contrast", fg, bg, "-q", ...(type ? ["--type", type] : [])], { encoding: "utf8" });
  return r.status === 2 ? null : parseFloat(r.stdout);
}

// WCAG 2.x ratio computed exactly. klar rounds wcag2 to one decimal before
// comparing (#068a3d: true 4.458 displays and passes as 4.5), and WCAG 2's
// threshold is unrounded, so the grader must not trust klar's wcag2 figure.
function wcag2Exact(hexA, hexB) {
  const lum = (h) => {
    h = h.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function near(text, needle, pattern, radius = 160) {
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return false;
  return pattern.test(text.slice(Math.max(0, i - radius), i + needle.length + radius));
}

// ---------- per-task graders ----------

const graders = {
  T1(t) {
    // Algorithm-consistent scoring (decided 2026-09-29, see DESIGN changelog):
    // an agent that chooses --type wcag2 and says "passes, 5.6" is correct under
    // WCAG 2.x. What T1 tests is polarity, which only exists for OKCA.
    // Parse each `klar contrast` invocation on its own: agents chain commands
    // (`klar find BG FG … && klar contrast "$(…)"`), and `find` takes the
    // background first by design.
    const pair = klarCmds(t)
      // Command substitutions are values, not arguments: `$(klar find BG FG)` is one color.
      .flatMap((u) => [...u.cmd.replace(/\$\([^()]*\)/g, "SUBST").matchAll(/klar\s+contrast\s+([^|;&]*)/g)].map((m) => m[1]))
      .map((seg) => ({ args: colorArgs(seg).map((c) => c.toLowerCase()), wcag2: /(--type|-t)\s+wcag2/i.test(seg) }))
      .filter(({ args }) => args.includes("#0055ff") && args.some((a) => WHITE.test(a)));
    const okcaCmds = pair.filter((c) => !c.wcag2);
    const wrongOrder = okcaCmds.some(({ args: [a, b] }) => WHITE.test(a) && b === "#0055ff");
    const rightOrder = okcaCmds.some(({ args: [a, b] }) => a === "#0055ff" && WHITE.test(b));
    const ranWcag2 = pair.some((c) => c.wcag2);
    const reports43 = /\b4\.3\b/.test(t.final);
    const reports56 = /\b5\.6\b/.test(t.final);
    const okcaOk = reports43 && rightOrder && FAIL_WORDS.test(t.final);
    const wcag2Ok = reports56 && !reports43 && ranWcag2 && /\b(pass(es)?|meets?|yes)\b/i.test(t.final) && !FAIL_WORDS.test(t.final);
    const pass = !wrongOrder && (okcaOk || wcag2Ok);
    return { pass, review: true, signals: { algorithm: okcaOk ? "okca" : wcag2Ok ? "wcag2" : ranWcag2 ? "wcag2?" : "okca?", wrongOrder, rightOrder, reports43, reports56 } };
  },

  T2(t, { klarBin }) {
    // Algorithm-consistent, like T1: offered colors are measured with every
    // algorithm the agent actually used, and pass if they clear 4.5 under it.
    const usedWcag2 = klarCmds(t).some((u) => /(--type|-t)\s+wcag2/i.test(u.cmd));
    const usedOkca = klarCmds(t).some((u) => /\b(contrast|find)\b/.test(u.cmd) && !/(--type|-t)\s+wcag2/i.test(u.cmd));
    const offered = hexesIn(t.final).filter((h) => !["#22c55e", "#fff", "#ffffff"].includes(h));
    const measured = Object.fromEntries(offered.map((h) => [h, {
      okca: measure(klarBin, h, "#ffffff"),
      wcag2: Number(wcag2Exact(h, "#ffffff").toFixed(3)),
    }]));
    const clears = (h) => (usedOkca && measured[h].okca >= 4.5) || (usedWcag2 && measured[h].wcag2 >= 4.5);
    const passingOffered = offered.some(clears);
    const mentionsClosest = t.final.toLowerCase().includes("00ba54");
    const closestFlagged = mentionsClosest && near(t.final, "00ba54", /2\.2|fail|not enough|doesn|insufficient|closest|only/i);
    // The rule asks how much the fix costs the brand color, so the cost must
    // be quantified: a deltaE figure, or a number beside a shift word.
    const costReported =
      /\d+(\.\d+)?\s*(ΔE|delta\s?e)|(ΔE|delta\s?e)\D{0,20}\d/i.test(t.final) ||
      /\d+(\.\d+)?\s*%?\s*(darker|lighter|less saturated|more saturated|desaturat)/i.test(t.final) ||
      /(chroma|lightness)[^\n]{0,40}\d(\.\d+)?[^\n]{0,30}(from|→|->|\bto\b)\s*\d/i.test(t.final);
    const allowDesat = klarCmds(t).some((u) => u.cmd.includes("--allow-desaturation"));
    const pass = passingOffered && costReported && (!mentionsClosest || closestFlagged);
    return { pass, review: true, signals: { algorithms: { okca: usedOkca, wcag2: usedWcag2 }, offered: measured, passingOffered, mentionsClosest, closestFlagged, costReported, allowDesat } };
  },

  T4(t, { projDir, env }) {
    const script = path.join(projDir, "audit.sh");
    if (!fs.existsSync(script)) return { pass: false, review: false, signals: { scriptExists: false } };
    const r = spawnSync("bash", [script], { cwd: projDir, env, encoding: "utf8", timeout: 120000 });
    const out = `${r.stdout}\n${r.stderr}`;
    const tokens = ["text-primary", "text-muted", "brand", "success", "danger", "accent"];
    const reported = tokens.filter((k) => new RegExp(`\\b${k}\\b`).test(r.stdout));
    // A token's block runs from its line to the next token's line, so a klar
    // warning printed on the following line still counts as that token's flag.
    const outLines = out.split("\n");
    const isTokenLine = (l) => tokens.some((k) => new RegExp(`\\b${k}\\b`).test(l));
    const lineFor = (k) => {
      const blocks = [];
      outLines.forEach((l, i) => {
        if (!new RegExp(`\\b${k}\\b`).test(l)) return;
        let j = i + 1;
        while (j < outLines.length && !isTokenLine(outLines[j])) j++;
        blocks.push(outLines.slice(i, j).join("\n"));
      });
      return blocks.join("\n");
    };
    // ERROR / N/A count: they mark the token as not cleanly measured (round 2).
    const gamutFlag = /gamut|srgb|mapped|out.of.range|\berror\b|n\/a/i;
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
    // An agent may run exploratory `match` calls first. Grade against the call
    // whose output the answer actually reports; fall back to the last one.
    const parse = (u) => {
      const raw = t.results.get(u.id) ?? "";
      try { return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).colors?.map((c) => c.toLowerCase()); } catch { return hexesIn(raw); }
    };
    const calls = klarCmds(t).filter((u) => /\bmatch\b/.test(u.cmd)).map((u) => ({ u, colors: parse(u) ?? [] }));
    const lower = t.final.toLowerCase();
    const chosen = calls.find((c) => c.colors.length && c.colors.every((m) => lower.includes(m))) ?? calls.at(-1);
    const matched = chosen?.colors ?? null;
    const idx = chosen ? t.toolUses.findIndex((u) => u.id === chosen.u.id) : -1;
    const reverified =
      !!matched?.length &&
      t.toolUses.slice(idx + 1).some((u) => u.name === "Bash" && /\bcontrast\b/.test(u.input.command ?? "") && matched.some((m) => (u.input.command ?? "").toLowerCase().includes(m)));
    const reportsMatched = !!matched?.length && matched.every((m) => lower.includes(m));
    const reportsFailure = FAIL_WORDS.test(t.final) || /\bmiss(es|ed)?\b|\bshort\b|❌|neither/i.test(t.final);
    const pass = reportsMatched && reverified && reportsFailure;
    return { pass, review: true, signals: { matchCalls: calls.length, matched, reportsMatched, reverified, reportsFailure } };
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
