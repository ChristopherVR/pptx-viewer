/**
 * Delete stray `.d.ts` / `.d.ts.map` build debris that a binding's first-stage
 * declaration emitter (tsup/tsdown/vite-plugin-dts) writes for every source
 * module, once a LATER step has bundled the real public surface into a small
 * set of self-contained entry files (`merge-declarations.mjs` copies those
 * bundled entries over the raw tree; this script removes what it didn't
 * overwrite).
 *
 * Those un-bundled per-module/per-chunk declarations are never inlined with
 * `pptx-viewer-shared` (the private, unpublished workspace package), so they
 * still `import`/`export ... from 'pptx-viewer-shared'` and (per issue #290)
 * ship as dead, uninstallable-reference debris in the npm tarball even though
 * nothing in the package's `exports` map points at them. Deleting them is the
 * fix, not just detecting them: `scripts/check-published-shared-refs.mjs`
 * guards against a regression, this script is what keeps the check green.
 *
 * Usage (run from the package directory, after the bundled entries have been
 * copied into `dist/` by `merge-declarations.mjs`):
 *   node ../../scripts/prune-stray-declarations.mjs dist index.d.ts viewer/index.d.ts i18n.d.ts internals.d.ts
 *
 * Only `.d.ts` and `.d.ts.map` are ever deleted. Locale subpath declarations
 * (`i18n/<locale>.d.mts` / `.d.cts`, written by
 * `packages/locales/scripts/copy-subpaths.mjs`) use different extensions and
 * are never touched, regardless of invocation order.
 */
import { readdirSync, rmSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const [, , distDirArgument, ...keepArguments] = process.argv;

if (!distDirArgument || keepArguments.length === 0) {
	console.error(
		'Usage: node prune-stray-declarations.mjs <distDir> <keep-entry.d.ts> [...moreKeepEntries]',
	);
	process.exitCode = 1;
	throw new Error('missing arguments');
}

const distDir = resolve(process.cwd(), distDirArgument);
/** Keep-list normalised to posix-style relative paths for comparison. */
const keep = new Set(keepArguments.map((entry) => entry.split(sep).join('/')));

function walk(directory) {
	const results = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) {
			results.push(...walk(full));
			continue;
		}
		if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) {
			results.push(full);
		}
	}
	return results;
}

let removed = 0;
for (const file of walk(distDir)) {
	const relativePath = relative(distDir, file).split(sep).join('/');
	// A kept entry's own `.d.ts.map` (if one happened to survive) is debris too:
	// the bundling step never emits a matching map, so a leftover one is stale.
	if (keep.has(relativePath)) {
		continue;
	}
	rmSync(file);
	removed++;
}

console.log(
	`[prune-stray-declarations] removed ${removed} stray declaration file(s) from ${distDirArgument}, kept ${keep.size} public entry file(s).`,
);
