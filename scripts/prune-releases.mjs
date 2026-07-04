#!/usr/bin/env node
/**
 * prune-releases.mjs: enforce release retention, per published package.
 *
 * Each package publishes its own GitHub Releases tagged `<npm-name>@<version>`
 * (see scripts/release-plan.mjs and .github/workflows/release.yml). Over time
 * both the Releases list and the tag list grow without bound. This script keeps
 * only the newest N versions (by semver) for each package and deletes BOTH the
 * GitHub Release entry and the underlying git tag for anything older.
 *
 * Deleting old tags is safe because:
 *   - release-plan.mjs only needs each package's newest tags (baseline + version).
 *   - Changelogs are prepend-only (never regenerated from tag history), so
 *     shipped sections survive tag deletion untouched.
 *   - npm is untouched; old versions stay installable.
 *
 * Usage:
 *   node scripts/prune-releases.mjs                 # prune, keep newest 5 each
 *   node scripts/prune-releases.mjs --keep 10       # keep newest 10 each
 *   node scripts/prune-releases.mjs --dry-run       # print what would be deleted
 *   node scripts/prune-releases.mjs --package core  # limit to one package (repeatable)
 *   node scripts/prune-releases.mjs --legacy        # ALSO delete retired global v* tags
 *
 * Requires the `gh` CLI authenticated (GH_TOKEN in CI). Tags that do not match
 * `<npm-name>@x.y.z` (or `v*` under --legacy) are never touched.
 */

import { execFileSync } from 'node:child_process';

/** Published npm names, mirroring PACKAGES in scripts/release-plan.mjs. */
const NPM_NAMES = [
	'pptx-viewer-core',
	'pptx-react-viewer',
	'pptx-vue-viewer',
	'pptx-angular-viewer',
	'pptx-viewer-mcp',
	'@christophervr/pptx-viewer',
];

const DEFAULT_KEEP = 5;

function parseArgs(argv) {
	const args = { keep: DEFAULT_KEEP, dryRun: false, packages: [], legacy: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') {
			args.dryRun = true;
		} else if (a === '--keep') {
			args.keep = Number(argv[++i]);
		} else if (a === '--package') {
			args.packages.push(argv[++i]);
		} else if (a === '--legacy') {
			args.legacy = true;
		}
	}
	if (!Number.isInteger(args.keep) || args.keep < 0) {
		throw new Error(`--keep must be a non-negative integer, got ${args.keep}`);
	}
	return args;
}

function gh(args) {
	return execFileSync('gh', args, { encoding: 'utf8' });
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

/** All tag names in the repo (source of truth: git refs, not the Releases list). */
function allTags() {
	const raw = gh([
		'api',
		'repos/{owner}/{repo}/git/matching-refs/tags/',
		'--paginate',
		'--jq',
		'.[].ref',
	]);
	return raw
		.split('\n')
		.map((r) => r.trim())
		.filter((r) => r.startsWith('refs/tags/'))
		.map((r) => r.slice('refs/tags/'.length));
}

/** Tag names that currently have a GitHub Release attached. */
function releaseTagSet() {
	const raw = gh(['release', 'list', '--limit', '1000', '--json', 'tagName']);
	return new Set(JSON.parse(raw).map((r) => r.tagName));
}

/** Delete one tag, and its GitHub Release if it has one. */
function deleteTag(tag, hasRelease, dryRun) {
	if (dryRun) {
		console.log(`  would delete ${tag}${hasRelease ? ' (+ release)' : ''}`);
		return;
	}
	if (hasRelease) {
		// --cleanup-tag removes the Release, its assets, and the git tag in one go.
		gh(['release', 'delete', tag, '--yes', '--cleanup-tag']);
	} else {
		gh(['api', '-X', 'DELETE', `repos/{owner}/{repo}/git/refs/tags/${tag}`]);
	}
	console.log(`  deleted ${tag}${hasRelease ? ' (+ release)' : ''}`);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const names = args.packages.length
		? NPM_NAMES.filter((n) =>
				args.packages.some((p) => n === p || n === `pptx-${p}-viewer` || n.includes(p)),
			)
		: NPM_NAMES;

	const tags = allTags();
	const withRelease = releaseTagSet();
	let deleted = 0;

	for (const npm of names) {
		const prefix = `${npm}@`;
		const versions = tags
			.filter((t) => t.startsWith(prefix) && /^\d+\.\d+\.\d+$/u.test(t.slice(prefix.length)))
			.sort((a, b) => -cmpSemver(a.slice(prefix.length), b.slice(prefix.length)));
		const keep = versions.slice(0, args.keep);
		const prune = versions.slice(args.keep);
		console.log(`${npm}: ${versions.length} tag(s), keep ${keep.length}, prune ${prune.length}`);
		for (const tag of prune) {
			deleteTag(tag, withRelease.has(tag), args.dryRun);
			deleted++;
		}
	}

	// Retired global tag scheme (v1.2.3, v20260316.093408, ...): nothing reads
	// these anymore (changelogs are prepend-only, baselines are per-package), so
	// --legacy removes them all.
	if (args.legacy) {
		const legacy = tags.filter((t) => /^v\d/u.test(t));
		console.log(`legacy v*: ${legacy.length} tag(s), prune all`);
		for (const tag of legacy) {
			deleteTag(tag, withRelease.has(tag), args.dryRun);
			deleted++;
		}
	}

	console.log(
		args.dryRun
			? `Dry run: ${deleted} tag(s) would be deleted.`
			: `Done: deleted ${deleted} tag(s).`,
	);
}

main();
