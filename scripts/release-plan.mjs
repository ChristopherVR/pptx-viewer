#!/usr/bin/env node
/**
 * release-plan.mjs: decide which packages to version + publish for a release.
 *
 * The monorepo publishes five packages from one repo. Previously every release
 * bumped and published all of them to the same new version, even ones with no
 * changes. This script computes, from the git history since the last release
 * tag, exactly which packages actually changed (directly or through a bundled
 * dependency) and should therefore be released. Unchanged packages keep their
 * already-published version and are skipped, so no redundant npm publish or
 * GitHub release asset is produced for them.
 *
 * It is the single source of truth shared by `.github/workflows/release.yml`
 * (tag + GitHub release) and `publish.yml` (npm publish), and is fully runnable
 * locally for inspection:
 *
 *   node scripts/release-plan.mjs                 # print the plan (dry run)
 *   node scripts/release-plan.mjs --no-npm        # skip npm lookups (offline)
 *   node scripts/release-plan.mjs --version 1.2.3 # force the target version
 *   node scripts/release-plan.mjs --write         # apply versions to package.json
 *
 * Dependency model (what forces a dependent to re-release):
 *   - `shared` (private, never published) is inlined/vendored into react, vue
 *     and angular, so a shared change re-releases all three.
 *   - `core` is bundled into react and vue, so a core change re-releases those
 *     two. angular depends on the published core via a caret range and tools via
 *     a loose peer range, so a core patch resolves forward for them with no
 *     re-release needed.
 *   - everything else re-releases only when its own published files change.
 *
 * Output: writes `release-plan.json` at the repo root, prints a summary, and
 * (when running under GitHub Actions) appends key/value pairs to `$GITHUB_OUTPUT`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Publishable packages: dir under packages/, and the name they ship to npm as. */
const PACKAGES = {
	core: { dir: 'packages/core', npm: 'pptx-viewer-core' },
	react: { dir: 'packages/react', npm: 'pptx-react-viewer' },
	vue: { dir: 'packages/vue', npm: 'pptx-vue-viewer' },
	angular: { dir: 'packages/angular', npm: 'pptx-angular-viewer' },
	tools: { dir: 'packages/tools', npm: 'pptx-viewer-mcp' },
};

/** Internal, non-published package whose changes propagate into bundlers. */
const SHARED_DIR = 'packages/shared';

/**
 * For each publishable package, the set of OTHER package dirs whose change also
 * forces it to re-release (because their code is compiled into its artifact).
 */
const TRIGGERS = {
	core: [],
	react: [SHARED_DIR, PACKAGES.core.dir],
	vue: [SHARED_DIR, PACKAGES.core.dir],
	angular: [SHARED_DIR],
	tools: [],
};

function git(args) {
	return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function npmVersion(name) {
	try {
		return execFileSync('npm', ['view', name, 'version'], {
			cwd: ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '0.0.0';
	}
}

/** Compare two `x.y.z` strings; returns 1 if a>b, -1 if a<b, 0 if equal. */
function cmpSemver(a, b) {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d !== 0) {
			return d > 0 ? 1 : -1;
		}
	}
	return 0;
}

function maxSemver(versions) {
	return versions.reduce((best, v) => (cmpSemver(v, best) > 0 ? v : best), '0.0.0');
}

/** Strict `vX.Y.Z` tags only; excludes date-stamped or pre-release tags. */
function semverTags() {
	const out = git(['tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-version:refname']);
	return out
		.split('\n')
		.map((t) => t.trim())
		.filter((t) => /^v\d+\.\d+\.\d+$/u.test(t));
}

/** Newest strict-semver tag that is an ancestor of HEAD but not HEAD itself. */
function baselineTag() {
	const headSha = git(['rev-parse', 'HEAD']);
	for (const tag of semverTags()) {
		let sha;
		try {
			sha = git(['rev-list', '-n', '1', tag]);
		} catch {
			continue;
		}
		if (sha === headSha) {
			continue;
		}
		try {
			git(['merge-base', '--is-ancestor', tag, 'HEAD']);
			return tag;
		} catch {
			// Not an ancestor (tag on another line of history); keep looking.
		}
	}
	return null;
}

/** Files that ship in the published artifact (exclude tests and the e2e dir). */
function isPublishedFile(path) {
	if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)) {
		return false;
	}
	if (path.includes('/__tests__/') || path.includes('/e2e/')) {
		return false;
	}
	return true;
}

