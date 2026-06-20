#!/usr/bin/env node
/**
 * prune-releases.mjs: enforce GitHub Release retention, per published package.
 *
 * Each package publishes its own GitHub Releases tagged `<npm-name>@<version>`
 * (see scripts/release-plan.mjs and .github/workflows/release.yml). Over time the
 * Releases list grows without bound. This script keeps only the newest N releases
 * (by semver) for each package and DELETES the older GitHub Release entries.
 *
 * Scope of deletion (deliberately narrow):
 *   - Deletes the GitHub Release page and its uploaded `.tgz` assets only.
 *   - Does NOT delete the underlying git tag (`gh release delete` without
 *     `--cleanup-tag`), so history and `release-plan.mjs` baselines are intact.
 *   - Does NOT touch npm; old versions stay installable.
 *
 * Usage:
 *   node scripts/prune-releases.mjs                 # prune, keep newest 5 each
 *   node scripts/prune-releases.mjs --keep 10       # keep newest 10 each
 *   node scripts/prune-releases.mjs --dry-run       # print what would be deleted
 *   node scripts/prune-releases.mjs --package core  # limit to one package (repeatable)
 *
 * Requires the `gh` CLI authenticated (GH_TOKEN in CI). Releases whose tag does
 * not match `<npm-name>@x.y.z` are ignored, so manual/legacy releases are safe.
 */

import { execFileSync } from 'node:child_process';

/** Published npm names, mirroring PACKAGES in scripts/release-plan.mjs. */
const NPM_NAMES = [
	'pptx-viewer-core',
	'pptx-react-viewer',
	'pptx-vue-viewer',
	'pptx-angular-viewer',
	'pptx-viewer-mcp',
];

const DEFAULT_KEEP = 5;

function parseArgs(argv) {
	const args = { keep: DEFAULT_KEEP, dryRun: false, packages: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') {
			args.dryRun = true;
		} else if (a === '--keep') {
			args.keep = Number(argv[++i]);
		} else if (a === '--package') {
			args.packages.push(argv[++i]);
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

/** All release tags for a package, newest-version first. */
function releasesFor(npmName) {
	// `gh release list` paginates; pull a generous page and filter by tag prefix.
	const raw = gh(['release', 'list', '--limit', '1000', '--json', 'tagName']);
	const all = JSON.parse(raw);
	const prefix = `${npmName}@`;
	return all
		.map((r) => r.tagName)
		.filter((t) => t.startsWith(prefix) && /^\d+\.\d+\.\d+$/u.test(t.slice(prefix.length)))
		.sort((a, b) => -cmpSemver(a.slice(prefix.length), b.slice(prefix.length)));
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const names = args.packages.length
		? NPM_NAMES.filter((n) =>
				args.packages.some((p) => n === p || n === `pptx-${p}-viewer` || n.includes(p)),
			)
		: NPM_NAMES;

	let deleted = 0;
	for (const npm of names) {
		const tags = releasesFor(npm);
		const keep = tags.slice(0, args.keep);
		const prune = tags.slice(args.keep);
		console.log(`${npm}: ${tags.length} release(s), keep ${keep.length}, prune ${prune.length}`);
		for (const tag of prune) {
			if (args.dryRun) {
				console.log(`  would delete ${tag}`);
				continue;
			}
			// No --cleanup-tag: keep the git tag, drop only the Release + assets.
			gh(['release', 'delete', tag, '--yes']);
			console.log(`  deleted ${tag}`);
			deleted++;
		}
	}
	console.log(
		args.dryRun ? 'Dry run: no releases deleted.' : `Done: deleted ${deleted} release(s).`,
	);
}

main();
