import { Command } from 'commander';
import { getServices } from '../services';
import type { PluginLoadRecord } from '../services';
import { output, OutputOptions } from '../utils/output';
import { PLUGIN_DOCS_URL } from '../constants';

export function pluginsCommand(): Command {
  const cmd = new Command('plugins')
    .description('List registered contrast algorithm plugins')
    .addCommand(listSubcommand());
  return cmd;
}

function listSubcommand(): Command {
  return new Command('list')
    .description('Print all registered plugins')
    .option('--json', 'Output as JSON', false)
    .option('-q, --quiet', 'Print only plugin ids, one per line', false)
    .action((opts: { json: boolean; quiet: boolean }) => {
      const { pluginRegistry, pluginProvenance } = getServices();
      const plugins = pluginRegistry.list();
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      // id -> where it came from, for showing source/version/path.
      const provById = new Map<string, PluginLoadRecord>();
      for (const rec of pluginProvenance) {
        for (const id of rec.ids) provById.set(id, rec);
      }

      if (opts.quiet) {
        output({ quietValue: plugins.map((p) => p.id).join('\n') }, outputOpts);
        return;
      }

      if (opts.json) {
        output(
          plugins.map((p) => {
            const rec = provById.get(p.id);
            return {
              id: p.id,
              displayName: p.displayName,
              description: p.description,
              source: rec?.source ?? null,
              packageName: rec?.packageName ?? null,
              version: rec?.version ?? null,
              resolvedPath: rec?.resolvedPath ?? null,
            };
          }),
          outputOpts,
        );
        return;
      }

      if (plugins.length === 0) {
        output(
          `No contrast-algorithm plugins installed.\nSee ${PLUGIN_DOCS_URL} for available plugins.`,
          outputOpts,
        );
        return;
      }

      const lines: string[] = [`Registered plugins (${plugins.length}):`];
      for (const p of plugins) {
        const rec = provById.get(p.id);
        const tag = rec ? ` [${rec.source}${rec.version ? ` v${rec.version}` : ''}]` : '';
        lines.push(`  ${p.id.padEnd(16)} ${p.displayName}${tag}`);
        lines.push(`               ${p.description}`);
        if (rec) lines.push(`               from ${rec.packageName} — ${rec.resolvedPath}`);
      }

      const external = pluginProvenance.filter((r) => r.source === 'global');
      if (external.length > 0) {
        const names = external.map((r) => r.packageName).join(', ');
        lines.push(
          '',
          `Note: ${external.length} plugin package(s) loaded from outside this project: ${names}.`,
          `Installing a plugin runs its code on every klar invocation. Review what you trust;`,
          `lock it down with KLAR_PLUGINS / package.json "klar.plugins", or --no-plugins. See SECURITY.md.`,
        );
      }

      output(lines.join('\n'), outputOpts);
    });
}
