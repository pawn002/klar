// Arm definitions. Every arm's guidance text is extracted from the pinned
// AGENT_PLAYBOOK.md at run time, so "same content" is enforced by code rather
// than by copy-paste. The skill description is the one authored string: it is
// the variable a skill adds, and it is fixed here before the first trial.

import fs from "node:fs";
import path from "node:path";

export const SKILL_DESCRIPTION =
  "Color accessibility work with the klar CLI: checking contrast (OKCA / WCAG), " +
  "making a color pass on a background, building palettes and dark-mode variants, " +
  "auditing design tokens, and measuring perceptual drift (deltaE). Use whenever " +
  "checking, choosing, or adjusting colors.";

// Pull the fenced ```markdown block that follows a given heading.
function snippetAfter(playbook, heading) {
  const start = playbook.indexOf(heading);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const m = playbook.slice(start).match(/```markdown\n([\s\S]*?)\n```\n/);
  if (!m) throw new Error(`no markdown block after: ${heading}`);
  return m[1] + "\n";
}

function skill(body) {
  return `---\nname: klar\ndescription: ${SKILL_DESCRIPTION}\n---\n\n${body}`;
}

// Returns { relativePath: contents } for the files an arm adds to the project.
export function armFiles(arm, playbook) {
  switch (arm) {
    case "A0": // bare
      return {};
    case "A1": // playbook-pointer
      return { "CLAUDE.md": snippetAfter(playbook, "### Minimal snippet") };
    case "A2": // playbook-full
      return { "CLAUDE.md": snippetAfter(playbook, "### Full snippet (recommended)") };
    case "A3": // skill-verbatim
      return { ".claude/skills/klar/SKILL.md": skill(playbook) };
    case "A4": // skill-pointer
      return {
        ".claude/skills/klar/SKILL.md": skill(
          "Before running any klar command, read the klar agent playbook: " +
            "`node_modules/klar-cli/AGENT_PLAYBOOK.md`. It documents the traps " +
            "(argument order, exit codes, gamut) that decide whether an answer is correct.\n",
        ),
      };
    case "A5": // shipped skill: written by `klar skill install` in run.mjs, not here
      return {};
    default:
      throw new Error(`unknown arm ${arm}`);
  }
}

export function writeArm(arm, playbook, projDir) {
  for (const [rel, text] of Object.entries(armFiles(arm, playbook))) {
    const p = path.join(projDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
}
