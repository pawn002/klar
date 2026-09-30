import path from 'path';

/**
 * Root of the installed klar-cli package. Compiled files live in
 * `dist/<dir>/`, sources in `src/<dir>/`, so the root is two levels up
 * either way. This holds for every install method (local dependency,
 * `npm install -g`, `npx`), because the files travel inside the package.
 */
export const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

/** The agent playbook shipped in the package (`files` in package.json). */
export const PLAYBOOK_PATH = path.join(PACKAGE_ROOT, 'AGENT_PLAYBOOK.md');

/** The Agent Skill shipped in the package (`files` in package.json). */
export const SKILL_PATH = path.join(PACKAGE_ROOT, 'skills', 'klar', 'SKILL.md');
