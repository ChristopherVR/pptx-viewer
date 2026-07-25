/**
 * Work out which CI legs a pull request actually needs.
 *
 * The full matrix is 12 unit-test legs plus 5 Playwright legs, and e2e is the
 * long pole (a dev server plus a browser per framework). Running all of it for
 * a one-line change to a single binding wastes most of a run, so a PR is scoped
 * to the packages its changed paths can reach.
 *
 * Scoping is deliberately GENEROUS: a change to `core` or `shared` fans out to
 * every binding, and anything unrecognised runs everything. Missing a leg that
 * should have run is a far worse failure than running one that need not have,
 * so every rule here errs towards running more.
 *
 * Pushes to main are never scoped; the trunk always runs the full matrix.
 *
 * Usage: node scripts/affected-packages.mjs <changed-files.json>
 */

import { readFileSync, writeFileSync } from 'node:fs';

/** Unit-test legs, keyed as in ci.yml's test matrix. */
export const TEST_LEGS = {
	core: ['core'],
	'core-crypto': ['core'],
	shared: ['shared'],
	locales: ['locales'],
	react: ['react'],
	react18: ['react'],
	vue: ['vue'],
	angular: ['angular'],
	vanilla: ['vanilla'],
	svelte: ['svelte'],
	tools: ['tools'],
	cli: ['cli'],
};

export const BINDINGS = ['react', 'vue', 'angular', 'vanilla', 'svelte'];

/** Direct workspace dependencies, used to fan a change out to its dependents. */
const DEPENDS_ON = {
	core: [],
	tools: ['core'],
	shared: ['core', 'tools'],
	locales: ['shared'],
	react: ['core', 'shared', 'locales'],
	vue: ['core', 'shared', 'locales'],
	angular: ['core', 'shared', 'locales'],
	vanilla: ['core', 'shared', 'locales'],
	svelte: ['core', 'shared', 'locales'],
	cli: ['core'],
};

const ALL_PACKAGES = Object.keys(DEPENDS_ON);

/** Paths that can change build or test behaviour anywhere: run everything. */
const GLOBAL_RE =
	/^(?:package\.json|bun\.lock|tsconfig[^/]*\.json|\.oxlintrc\.json|oxfmt\.json|vitest\.[^/]*|playwright\.config\.ts|scripts\/|\.github\/workflows\/)/u;

/** Paths that cannot affect any test: run nothing on their account. */
const INERT_RE =
	/^(?:docs\/|\.github\/(?:ISSUE_TEMPLATE|labeler\.yml|dependabot\.yml|PULL_REQUEST_TEMPLATE\.md)|[^/]*\.md$|LICENSE)/u;

const PACKAGE_RE = /^packages\/([^/]+)\//u;
const DEMO_RE = /^demos\/demo-([^/]+)\//u;
const E2E_RE = /^(?:e2e\/|playwright\.config\.ts)/u;

function transitiveDeps(pkg, seen = new Set()) {
	for (const dep of DEPENDS_ON[pkg] ?? []) {
		if (!seen.has(dep)) {
			seen.add(dep);
			transitiveDeps(dep, seen);
		}
	}
	return seen;
}

/** Every package that would be rebuilt or retested because `changed` changed. */
export function dependentsOf(changed) {
	return ALL_PACKAGES.filter((pkg) => pkg === changed || transitiveDeps(pkg).has(changed));
}

export function analyse(files) {
	if (!Array.isArray(files) || files.length === 0) {
		return { packages: [], testLegs: [], e2eProjects: [], reason: 'no files changed' };
	}

	const packages = new Set();
	const e2e = new Set();
	let global = false;

	for (const file of files) {
		if (INERT_RE.test(file)) {
			continue;
		}

		if (GLOBAL_RE.test(file)) {
			global = true;
			break;
		}

		if (E2E_RE.test(file)) {
			for (const binding of BINDINGS) {
				e2e.add(binding);
			}
			continue;
		}

		const demo = DEMO_RE.exec(file);
		if (demo) {
			// A demo app is only exercised by that framework's Playwright leg.
			if (BINDINGS.includes(demo[1])) {
				e2e.add(demo[1]);
			}
			continue;
		}

		const pkg = PACKAGE_RE.exec(file);
		if (pkg) {
			// react-compat exists purely to re-run the React suite against React 18.
			const name = pkg[1] === 'react-compat' ? 'react' : pkg[1];
			if (ALL_PACKAGES.includes(name)) {
				for (const dependent of dependentsOf(name)) {
					packages.add(dependent);
				}
				continue;
			}
		}

		// Anything unrecognised is treated as global rather than ignored.
		global = true;
		break;
	}

	if (global) {
		return {
			packages: ALL_PACKAGES,
			testLegs: Object.keys(TEST_LEGS),
			e2eProjects: BINDINGS,
			reason: 'a global or unrecognised path changed',
		};
	}

	for (const pkg of packages) {
		if (BINDINGS.includes(pkg)) {
			e2e.add(pkg);
		}
	}

	const testLegs = Object.entries(TEST_LEGS)
		.filter(([, owned]) => owned.some((p) => packages.has(p)))
		.map(([leg]) => leg);

	return {
		packages: [...packages].sort(),
		testLegs,
		e2eProjects: BINDINGS.filter((b) => e2e.has(b)),
		reason: 'scoped to changed paths',
	};
}

function main() {
	const [inputPath] = process.argv.slice(2);
	if (!inputPath) {
		console.error('usage: node scripts/affected-packages.mjs <changed-files.json>');
		process.exit(2);
	}

	const files = JSON.parse(readFileSync(inputPath, 'utf8'));
	const result = analyse(files);

	console.log(`Scope: ${result.reason}`);
	console.log(`Packages:  ${result.packages.join(', ') || '(none)'}`);
	console.log(`Test legs: ${result.testLegs.join(', ') || '(none)'}`);
	console.log(`E2E:       ${result.e2eProjects.join(', ') || '(none)'}`);

	if (process.env.GITHUB_OUTPUT) {
		writeFileSync(
			process.env.GITHUB_OUTPUT,
			[
				`test-legs=${JSON.stringify(result.testLegs)}`,
				`e2e-projects=${JSON.stringify(result.e2eProjects)}`,
				`has-tests=${result.testLegs.length > 0}`,
				`has-e2e=${result.e2eProjects.length > 0}`,
				`reason=${result.reason}`,
				'',
			].join('\n'),
			{ flag: 'a' },
		);
	}
}

if (process.argv[1]?.endsWith('affected-packages.mjs')) {
	main();
}
