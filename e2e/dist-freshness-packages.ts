/**
 * The table of packages whose built output a demo resolves, and the filesystem
 * primitives the freshness guard measures them with.
 *
 * Split out of `dist-freshness.ts` purely for size; the guard itself is the
 * only consumer. See that module for why any of this matters.
 *
 * @module e2e/dist-freshness-packages
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** A package whose built output at least one demo (or the fixtures) resolves. */
export interface DistPackage {
	/** Workspace directory under `packages/`. */
	dir: string;
	/** npm name, for the build command in the failure message. */
	name: string;
	/** A file that must exist and be newer than the package's newest source. */
	artifact: string;
	/** Who reads it, so the message says why it matters. */
	consumers: string;
	/**
	 * Source subpaths to ignore because they are GENERATED, not authored. They
	 * are rewritten by unrelated commands (`typecheck` re-runs Angular's
	 * shared-source inliner), so counting them would report staleness that a
	 * rebuild cannot clear.
	 */
	generated?: readonly string[];
}

export const DIST_PACKAGES: readonly DistPackage[] = [
	{
		dir: 'core',
		name: 'pptx-viewer-core',
		artifact: 'dist/index.mjs',
		consumers: 'the Angular demo and the e2e fixture generators',
	},
	{
		dir: 'shared',
		name: 'pptx-viewer-shared',
		artifact: 'dist/index.mjs',
		consumers: 'the React demo',
	},
	{
		dir: 'locales',
		name: 'pptx-viewer-locales',
		artifact: 'dist/index.js',
		consumers: 'the Angular demo',
	},
	{
		dir: 'tools',
		name: 'pptx-viewer-mcp',
		artifact: 'dist/index.js',
		consumers: 'all five demos, through the shared MCP registry',
	},
	{
		dir: 'angular',
		name: 'pptx-angular-viewer',
		artifact: 'dist/fesm2022/pptx-angular-viewer.mjs',
		consumers: 'the Angular demo',
		// Written by `scripts/inline-shared.mjs` on every build AND typecheck;
		// shared's own freshness is already checked through its own entry.
		generated: ['internal/shared-src', 'internal/version.ts'],
	},
];

/**
 * Vite pre-bundles `pptx-viewer-core` for the Angular demo (it is in that
 * demo's `optimizeDeps.include`). Rebuilding core does NOT invalidate the
 * pre-bundle, so this is a second, independent staleness axis.
 */
export const ANGULAR_CORE_PREBUNDLE =
	'demos/demo-angular/node_modules/.vite/deps/pptx-viewer-core.js';

/**
 * Colocated test files, which no package's build has as an entry point.
 *
 * Editing one can never make `dist` stale, but they live under `src` beside
 * the modules they cover, so counting them made the guard fire on a test edit
 * and demand a rebuild that would change nothing. That is not a harmless false
 * positive: it trains you to re-run builds until the guard goes quiet, which is
 * exactly the habit it exists to replace.
 */
const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/u;

/** Newest mtime (ms) under `dir`, ignoring build output, deps, tests and `skip`. */
export function newestMtime(dir: string, skip: ReadonlySet<string> = new Set()): number {
	let newest = 0;
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
			continue;
		}
		const full = join(dir, entry.name);
		if (skip.has(full)) {
			continue;
		}
		if (entry.isFile() && TEST_FILE.test(entry.name)) {
			continue;
		}
		if (entry.isDirectory()) {
			newest = Math.max(newest, newestMtime(full, skip));
			continue;
		}
		try {
			newest = Math.max(newest, statSync(full).mtimeMs);
		} catch {
			// Racing with a writer: skip.
		}
	}
	return newest;
}

/** mtime (ms) of a single file, or 0 when it does not exist. */
export function mtimeOf(path: string): number {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return 0;
	}
}
