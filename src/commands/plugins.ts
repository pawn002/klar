import { Command } from 'commander';
import { getServices } from '../services';
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
      const { pluginRegistry } = getServices();
      const plugins = pluginRegistry.list();
      const outputOpts: OutputOptions = { json: opts.json, quiet: opts.quiet };

      if (opts.quiet) {
        output({ quietValue: plugins.map((p) => p.id).join('\n') }, outputOpts);
        return;
      }

      if (opts.json) {
        output(
          plugins.map((p) => ({ id: p.id, displayName: p.displayName, description: p.description })),
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
        lines.push(`  ${p.id.padEnd(12)} ${p.displayName}`);
        lines.push(`               ${p.description}`);
      }
      output(lines.join('\n'), outputOpts);
    });
}