function changedDirs(base) {
	const range = base ? `${base}..HEAD` : null;
	const out = range ? git(['diff', '--name-only', range]) : git(['ls-files']); // no baseline: treat everything as new
	return out
		.split('\n')
		.map((f) => f.trim())
		.filter((f) => f.length > 0 && isPublishedFile(f));
}

function dirTouched(files, dir) {
	const prefix = dir.endsWith('/') ? dir : `${dir}/`;
	return files.some((f) => f.startsWith(prefix));
}

function parseArgs(argv) {
	const args = { write: false, npm: true, version: null, base: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--write') {
			args.write = true;
		} else if (a === '--no-npm') {
			args.npm = false;
		} else if (a === '--version') {
			args.version = argv[++i];
		} else if (a === '--base') {
			args.base = argv[++i];
		}
	}
	return args;
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
	writeFileSync(path, `${JSON.stringify(data, null, '\t')}\n`);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const base = args.base ?? baselineTag();
	const files = changedDirs(base);

	// Resolve the target version: explicit override, else patch-bump the highest
	// of all existing semver tags and the five published npm versions.
	let nextVersion = args.version;
	if (!nextVersion) {
		const tagMax = maxSemver(semverTags().map((t) => t.slice(1)));
		const npmMax = args.npm
			? maxSemver(Object.values(PACKAGES).map((p) => npmVersion(p.npm)))
			: '0.0.0';
		const baseline = cmpSemver(tagMax, npmMax) >= 0 ? tagMax : npmMax;
		const [maj, min, patch] = baseline.split('.').map(Number);
		nextVersion = `${maj}.${min}.${patch + 1}`;
	}

	const sharedChanged = dirTouched(files, SHARED_DIR);

	// Decide release per publishable package: own dir OR any trigger dir touched.
	// With no baseline (first release) everything releases.
	const release = {};
	for (const [key, meta] of Object.entries(PACKAGES)) {
		if (!base) {
			release[key] = true;
			continue;
		}
		const own = dirTouched(files, meta.dir);
		const viaTrigger = TRIGGERS[key].some((dir) => dirTouched(files, dir));
		release[key] = own || viaTrigger;
	}

	const anyChanged = Object.values(release).some(Boolean);

	// Range angular bakes for the published core: the new version if core is part
	// of this release, otherwise core's current published version.
	const coreVersion = release.core
		? nextVersion
		: args.npm
			? npmVersion(PACKAGES.core.npm)
			: readJson(join(ROOT, PACKAGES.core.dir, 'package.json')).version;

	const plan = {
		baseline: base,
		nextVersion,
		tag: `v${nextVersion}`,
		anyChanged,
		coreVersion,
		sharedChanged,
		release,
	};

	writeJson(join(ROOT, 'release-plan.json'), plan);

	// Stamp the release version into each released package's source package.json.
	// Cross-package dependency ranges are intentionally left as-is: react/vue
	// bundle their deps (no runtime range to update) and angular's published
	// core range is patched in its dist by the workflow using `coreVersion`.
	if (args.write) {
		for (const [key, meta] of Object.entries(PACKAGES)) {
			if (!release[key]) {
				continue;
			}
			const pkgPath = join(ROOT, meta.dir, 'package.json');
			const data = readJson(pkgPath);
			data.version = nextVersion;
			writeJson(pkgPath, data);
		}
	}

	// Human-readable summary.
	const releasing = Object.entries(release)
		.filter(([, v]) => v)
		.map(([k]) => k);
	console.log(`baseline: ${base ?? '(none — first release)'}`);
	console.log(`version:  ${nextVersion}`);
	console.log(`core dep: ^${coreVersion}`);
	console.log(`shared changed: ${sharedChanged}`);
	console.log(`releasing: ${releasing.length ? releasing.join(', ') : '(nothing)'}`);
	if (args.write) {
		console.log('(wrote versions to released package.json files)');
	}

	// Expose to GitHub Actions.
	if (process.env.GITHUB_OUTPUT) {
		const lines = [
			`next_version=${nextVersion}`,
			`tag=v${nextVersion}`,
			`any_changed=${anyChanged}`,
			`core_version=${coreVersion}`,
		];
		for (const key of Object.keys(PACKAGES)) {
			lines.push(`release_${key}=${release[key]}`);
		}
		appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
	}
}

main();
