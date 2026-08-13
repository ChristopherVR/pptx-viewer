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
import { join } from 'node:path';

import {
	ANGULAR_CORE_PREBUNDLE,
	DIST_PACKAGES,
	mtimeOf,
	newestMtime,
	repoRoot,
} from './dist-freshness-packages';

/** Dependency order for the combined fix command. Build left to right. */
const BUILD_ORDER = ['pptx-viewer-core', 'pptx-viewer-locales', 'pptx-viewer-shared'];

function buildOrderRank(name: string): number {
	const at = BUILD_ORDER.indexOf(name);
	return at < 0 ? BUILD_ORDER.length : at;
}

/**
 * Newest mtime anywhere under `dir`, INCLUDING build output. The inverse of
 * {@link newestMtime}, which deliberately skips `dist`.
 */
function newestUnder(dir: string): number {
	let newest = 0;
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		try {
			newest = Math.max(newest, entry.isDirectory() ? newestUnder(full) : statSync(full).mtimeMs);
		} catch {
			// Racing with a writer: skip.
		}
	}
	return newest;
}

/**
 * A fingerprint of "is a build writing right now", taken over each package's
 * WHOLE dist tree rather than its entry artifact.
 *
 * The entry file is the last thing a bundler writes, so watching only that made
 * an in-flight build look completely idle: tsup and ng-packagr spend most of a
 * build emitting chunks, declarations and maps, and touch the entry point at
 * the very end. Watching the tree sees that work as it happens.
 */
function buildActivityFingerprint(): string {
	return DIST_PACKAGES.map((pkg) =>
		String(newestUnder(join(repoRoot, 'packages', pkg.dir, 'dist'))),
	).join(',');
}

