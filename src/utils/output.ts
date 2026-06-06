export interface OutputOptions {
  json: boolean;
  quiet: boolean;
}

export function output(data: unknown, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else if (opts.quiet && typeof data === 'object' && data !== null) {
    // Quiet mode: print just the primary value
    // Caller should set a 'quietValue' property or we fall back to JSON
    const obj = data as Record<string, unknown>;
    if ('quietValue' in obj) {
      process.stdout.write(String(obj.quietValue) + '\n');
    } else {
      process.stdout.write(JSON.stringify(data) + '\n');
    }
  } else if (typeof data === 'string') {
    process.stdout.write(data + '\n');
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
}

/**
 * Exit-code contract (grep-style):
 *   0 — success: the operation produced a satisfying result
 *   1 — soft failure: a valid operation whose answer is negative
 *       (e.g. `find` target unachievable, `match` infeasible). The payload is
 *       still written to stdout so consumers can inspect the closest result.
 *   2 — usage error: invalid input or arguments (handled by `errorOut`).
 */

/** Usage / input error: write `Error:` to stderr and exit 2. */
export function errorOut(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(2);
}

/**
 * Mark a soft failure (valid operation, negative result): exit code 1.
 * Uses `process.exitCode` rather than `process.exit()` so already-written
 * stdout payload still flushes. Optionally writes an explanatory note to
 * stderr — kept off stdout so the data channel stays clean for piping.
 */
export function markFailure(note?: string): void {
  if (note) process.stderr.write(`${note}\n`);
  process.exitCode = 1;
}
