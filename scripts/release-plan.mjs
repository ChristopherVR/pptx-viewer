#!/usr/bin/env node
/**
 * release-plan.mjs: decide which packages to version + publish for a release,
 * with an INDEPENDENT version line per package.
 *
 * The monorepo publishes five packages from one repo. Each one carries its own
 * version and its own git tag of the form `<npm-name>@<version>` (e.g.
 * `pptx-viewer-core@1.6.0`), bumped only when that package actually changes.
 * This script computes, from the git history since each package's last tag,
 * which packages changed (directly or through a bundled dependency) and the
 * next version for each. The bump level follows Conventional Commits: a
 * breaking change (`!` or BREAKING CHANGE footer) bumps major, a `feat` bumps
 * minor, anything else bumps patch. Unchanged packages keep their published
 * version and get no tag, no GitHub release, and no npm publish.
 *
 * It is the single source of truth for `.github/workflows/release.yml` (tags +
 * GitHub releases + per-package changelogs) and is fully runnable locally:
 *
 *   node scripts/release-plan.mjs                 # print the plan (dry run)
 *   node scripts/release-plan.mjs --no-npm        # skip npm lookups (offline)
 *   node scripts/release-plan.mjs --write         # apply versions to package.json
 *
 * Dependency model (what forces a dependent to re-release):
 *   - `shared` (private, never published) is inlined/vendored into react, vue
 *     and angular, so a shared change re-releases all three.
 *   - `core` is bundled into react, vue, and angular, so a core change
 *     re-releases all three. tools has a loose peer range on core, so a core
 *     patch resolves forward for tools with no re-release needed.
 *   - everything else re-releases only when its own published files change.
 *
 * Output: writes `release-plan.json` at the repo root, prints a summary, and
 * (under GitHub Actions) appends `any_changed` to `$GITHUB_OUTPUT`. The rich
 * per-package detail is consumed from `release-plan.json` via `jq`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Internal, non-published package whose changes propagate into bundlers. */
const SHARED_DIR = 'packages/shared';

/**
 * Paths OUTSIDE any package directory that still change what every published
 * artifact contains, and therefore force a re-release of all of them.
 *
 * `scripts/publish-manifest.mjs` produces the package.json that each package
 * actually ships: it resolves the `workspace:` protocol, which npm uploads
 * verbatim and no consumer can install. Issue #129 shipped exactly that, and a
 * fix confined to repo tooling touches no `packages/**` path, so without this
 * list the corrected pipeline would sit on main while npm kept serving the
 * broken manifests.
 */
const GLOBAL_TRIGGERS = ['scripts/publish-manifest.mjs'];

/**
 * Publishable packages. `dir` is the source dir, `npm` the published name,
 * `packDir` where `bun pm pack` runs (angular ships from its ng-packagr dist),
 * and `triggers` the OTHER dirs whose change also forces a re-release (their
 * code is compiled into this package's artifact).
 */
