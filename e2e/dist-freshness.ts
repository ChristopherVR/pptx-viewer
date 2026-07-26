/**
 * Preflight: refuse to run e2e against stale built output.
 *
 * Four of the five demos alias the workspace packages straight to source, so a
 * long-running dev server picks edits up through HMR. The rest resolve through
 * the packages' `exports` to `dist`, which nothing watches and nothing rebuilds:
 *
 *  - the Angular demo reads `packages/angular/dist` (ng-packagr), plus
 *    `packages/core/dist` and `packages/locales/dist`,
 *  - the React demo reads `packages/shared/dist`,
 *  - every demo reaches `packages/tools/dist` through the shared MCP registry,
 *  - and the fixture generators import `pptx-viewer-core` under plain Node.
 *
 * Running the suite after editing one of those without rebuilding tests the OLD
 * code. That is not merely a nuisance: it can report a **spurious pass**, which
 * is far worse than the confusing failure it usually produces. (It has done
 * both: a real run once reported 5 Angular failures that were entirely a stale
 * `packages/core/dist` pre-bundle.)
 *
 * CI is unaffected - it downloads the build job's artifacts, so every dist is
 * newer than the checkout - and this check passes there for the same reason.
 *
 * @module e2e/dist-freshness
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** A package whose built output at least one demo (or the fixtures) resolves. */
interface DistPackage {
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

const DIST_PACKAGES: readonly DistPackage[] = [
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
const ANGULAR_CORE_PREBUNDLE = 'demos/demo-angular/node_modules/.vite/deps/pptx-viewer-core.js';

/** Newest mtime (ms) under `dir`, ignoring build output, deps and `skip`. */
function newestMtime(dir: string, skip: ReadonlySet<string> = new Set()): number {
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
function mtimeOf(path: string): number {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return 0;
	}
}

/**
 * Throw when any dist a demo resolves through is missing or older than its
 * package's newest source file. The message names the exact build command, so
 * the fix is a copy-paste rather than a hunt.
 */
export function assertDistFreshness(): void {
	const problems: string[] = [];

	for (const pkg of DIST_PACKAGES) {
		const packageDir = join(repoRoot, 'packages', pkg.dir);
		const artifact = join(packageDir, pkg.artifact);
		const built = mtimeOf(artifact);
		if (built === 0) {
			problems.push(
				`  ${pkg.name}: ${pkg.artifact} is missing. ${pkg.consumers} read it.\n` +
					`    Fix: bun run --filter ${pkg.name} build`,
			);
			continue;
		}
		const sourceDir = join(packageDir, 'src');
		const skip = new Set((pkg.generated ?? []).map((entry) => join(sourceDir, entry)));
		const sourced = newestMtime(sourceDir, skip);
		if (sourced > built) {
			problems.push(
				`  ${pkg.name}: src is newer than ${pkg.artifact}. ${pkg.consumers} would run the OLD build.\n` +
					`    Fix: bun run --filter ${pkg.name} build`,
			);
		}
	}

	// Second axis: even a freshly built core stays invisible to the Angular demo
	// until vite re-optimises, because that demo pre-bundles core.
	const prebundle = mtimeOf(join(repoRoot, ANGULAR_CORE_PREBUNDLE));
	const coreDist = mtimeOf(join(repoRoot, 'packages/core/dist/index.mjs'));
	if (prebundle > 0 && coreDist > prebundle) {
		problems.push(
			'  pptx-viewer-core: the Angular demo pre-bundled an older copy than packages/core/dist.\n' +
				'    Rebuilding core does not invalidate it. Fix: stop the demo on :4174, then\n' +
				'    rm -rf demos/demo-angular/node_modules/.vite',
		);
	}

	if (problems.length > 0) {
		throw new Error(
			`Stale build output: the e2e run would test code that is not on disk.\n\n${problems.join(
				'\n',
			)}\n\nSee the demo-resolution table in CLAUDE.md for which demo reads what.`,
		);
	}
}
