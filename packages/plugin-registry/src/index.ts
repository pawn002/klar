import type { ContrastPlugin } from '@pawn002/klar-plugin-interface';

/**
 * Runtime registry of contrast algorithm plugins keyed by their `id`.
 *
 * This is a plain TypeScript class with no framework dependency, so it can be
 * used as-is in the CLI and wrapped as a NestJS provider in the backend.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, ContrastPlugin>();

  /**
   * Register a plugin. Later registrations with the same `id` overwrite
   * earlier ones, allowing callers to override built-in defaults.
   */
  register(plugin: ContrastPlugin): this {
    this.plugins.set(plugin.id, plugin);
    return this;
  }

  /** Retrieve a plugin by its `id`, or `undefined` if not registered. */
  get(id: string): ContrastPlugin | undefined {
    return this.plugins.get(id);
  }

  /** Returns `true` when a plugin with the given `id` is registered. */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /** All registered plugins in insertion order. */
  list(): ContrastPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** IDs of all registered plugins in insertion order. */
  ids(): string[] {
    return Array.from(this.plugins.keys());
  }
}

export type { ContrastPlugin } from '@pawn002/klar-plugin-interface';