const PACKAGES = {
	core: {
		dir: 'packages/core',
		npm: 'pptx-viewer-core',
		packDir: 'packages/core',
		triggers: [],
	},
	react: {
		dir: 'packages/react',
		npm: 'pptx-react-viewer',
		packDir: 'packages/react',
		triggers: [SHARED_DIR, 'packages/core'],
	},
	vue: {
		dir: 'packages/vue',
		npm: 'pptx-vue-viewer',
		packDir: 'packages/vue',
		triggers: [SHARED_DIR, 'packages/core'],
	},
	angular: {
		dir: 'packages/angular',
		npm: 'pptx-angular-viewer',
		packDir: 'packages/angular/dist',
		triggers: [SHARED_DIR, 'packages/core'],
	},
	vanilla: {
		dir: 'packages/vanilla',
		npm: 'pptx-vanilla-viewer',
		packDir: 'packages/vanilla',
		triggers: [SHARED_DIR, 'packages/core'],
	},
	svelte: {
		dir: 'packages/svelte',
		npm: 'pptx-svelte-viewer',
		packDir: 'packages/svelte',
		triggers: [SHARED_DIR, 'packages/core'],
	},
	tools: {
		dir: 'packages/tools',
		npm: 'pptx-viewer-mcp',
		packDir: 'packages/tools',
		triggers: [],
	},
	cli: {
		dir: 'packages/cli',
		npm: '@christophervr/pptx-viewer',
		packDir: 'packages/cli',
		triggers: [],
	},
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

/** Bump a `x.y.z` version by a Conventional Commit level. */
function bumpVersion(version, level) {
	const [maj, min, patch] = version.split('.').map(Number);
	if (level === 'major') {
		return `${maj + 1}.0.0`;
	}
	if (level === 'minor') {
		return `${maj}.${min + 1}.0`;
	}
	return `${maj}.${min}.${patch + 1}`;
}

const BUMP_RANK = { patch: 0, minor: 1, major: 2 };

/** Published files a single commit touches inside the given dirs. */
function commitPublishedFiles(hash, dirs) {
	const out = git(['show', hash, '--name-only', '--format=']);
	return out
		.split('\n')
		.map((f) => f.trim())
		.filter((f) => f.length > 0 && isPublishedFile(f) && dirs.some((d) => pathTouched([f], d)));
}

/**
 * Highest Conventional Commit bump level among commits since `base` that touch
 * published files under `dirs`: `major` for breaking changes (a `!` marker or
 * a BREAKING CHANGE footer), `minor` for `feat`, otherwise `patch`. A commit
 * only raises the level if its published-file footprint inside `dirs` is
 * non-empty, so a test-only `feat` does not force a minor bump.
 */
function bumpLevel(base, dirs) {
	if (!base) {
		return 'patch';
	}
	const raw = git(['log', '--format=%H%x1f%s%x1f%b%x1e', `${base}..HEAD`, '--', ...dirs]);
	let best = 'patch';
	for (const record of raw.split('\x1e')) {
		const [hash, subject = '', body = ''] = record.trim().split('\x1f');
		if (!hash) {
			continue;
		}
		let level = 'patch';
		if (/^[a-z]+(?:\([^)]*\))?!:/iu.test(subject) || /(?:^|\n)BREAKING[ -]CHANGE:/u.test(body)) {
			level = 'major';
		} else if (/^feat(?:\([^)]*\))?:/u.test(subject)) {
			level = 'minor';
		}
		// Only pay for the per-commit file check when it would raise the level.
		if (BUMP_RANK[level] > BUMP_RANK[best] && commitPublishedFiles(hash, dirs).length > 0) {
			best = level;
		}
		if (best === 'major') {
			break;
		}
	}
	return best;
}

/** All `<npmName>@x.y.z` versions that already have a git tag, newest first. */
function taggedVersions(npmName) {
	const out = git(['tag', '--list', `${npmName}@*`]);
	return out
		.split('\n')
		.map((t) => t.trim())
		.filter((t) => t.startsWith(`${npmName}@`))
		.map((t) => t.slice(npmName.length + 1))
		.filter((v) => /^\d+\.\d+\.\d+$/u.test(v));
}

/**
 * Per-package baseline ref to diff against: the newest `<npmName>@*` tag that is
 * an ancestor of HEAD. Falls back to null (first release).
 *
 * A tag that points AT HEAD is a valid baseline: it yields an empty diff, which
 * is exactly what we want for an already-released HEAD (no re-release). Skipping
 * it would fall back to the previous release commit, whose diff always contains
 * the last release's own version/changelog bump and would re-trigger a release
 * on every scheduled run.
 */