/** Collect the current staleness problems, with the package each belongs to. */
function collectProblems(): Array<{ name: string; message: string }> {
	const problems: Array<{ name: string; message: string }> = [];

	for (const pkg of DIST_PACKAGES) {
		const packageDir = join(repoRoot, 'packages', pkg.dir);
		const artifact = join(packageDir, pkg.artifact);
		const built = mtimeOf(artifact);
		if (built === 0) {
			problems.push({
				name: pkg.name,
				message:
					`  ${pkg.name}: ${pkg.artifact} is missing. ${pkg.consumers} read it.\n` +
					`    Fix: bun run --filter ${pkg.name} build`,
			});
			continue;
		}
		const sourceDir = join(packageDir, 'src');
		const skip = new Set((pkg.generated ?? []).map((entry) => join(sourceDir, entry)));
		const sourced = newestMtime(sourceDir, skip);
		if (sourced > built) {
			problems.push({
				name: pkg.name,
				message:
					`  ${pkg.name}: src is newer than ${pkg.artifact}. ${pkg.consumers} would run the OLD build.\n` +
					`    Fix: bun run --filter ${pkg.name} build`,
			});
		}
	}

	// Second axis: even a freshly built core stays invisible to the Angular demo
	// until vite re-optimises, because that demo pre-bundles core.
	const prebundle = mtimeOf(join(repoRoot, ANGULAR_CORE_PREBUNDLE));
	const coreDist = mtimeOf(join(repoRoot, 'packages/core/dist/index.mjs'));
	if (prebundle > 0 && coreDist > prebundle) {
		problems.push({
			name: 'angular-prebundle',
			message:
				'  pptx-viewer-core: the Angular demo pre-bundled an older copy than packages/core/dist.\n' +
				'    Rebuilding core does not invalidate it. Fix: stop the demo on :4174, then\n' +
				'    rm -rf demos/demo-angular/node_modules/.vite',
		});
	}

	return problems;
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

/** Poll interval for the mid-rebuild wait. */
const POLL_MS = 2_000;
/**
 * Minimum time to keep watching before concluding "stale, not building".
 *
 * Needed because a build can be quiet for several seconds at a stretch even
 * while running, so quiescence over one poll proves nothing. This is the tax
 * paid on the genuinely-stale path, so keep it short; `PPTX_DIST_WAIT=0`
 * removes it entirely.
 */
const MIN_GRACE_MS = 20_000;
/** Ceiling, for a pathological build that never settles. */
const MAX_WAIT_MS = 180_000;

/**
 * Throw the staleness report, or return quietly when there is nothing wrong.
 *
 * The message ends with one dependency-ordered command covering every stale
 * package, because the per-package lines are easy to half-follow and building
 * shared before core just makes you do it twice.
 */
function throwIfStale(problems: ReadonlyArray<{ name: string; message: string }>): void {
	if (problems.length === 0) {
		return;
	}
	const packages = [...new Set(problems.map((p) => p.name))]
		.filter((name) => name !== 'angular-prebundle')
		.sort((a, b) => buildOrderRank(a) - buildOrderRank(b));
	const combined =
		packages.length > 1
			? [
					'',
					'Build all of them, in this order:',
					`  ${packages.map((name) => `bun run --filter ${name} build`).join(' && ')}`,
					'',
				].join('\n')
			: '';

	throw new Error(
		[
			'Stale build output: the e2e run would test code that is not on disk.',
			'',
			problems.map((p) => p.message).join('\n'),
			combined,
			'This is not a flake and rerunning will not clear it. If a rebuild is genuinely in flight,',
			'wait for it to finish and rerun; this guard already waits for one it can observe.',
			'See the demo-resolution table in CLAUDE.md for which demo reads what.',
		].join('\n'),
	);
}

/**
 * Throw when any dist a demo resolves through is missing or older than its
 * package's newest source file. The message names the exact build command, so
 * the fix is a copy-paste rather than a hunt.
 *
 * ## Waiting out a rebuild, without ever passing a stale dist
 *
 * In a shared checkout the packages are rebuilt more or less continuously, so
 * an e2e run can hit the guard mid-build and abort on output that was about to
 * become fresh a second later. Four separate sessions were blocked that way.
 *
 * The fix is NOT to relax the check. It is to distinguish "stale" from
 * "currently being written", which is observable: a running build keeps writing
 * into `dist`, and a stale tree never changes at all. So this watches every
 * dist TREE and gives up once they have all been quiet for {@link MIN_GRACE_MS}.
 *
 * Watching the tree rather than the entry artifact is load-bearing. The first
 * version of this watched only the artifact each package is resolved through,
 * and it never once waited successfully: bundlers write the entry point LAST,
 * so a build that was busy emitting chunks looked completely idle and the guard
 * bailed on the first poll.
 *
 * It cannot pass a stale dist, because it only returns when `collectProblems()`
 * comes back empty. The cost is that a genuinely stale tree now fails after
 * {@link MIN_GRACE_MS} rather than instantly; set `PPTX_DIST_WAIT=0` to get the
 * old immediate failure.
 */
export async function assertDistFreshness(): Promise<void> {
	const waitEnabled = process.env.PPTX_DIST_WAIT !== '0';
	const startedAt = Date.now();
	let problems = collectProblems();
	let fingerprint = buildActivityFingerprint();
	/** Last moment a build was observed writing. Seeded so the grace applies. */
	let lastActivityAt = Date.now();
	let announced = false;

	if (!waitEnabled) {
		throwIfStale(problems);
		return;
	}

	while (problems.length > 0) {
		const elapsed = Date.now() - startedAt;
		const quietFor = Date.now() - lastActivityAt;
		// Give up once the tree has been quiet for the grace period, or the
		// ceiling is reached. Observed writes push `lastActivityAt` forward, so a
		// long build keeps the wait alive; a stale tree never does and this exits
		// after MIN_GRACE_MS.
		if (elapsed >= MAX_WAIT_MS || quietFor >= MIN_GRACE_MS) {
			break;
		}
		if (!announced) {
			console.warn(
				`[dist-freshness] build output is stale; watching for up to ${
					MIN_GRACE_MS / 1000
				}s of quiet in case a rebuild is in flight. Set PPTX_DIST_WAIT=0 to fail immediately.`,
			);
			announced = true;
		}
		await sleep(POLL_MS);
		const next = buildActivityFingerprint();
		if (next !== fingerprint) {
			fingerprint = next;
			lastActivityAt = Date.now();
		}
		problems = collectProblems();
	}

	throwIfStale(problems);
}
