/**
 * Guard: no PUBLISHED `.d.ts` file may `import`/`export`/`require` from
 * `pptx-viewer-shared` (or any `pptx-viewer-shared/...` subpath).
 *
 * `pptx-viewer-shared` is a private, unpublished workspace package
 * (`"private": true` in `packages/shared/package.json`; see
 * `packages/shared/README.md`). Every binding's declaration build is supposed
 * to INLINE shared's types into the emitted `.d.ts` (React's
 * `scripts/bundle-declarations.mjs`, Vue's `vite-plugin-dts` `bundleTypes`,
 * Svelte's `rollup.dts.config.mjs`, Angular's vendored `internal/shared-src`,
 * Vanilla's `tsdown`/merge-declarations pipeline). When that inlining is
 * skipped or incomplete for some source file, the raw, un-inlined declaration
 * survives into the npm tarball and references a package a consumer cannot
 * install (issue #290).
 *
 * "Published" here means "would ship in the npm tarball" -- i.e. whatever
 * `npm pack` actually selects via the package's `files` field -- NOT merely
 * "reachable through the package's `exports` map". A stray, un-inlined
 * declaration file is a real bug (dead weight referencing an uninstallable
 * package) even if nothing in `exports` points at it directly, so this check
 * deliberately scans every packed `.d.ts`, not just the curated entry points.
 *
 * A comment merely mentioning the string `pptx-viewer-shared` is fine (this
 * file's own doc-comment above does exactly that); only an actual
 * `import`/`export ... from` or `require(...)` specifier fails the check.
 *
 * Usage:
 *   node scripts/check-published-shared-refs.mjs [react vue angular vanilla svelte]
 *   (defaults to all five when no binding is named)
 *
 * Each named binding must already be built (`bun run build` in that package,
 * or the Angular binding's own `bun run build` which populates `dist/`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Angular publishes from `dist/` (see `packages/angular/package.json` `pack` script). */
const PACK_DIRS = {
	react: 'packages/react',
	vue: 'packages/vue',
	angular: 'packages/angular/dist',
	vanilla: 'packages/vanilla',
	svelte: 'packages/svelte',
};

const ALL_BINDINGS = Object.keys(PACK_DIRS);

/**
 * Matches a `.d.ts` import/export/require specifier pointing at
 * `pptx-viewer-shared` or a subpath of it. Deliberately anchored to the actual
 * module-resolution syntax (`from '...'`, `require('...')`) so a plain-text
 * comment mentioning the package name never trips the check.
 */
export const DANGLING_REF_PATTERN =
	/(?:from\s+|require\()\s*["']pptx-viewer-shared(?:\/[^"']*)?["']/gu;

/**
 * Find every dangling `pptx-viewer-shared` import/export/require specifier in
 * a `.d.ts` file's text. Pure and filesystem-free so it is directly
 * unit-testable; `checkBinding` below is the integration wrapper that reads
 * real packed files.
 */
export function findDanglingRefs(declarationSource) {
	const matches = declarationSource.match(DANGLING_REF_PATTERN);
	return matches ? [...new Set(matches)] : [];
}

/** List every file `npm pack` would include for the package rooted at `packDir`. */
function packedFiles(packDir) {
	// npm ships as a `.cmd` shim (not a real executable) on Windows; Node can
	// only launch a shim through a shell, even via `execFileSync`. The argument
	// list is a fixed set of literal flags (never user input), so the shell
	// concatenation `shell: true` implies is safe here.
	const output = execFileSync(
		'npm',
		['pack', '--dry-run', '--ignore-scripts', '--json', '--workspaces=false'],
		{
			cwd: packDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: process.platform === 'win32',
		},
	);
	const [{ files }] = JSON.parse(output);
	return files.map((file) => file.path);
}

/** Scan one binding's packed output for dangling `pptx-viewer-shared` references. */
export function checkBinding(binding) {
	const packDir = resolve(ROOT, PACK_DIRS[binding]);
	const files = packedFiles(packDir).filter((path) => path.endsWith('.d.ts'));

	const offenders = [];
	for (const relativePath of files) {
		const contents = readFileSync(join(packDir, relativePath), 'utf8');
		const matches = findDanglingRefs(contents);
		if (matches.length > 0) {
			offenders.push({ file: relativePath, matches });
		}
	}

	return { binding, packDir, scanned: files.length, offenders };
}

export function main() {
	const requested = process.argv.slice(2);
	const bindings = requested.length > 0 ? requested : ALL_BINDINGS;

	for (const binding of bindings) {
		if (!ALL_BINDINGS.includes(binding)) {
			console.error(`Unknown binding "${binding}". Expected one of: ${ALL_BINDINGS.join(', ')}`);
			process.exitCode = 1;
			return;
		}
	}

	const results = bindings.map(checkBinding);
	let failed = false;

	for (const result of results) {
		if (result.offenders.length === 0) {
			console.log(
				`[check-published-shared-refs] ${result.binding}: ${result.scanned} published .d.ts file(s), 0 dangling pptx-viewer-shared reference(s).`,
			);
			continue;
		}
		failed = true;
		console.error(
			`[check-published-shared-refs] ${result.binding}: ${result.offenders.length} published .d.ts file(s) reference pptx-viewer-shared (an unpublished package):`,
		);
		for (const offender of result.offenders) {
			console.error(`  - ${offender.file}: ${offender.matches.join(', ')}`);
		}
	}

	if (failed) {
		console.error(
			'\nFix: inline the shared declarations for the affected binding (see the ' +
				'declaration-bundling notes in each package.json build script) so no ' +
				'published .d.ts imports from the private pptx-viewer-shared package.',
		);
		process.exitCode = 1;
	}
}

if (process.argv[1]?.endsWith('check-published-shared-refs.mjs')) {
	main();
}