function baselineTag(npmName) {
	const tags = git(['tag', '--list', `${npmName}@*`, '--sort=-version:refname'])
		.split('\n')
		.map((t) => t.trim())
		.filter((t) => /^.+@\d+\.\d+\.\d+$/u.test(t));
	for (const tag of tags) {
		try {
			// `--is-ancestor` treats a commit as its own ancestor, so a tag on HEAD
			// qualifies and produces the desired empty diff.
			git(['merge-base', '--is-ancestor', tag, 'HEAD']);
			return tag;
		} catch {
			// Tag on another line of history; keep looking.
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

/**
 * True if the only difference in a JSON file between `base` and HEAD is its
 * top-level `version` field. Used to ignore the version bump that the release
 * commit writes into each released package's package.json.
 */
function isVersionOnlyChange(path, base) {
	if (!base) {
		return false;
	}
	let before;
	let after;
	try {
		before = git(['show', `${base}:${path}`]);
		after = git(['show', `HEAD:${path}`]);
	} catch {
		return false; // added/removed on one side -> treat as a real change
	}
	try {
		const a = JSON.parse(before);
		const b = JSON.parse(after);
		delete a.version;
		delete b.version;
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		return false;
	}
}

/**
 * True if `path` is a release-generated artifact that must not, on its own,
 * force a re-release: a generated CHANGELOG.md, or a package.json whose only
 * change since `base` is its `version` field (the release commit's bump).
 * Without this, the previous release commit's own edits fall inside the next
 * run's diff window and re-trigger a release on every scheduled run.
 */
function isReleaseArtifact(path, base) {
	if (/(?:^|\/)CHANGELOG\.md$/u.test(path)) {
		return true;
	}
	if (/(?:^|\/)package\.json$/u.test(path)) {
		return isVersionOnlyChange(path, base);
	}
	return false;
}

function changedFiles(base) {
	const out = base ? git(['diff', '--name-only', `${base}..HEAD`]) : git(['ls-files']);
	return out
		.split('\n')
		.map((f) => f.trim())
		.filter((f) => f.length > 0 && isPublishedFile(f) && !isReleaseArtifact(f, base));
}

function dirTouched(files, dir) {
	const prefix = dir.endsWith('/') ? dir : `${dir}/`;
	return files.some((f) => f.startsWith(prefix));
}

/** Like {@link dirTouched}, but `target` may also be a single file path. */
function pathTouched(files, target) {
	return files.includes(target) || dirTouched(files, target);
}

function parseArgs(argv) {
	const args = { write: false, npm: true };
	for (const a of argv) {
		if (a === '--write') {
			args.write = true;
		} else if (a === '--no-npm') {
			args.npm = false;
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

/** Published baseline version for a package: highest of its tags and npm. */
function publishedVersion(meta, useNpm) {
	const fromTags = maxSemver(taggedVersions(meta.npm));
	const fromNpm = useNpm ? npmVersion(meta.npm) : '0.0.0';
	const fromPkg = readJson(join(ROOT, meta.dir, 'package.json')).version || '0.0.0';
	return maxSemver([fromTags, fromNpm, fromPkg]);
}

function main() {
	const args = parseArgs(process.argv.slice(2));

	// First pass: per-package change decision and own-version computation.
	const packages = {};
	for (const [key, meta] of Object.entries(PACKAGES)) {
		const base = baselineTag(meta.npm);
		const files = changedFiles(base);
		const own = dirTouched(files, meta.dir);
		const viaTrigger = meta.triggers.some((dir) => dirTouched(files, dir));
		const viaGlobal = GLOBAL_TRIGGERS.some((p) => pathTouched(files, p));
		const release = base ? own || viaTrigger || viaGlobal : true;
		const current = publishedVersion(meta, args.npm);
		const scope = [meta.dir, ...meta.triggers, ...GLOBAL_TRIGGERS];
		const bump = release ? bumpLevel(base, scope) : null;
		const version = release ? bumpVersion(current, bump) : current;
		// Changelog scoping: package dirs match by subtree, global triggers are
		// literal file paths.
		const includePaths = [
			...[meta.dir, ...meta.triggers].map((d) => `${d}/**`),
			...GLOBAL_TRIGGERS,
		];
		packages[key] = {
			npm: meta.npm,
			dir: meta.dir,
			packDir: meta.packDir,
			baseline: base,
			release,
			bump,
			currentVersion: current,
			version,
			tag: `${meta.npm}@${version}`,
			includePaths,
		};
	}

	const anyChanged = Object.values(packages).some((p) => p.release);
	// Range angular bakes for the published core: the new version when core is
	// part of this release, otherwise core's current published version.
	const coreVersion = packages.core.release ? packages.core.version : packages.core.currentVersion;

	const plan = { anyChanged, coreVersion, packages };
	writeJson(join(ROOT, 'release-plan.json'), plan);

	// Stamp each released package's own version into its source package.json.
	// Cross-package ranges are left as-is: react/vue bundle their deps and
	// angular's published core range is patched in its dist by the workflow.
	if (args.write) {
		for (const [key, meta] of Object.entries(PACKAGES)) {
			if (!packages[key].release) {
				continue;
			}
			const pkgPath = join(ROOT, meta.dir, 'package.json');
			const data = readJson(pkgPath);
			data.version = packages[key].version;
			writeJson(pkgPath, data);
		}
	}

	console.log('Release plan (independent per-package versions):');
	for (const [key, p] of Object.entries(packages)) {
		const arrow = p.release
			? `${p.currentVersion} -> ${p.version} (${p.bump})`
			: `${p.currentVersion} (skip)`;
		console.log(`  ${key.padEnd(8)} ${arrow}${p.release ? `  tag ${p.tag}` : ''}`);
	}
	console.log(`core dep range: ^${coreVersion}`);
	if (args.write) {
		console.log('(wrote versions to released package.json files)');
	}

	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `any_changed=${anyChanged}\n`);
	}
}

main();
