/**
 * Decide whether a `git push` needs the `@local-only` e2e tests
 * (`e2e/export-raster-tiling.spec.ts`'s real-time video-recording specs,
 * which reliably take down the hosted CI runner and are excluded from CI via
 * `grepInvert` in playwright.config.ts) and, if so, print the run command.
 *
 * Kept out of `.husky/pre-push` (POSIX sh) because the path-matching logic
 * below is the part that actually changes over time, and is far easier to
 * read, test and extend as JS than as shell globs. See
 * `scripts/affected-packages.mjs` for the sibling script this one borrows its
 * shape from (a pure `analyse`-style function plus a thin CLI wrapper); unlike
 * that script, this one also has to turn the ref lines Git feeds a pre-push
 * hook on stdin into a diff range itself, since there is no CI step upstream
 * already computing a changed-files list.
 *
 * Usage (from `.husky/pre-push`): the hook pipes its own stdin (Git's
 * `<local ref> <local sha> <remote ref> <remote sha>` lines) into
 * `node scripts/pre-push-local-e2e.mjs` and checks the exit code:
 *   0  - relevant paths changed; the hook should run the local-only e2e tests.
 *   1  - nothing relevant changed; the hook should skip quietly.
 * Either way this script prints exactly one explanatory line to stdout.
 *
 * @module scripts/pre-push-local-e2e
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Git's sentinel for "this ref does not exist" (new branch, or a deleted ref). */
export const ZERO_SHA = '0'.repeat(40);

/**
 * Paths that can affect real-time video/GIF export capture: the shared
 * capture pipeline, each binding's export code, and the e2e coverage for it.
 * Deliberately generous (a whole directory per binding) rather than naming
 * individual files, so a new file dropped into one of these directories is
 * covered without this list needing an update.
 */
export const RELEVANT_PATH_PATTERNS = [
	// The shared capture/rasterize/tiling pipeline every binding's export goes through.
	/^packages\/shared\/src\/export\//u,
	// React: export-video.ts and its neighbours under viewer/utils, plus the
	// export-oriented hooks and the canvas-export helper.
	/^packages\/react\/src\/(viewer\/utils\/export-|viewer\/hooks\/useExport|lib\/canvas-export)/u,
	// Vue: useMediaExport.ts and its neighbouring export composables.
	/^packages\/vue\/src\/(viewer\/composables\/use(?:Media|Gif|Export)|lib\/canvas-export|viewer\/export-svg)/u,
	// Angular: every viewer/*export* file, plus the vendored shared export
	// source ng-packagr inlines at build time.
	/^packages\/angular\/src\/(viewer\/.*export|internal\/shared-src\/(?:export\/|render\/export-)|lib\/canvas-export)/iu,
	// Svelte: the export/ module.
	/^packages\/svelte\/src\/viewer\/export\//u,
	// Vanilla: the export/ module plus its lifecycle wiring.
	/^packages\/vanilla\/src\/viewer\/export(?:-lifecycle|\/)/u,
	// The local-only spec itself, its shared export test helpers, and the
	// Playwright config that carries the @local-only exclusion.
	/^e2e\/export-raster-tiling\.spec\.ts$/u,
	/^e2e\/support\/exports\.ts$/u,
	/^playwright\.config\.ts$/u,
];

/** True when `file` (a repo-root-relative path, forward slashes) matches any relevant pattern. */
export function isRelevantPath(file) {
	return RELEVANT_PATH_PATTERNS.some((pattern) => pattern.test(file));
}

/**
 * Parse the `<local ref> <local sha> <remote ref> <remote sha>` lines Git
 * feeds a pre-push hook on stdin. Blank lines (a trailing newline, or no
 * refs being pushed at all) are dropped.
 */
export function parseRefLines(input) {
	return input
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/u);
			return { localRef, localSha, remoteRef, remoteSha };
		});
}

/**
 * The `git diff` range for one ref line, or `null` when there is nothing to
 * diff (deleting a remote ref: `localSha` is all zeros).
 *
 * A brand-new branch (`remoteSha` all zeros, nothing to compare against on
 * the remote yet) falls back to `fallbackBase` (`origin/main`) so a first
 * push of a branch still gets scoped rather than treated as "everything
 * changed" or "nothing changed".
 */
export function diffRangeForLine(line, fallbackBase = 'origin/main') {
	if (line.localSha === ZERO_SHA) {
		return null;
	}
	const base = line.remoteSha === ZERO_SHA ? fallbackBase : line.remoteSha;
	return { base, head: line.localSha };
}

/** Default `changedFiles`: shells out to `git diff --name-only <base>...<head>`. */
function gitDiffNameOnly(base, head) {
	const output = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
		encoding: 'utf8',
	});
	return output
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/**
 * Decide whether the push described by `stdinInput` touches any export-video
 * related path, without ever throwing: a `git diff` that fails for an
 * unexpected reason (a rewritten history, an unknown remote) is treated as
 * "assume relevant" and reported as such, on the same "missing a leg that
 * should have run is worse than running one that need not have"
 * principle `scripts/affected-packages.mjs` documents for CI scoping.
 */
export function decide(stdinInput, { changedFiles = gitDiffNameOnly, fallbackBase } = {}) {
	const lines = parseRefLines(stdinInput);
	if (lines.length === 0) {
		return { relevant: false, reason: 'no refs are being pushed', files: [] };
	}

	const allFiles = new Set();
	for (const line of lines) {
		const range = diffRangeForLine(line, fallbackBase);
		if (range === null) {
			continue;
		}
		let files;
		try {
			files = changedFiles(range.base, range.head);
		} catch (error) {
			return {
				relevant: true,
				reason: `could not diff ${range.base}...${range.head} (${error instanceof Error ? error.message : String(error)}); running to be safe`,
				files: [],
			};
		}
		for (const file of files) {
			allFiles.add(file);
		}
	}

	const matched = [...allFiles].filter(isRelevantPath).sort();
	if (matched.length === 0) {
		return { relevant: false, reason: 'no export-related paths changed', files: [] };
	}
	return {
		relevant: true,
		reason: `export-related paths changed: ${matched.join(', ')}`,
		files: matched,
	};
}

function readStdin() {
	try {
		return readFileSync(0, 'utf8');
	} catch {
		return '';
	}
}

function main() {
	const input = readStdin();
	const result = decide(input);
	if (result.relevant) {
		console.log(`pptx: local-only e2e needed (${result.reason})`);
		process.exit(0);
	}
	console.log(`pptx: skipping local-only e2e (${result.reason})`);
	process.exit(1);
}

if (process.argv[1]?.endsWith('pre-push-local-e2e.mjs')) {
	main();
}
