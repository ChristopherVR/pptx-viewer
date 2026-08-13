#!/usr/bin/env node
/**
 * One-off repair: fill in per-package CHANGELOG.md sections that shipped empty.
 *
 * WHY THEY ARE EMPTY. `.github/workflows/release.yml` passed git-cliff's
 * `--include-path` patterns through an UNQUOTED shell variable, so the shell
 * expanded `packages/vue/**` into literal top-level paths (`packages/vue/src`,
 * `packages/vue/package.json`, ...) before git-cliff saw them. `--include-path`
 * accepts many values, so git-cliff took them silently, and a literal
 * `packages/vue/src` matches only that exact path and never a file under it.
 * Every commit touching only `src/` was filtered out, which is why 359 of 590
 * per-package sections are heading-only: a section survived only if one of its
 * commits happened to touch a file sitting directly in the package root
 * (`package.json`, `README.md`). The workflow bug is fixed (`set -f`); this
 * script repairs the sections it already wrote.
 *
 * WHY THIS IS NOT A REGENERATION. Changelogs here are prepend-only, because
 * prune-releases.mjs culls old tags and the remote has demonstrably lost them
 * (319 tags on the remote against 646 locally). So this script never derives a
 * section's EXISTENCE from a tag, never re-renders a section that already has
 * content, and never reorders or reflows anything. It only inserts a body under
 * a heading that is already in the file.
 *
 * RANGE RESOLUTION, in order of trust:
 *   1. the version's own git tag, where it still exists;
 *   2. otherwise the commit that CHANGED `packages/<pkg>/package.json` to that
 *      version. Every release commit stamps it there, that is ordinary commit
 *      history on `main`, and it is immune to tag culling. Measured against the
 *      tags that do survive, this agrees for every version cut under the
 *      per-package scheme (see --validate-ranges).
 * A section whose lower bound cannot be resolved is left alone, never guessed.
 *
 * The renderer reimplements cliff.toml's template rather than shelling out to
 * git-cliff 337 times: `[remote.github]` makes every git-cliff run page the
 * GitHub API, which rate-limits long before that. Template fidelity is measured,
 * not assumed: `--validate-template` re-renders every shipped section FROM THE
 * COMMITS THAT SECTION ALREADY NAMES and requires a byte-for-byte match. That
 * isolates the template from the path filter, which matters because the shipped
 * sections were themselves produced by the broken filter and so cannot be
 * ground truth for which commits belong in a section.
 *
 * Usage:
 *   node scripts/backfill-changelog-sections.mjs --validate-template
 *   node scripts/backfill-changelog-sections.mjs --validate-ranges
 *   node scripts/backfill-changelog-sections.mjs --dry-run [pkg...]
 *   node scripts/backfill-changelog-sections.mjs --write [pkg...]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/ChristopherVR/pptx-viewer';

/** Mirrors PACKAGES in release-plan.mjs: npm name + the paths that scope it. */
export const PACKAGES = {
	core: { npm: 'pptx-viewer-core', paths: ['packages/core'] },
	react: {
		npm: 'pptx-react-viewer',
		paths: ['packages/react', 'packages/shared', 'packages/core'],
	},
	vue: { npm: 'pptx-vue-viewer', paths: ['packages/vue', 'packages/shared', 'packages/core'] },
	angular: {
		npm: 'pptx-angular-viewer',
		paths: ['packages/angular', 'packages/shared', 'packages/core'],
	},
	vanilla: {
		npm: 'pptx-vanilla-viewer',
		paths: ['packages/vanilla', 'packages/shared', 'packages/core'],
	},
	svelte: {
		npm: 'pptx-svelte-viewer',
		paths: ['packages/svelte', 'packages/shared', 'packages/core'],
	},
	tools: { npm: 'pptx-viewer-mcp', paths: ['packages/tools'] },
	cli: { npm: '@christophervr/pptx-viewer', paths: ['packages/cli'] },
};

/**
 * cliff.toml `commit_parsers`, in order, first match wins. Kept in sync with
 * cliff.toml by backfill-changelog-sections.test.mjs. The `<!-- N -->` prefixes
 * are the sort keys git-cliff groups by (a lexicographic sort of the whole
 * string, hence "10" sorting between "1" and "2").
 */
export const COMMIT_PARSERS = [
	{ re: /\[skip ci\]/u, skip: true },
	{ re: /^chore\(release\)/u, skip: true },
	{ re: /^feat/u, group: '<!-- 0 -->Features' },
	{ re: /^fix/u, group: '<!-- 1 -->Bug Fixes' },
	{ re: /^perf/u, group: '<!-- 2 -->Performance' },
	{ re: /^refactor/u, group: '<!-- 3 -->Refactor' },
	{ re: /^docs/u, group: '<!-- 4 -->Documentation' },
	{ re: /^test/u, group: '<!-- 5 -->Testing' },
	{ re: /^(build|ci)/u, group: '<!-- 6 -->Build & CI' },
	{ re: /^style/u, group: '<!-- 7 -->Styling' },
	{ re: /^chore\(deps\)/u, group: '<!-- 8 -->Dependencies' },
	{ re: /^chore/u, group: '<!-- 9 -->Chores' },
	{ re: /^revert/u, group: '<!-- 10 -->Reverts' },
	{ re: /.*/u, group: '<!-- 12 -->Other' },
];

/** cliff.toml `commit_preprocessors`: turn issue refs into links. */
export function preprocess(subject) {
	return subject.replace(/\((\w+\s)?#(\d+)\)/gu, (_m, _p1, n) => `([#${n}](${REPO}/issues/${n}))`);
}

/** Conventional Commit shape. `filter_unconventional = true` drops the rest. */
const CONVENTIONAL = /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?: (?<desc>.+)$/u;

export function upperFirst(s) {
	return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Group + rendered fields for one commit, or null when git-cliff would drop it. */
export function classify(subject) {
	const processed = preprocess(subject.trim());
	const match = CONVENTIONAL.exec(processed);
	if (!match?.groups) {
		return null; // filter_unconventional
	}
	for (const parser of COMMIT_PARSERS) {
		if (!parser.re.test(processed)) {
			continue;
		}
		if (parser.skip) {
			return null;
		}
		return {
			group: parser.group,
			scope: match.groups.scope ?? '',
			message: upperFirst(match.groups.desc),
		};
	}
	return null;
}

/** `### Bug Fixes` - the group name with its sort-key comment stripped. */
export function groupHeading(group) {
	return upperFirst(group.replace(/<!--.*?-->/gu, '').trim());
}

export function renderBullet({ scope, message, username, id }) {
	const scopePart = scope ? `**${scope}:** ` : '';
	const byPart = username ? ` (by @${username})` : '';
	return `- ${scopePart}${message}${byPart} ([${id.slice(0, 7)}](${REPO}/commit/${id}))`;
}

/**
 * The body git-cliff renders under a version heading: groups in sort-key order,
 * commits oldest-first within each group (`sort_commits = "oldest"`).
 * Returns '' when no commit survives the parsers.
 */
export function renderBody(commits) {
	const byGroup = new Map();
	for (const commit of commits) {
		const classified = classify(commit.subject);
		if (!classified) {
			continue;
		}
		const list = byGroup.get(classified.group) ?? [];
		list.push(renderBullet({ ...classified, username: commit.username, id: commit.id }));
		byGroup.set(classified.group, list);
	}
	if (byGroup.size === 0) {
		return '';
	}
	return [...byGroup.keys()]
		.sort()
		.map((group) => `### ${groupHeading(group)}\n\n${byGroup.get(group).join('\n')}`)
		.join('\n\n');
}

// ---------------------------------------------------------------------------
// Changelog file parsing
// ---------------------------------------------------------------------------

const HEADING = /^##\s+\[(?<version>[^\]]+)\]\([^)]*\)\s+-\s+(?<date>\d{4}-\d{2}-\d{2})\s*$/u;

/** Sections of a per-package changelog, newest first (prepend-only). */
export function parseSections(text) {
	const lines = text.split('\n');
	const sections = [];
	lines.forEach((line, index) => {
		const match = HEADING.exec(line);
		if (match?.groups) {
			sections.push({
				version: match.groups.version,
				date: match.groups.date,
				headingLine: index,
				body: [],
			});
		} else if (sections.length > 0) {
			sections[sections.length - 1].body.push(line);
		}
	});
	for (const section of sections) {
		section.text = section.body.join('\n').trim();
		section.empty = !/^\s*[-*]\s/mu.test(section.text);
		section.shas = [...section.text.matchAll(/\/commit\/([0-9a-f]{7,40})\)/gu)].map((m) => m[1]);
	}
	return sections;
}

/**
 * Insert `body` under the heading of the named sections, leaving every other
 * byte of the file untouched. Only sections with no content are ever passed
 * here; backfill-changelog-sections.test.mjs enforces that.
 */
export function applyFills(text, fills) {
	const lines = text.split('\n');
	const byLine = new Map(fills.map((f) => [f.headingLine, f.body]));
	const out = [];
	lines.forEach((line, index) => {
		out.push(line);
		const body = byLine.get(index);
		if (body !== undefined) {
			out.push('', body);
		}
	});
	return out.join('\n');
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

function git(args) {
	// stderr is piped, not inherited: several call sites probe for refs that may
	// legitimately not exist (culled tags, root commits) and handle the throw.
	return execFileSync('git', args, {
		cwd: ROOT,
		encoding: 'utf8',
		maxBuffer: 128 * 1024 * 1024,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

/** sha -> { email, subject, order }, plus the full-history index for sorting. */
export function loadHistory() {
	const commits = new Map();
	const raw = git(['log', '--format=%H%x1f%ae%x1f%s']).split('\n');
	raw.forEach((line, index) => {
		const [id, email, subject] = line.trim().split('\x1f');
		if (id) {
			// Newest-first, so a HIGHER index is OLDER.
			commits.set(id, { id, email, subject, order: raw.length - index });
		}
	});
	return commits;
}

/**
 * GitHub handles, derived from the changelogs themselves rather than guessed:
 * every existing bullet pairs a commit sha with the handle git-cliff resolved
 * from the GitHub API, so joining that against `git log` yields an exact
 * email -> handle map for this history.
 */
export function buildHandleMap(history) {
	const shaToHandle = new Map();
	for (const key of Object.keys(PACKAGES)) {
		let text;
		try {
			text = readFileSync(join(ROOT, 'packages', key, 'CHANGELOG.md'), 'utf8');
		} catch {
			continue;
		}
		for (const m of text.matchAll(
			/\(by @([^)]+)\) \(\[[0-9a-f]{7}\]\([^)]*\/commit\/([0-9a-f]+)\)\)/gu,
		)) {
			shaToHandle.set(m[2], m[1]);
		}
	}
	const emailToHandle = new Map();
	for (const [sha, handle] of shaToHandle) {
		const commit = history.get(sha);
		if (commit && !emailToHandle.has(commit.email)) {
			emailToHandle.set(commit.email, handle);
		}
	}
	return emailToHandle;
}

/**
 * version -> the commit that set `packages/<pkg>/package.json` to it, i.e. the
 * release commit. Detected as a CHANGE (this commit's version differs from its
 * first parent's), and the newest such commit wins: versions from the retired
 * global `v*` scheme sat in package.json for months before the per-package tag
 * that finally shipped them.
 */
export function versionCommits(dir) {
	const path = `${dir}/package.json`;
	const commits = git(['log', '--format=%H', '--', path])
		.split('\n')
		.map((c) => c.trim())
		.filter(Boolean);
	const versionAt = (ref) => {
		try {
			return JSON.parse(git(['show', `${ref}:${path}`])).version ?? null;
		} catch {
			return null;
		}
	};
	const map = new Map();
	// Newest-first: the first change we see for a version is the newest one.
	for (const commit of commits) {
		const here = versionAt(commit);
		if (!here || map.has(here)) {
			continue;
		}
		if (here !== versionAt(`${commit}^`)) {
			map.set(here, commit);
		}
	}
	return map;
}

/**
 * `<npm>@<version>` -> the release commit that announced it, read out of the
 * ROOT changelog's own history. Every release run prepends one dated section
 * whose `_Releases:` line names exactly the tags that run cut, in the SAME
 * commit that the tag was then placed on. So the root file is the index that
 * makes the per-package files recoverable, and unlike tags it cannot be culled.
 */
export function releaseCommitsFromRootChangelog() {
	const map = new Map();
	const commits = git(['log', '--format=%H', '--', 'CHANGELOG.md'])
		.split('\n')
		.map((c) => c.trim())
		.filter(Boolean);
	for (const commit of commits) {
		const diff = git(['show', commit, '--format=', '--unified=0', '--', 'CHANGELOG.md']);
		for (const line of diff.split('\n')) {
			if (!line.startsWith('+_Releases:')) {
				continue;
			}
			const list = line.slice('+_Releases:'.length).replace(/_\s*$/u, '').trim();
			for (const tag of list.split(',').map((t) => t.trim())) {
				if (tag && !map.has(tag)) {
					map.set(tag, commit);
				}
			}
		}
	}
	return map;
}

/**
 * Range boundary for a version, in order of trust: the git tag, then the root
 * changelog's release index, then the package.json version-change commit.
 * Returns null rather than guessing.
 */
export function resolveBoundary(npm, version, fromPackageJson, fromRoot) {
	try {
		return git(['rev-list', '-1', `refs/tags/${npm}@${version}`]).trim();
	} catch {
		return fromRoot?.get(`${npm}@${version}`) ?? fromPackageJson.get(version) ?? null;
	}
}

/** sha -> position in the oldest-first revwalk of `from..to`. */
export function rangeOrder(from, to) {
	const order = new Map();
	git(['log', '--reverse', '--format=%H', `${from}..${to}`])
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.forEach((sha, index) => order.set(sha, index));
	return order;
}

/** Commits in `from..to` touching `paths`, oldest first. */
export function rangeCommits(from, to, paths, history, handles) {
	const raw = git(['log', '--reverse', '--format=%H', `${from}..${to}`, '--', ...paths]);
	return raw
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.map((id) => {
			const commit = history.get(id);
			return { id, subject: commit?.subject ?? '', username: handles.get(commit?.email) };
		});
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function sectionPlan(key, history, handles, rootIndex) {
	const meta = PACKAGES[key];
	const dir = `packages/${key}`;
	const file = join(ROOT, dir, 'CHANGELOG.md');
	const text = readFileSync(file, 'utf8');
	const sections = parseSections(text);
	const fromPkgJson = versionCommits(dir);
	const fromRoot = rootIndex ?? releaseCommitsFromRootChangelog();

	const plan = sections.map((section, index) => {
		const previous = sections[index + 1];
		const to = resolveBoundary(meta.npm, section.version, fromPkgJson, fromRoot);
		// No previous section means no honest lower bound: these files were
		// created mid-history, so the oldest heading is not a first release.
		const from = previous
			? resolveBoundary(meta.npm, previous.version, fromPkgJson, fromRoot)
			: null;
		const resolvable = Boolean(to) && Boolean(from);
		return {
			...section,
			from,
			to,
			resolvable,
			rendered: resolvable ? renderBody(rangeCommits(from, to, meta.paths, history, handles)) : '',
		};
	});
	return { file, text, sections: plan };
}

/**
 * Template fidelity, isolated from the path filter: re-render each shipped
 * section from the commits it already names and require an exact match.
 */
function validateTemplate(keys, history, handles, rootIndex) {
	let checked = 0;
	let exact = 0;
	const mismatches = [];
	for (const key of keys) {
		const { sections } = sectionPlan(key, history, handles, rootIndex);
		for (const section of sections) {
			if (section.empty) {
				continue;
			}
			// Order the section's own commits the way the backfill orders them:
			// the revwalk over that section's range, not a global log index. The
			// two disagree for a handful of date-skewed commits, and the range
			// walk is what git-cliff itself used.
			const order = section.resolvable ? rangeOrder(section.from, section.to) : null;
			const rank = (sha) => (order?.has(sha) ? order.get(sha) : (history.get(sha)?.order ?? 0));
			const commits = section.shas
				.map((sha) => history.get(sha))
				.filter(Boolean)
				.sort((a, b) => rank(a.id) - rank(b.id))
				.map((c) => ({ id: c.id, subject: c.subject, username: handles.get(c.email) }));
			if (commits.length !== section.shas.length) {
				continue; // a sha no longer in history; nothing to prove either way
			}
			checked++;
			const rendered = renderBody(commits);
			if (rendered === section.text) {
				exact++;
			} else {
				mismatches.push({ key, version: section.version, expected: section.text, got: rendered });
			}
		}
	}
	console.log(`Template fidelity: ${exact}/${checked} shipped sections reproduced byte-for-byte.`);
	for (const m of mismatches.slice(0, 3)) {
		console.log(
			`\n--- MISMATCH ${m.key}@${m.version} ---\nEXPECTED:\n${m.expected}\n\nGOT:\n${m.got}`,
		);
	}
	return { checked, exact, mismatches };
}

/** Agreement between the tag boundary and the package.json boundary. */
function validateRanges(keys) {
	let agree = 0;
	let disagree = 0;
	let noTag = 0;
	const bad = [];
	for (const key of keys) {
		const meta = PACKAGES[key];
		const map = versionCommits(`packages/${key}`);
		for (const [version, commit] of map) {
			let tagged;
			try {
				tagged = git(['rev-list', '-1', `refs/tags/${meta.npm}@${version}`]).trim();
			} catch {
				noTag++;
				continue;
			}
			if (tagged === commit) {
				agree++;
			} else {
				disagree++;
				if (bad.length < 8) {
					bad.push(`${meta.npm}@${version}`);
				}
			}
		}
	}
	console.log(`Range boundaries: agree=${agree} disagree=${disagree} noTagToCompare=${noTag}`);
	if (bad.length > 0) {
		console.log(`disagreements: ${bad.join(', ')}`);
	}
	return { agree, disagree, noTag };
}

function backfill(keys, history, handles, rootIndex, { write }) {
	const totals = { empty: 0, filled: 0, stayEmpty: 0, noRange: 0 };
	for (const key of keys) {
		const { file, text, sections } = sectionPlan(key, history, handles, rootIndex);
		const fills = [];
		let stayEmpty = 0;
		let noRange = 0;
		for (const section of sections) {
			if (!section.empty) {
				continue;
			}
			totals.empty++;
			if (!section.resolvable) {
				noRange++;
			} else if (section.rendered === '') {
				stayEmpty++;
			} else {
				fills.push({ headingLine: section.headingLine, body: section.rendered });
			}
		}
		totals.filled += fills.length;
		totals.stayEmpty += stayEmpty;
		totals.noRange += noRange;
		console.log(
			`${key.padEnd(8)} fill=${String(fills.length).padStart(3)} ` +
				`noInScopeCommits=${String(stayEmpty).padStart(2)} noRange=${String(noRange).padStart(2)}`,
		);
		if (write && fills.length > 0) {
			writeFileSync(file, applyFills(text, fills));
		}
	}
	console.log(
		`\nTOTAL empty=${totals.empty} filled=${totals.filled} ` +
			`stayEmpty=${totals.stayEmpty} noRange=${totals.noRange}${write ? ' (written)' : ' (dry run)'}`,
	);
	return totals;
}

/**
 * THE GATE. Compare every per-package changelog in the working tree against the
 * same file at HEAD and prove the edit was only-fill:
 *   - the heading sequence is identical (nothing added, removed or reordered);
 *   - every section that had content at HEAD is byte-identical now;
 *   - only sections that were empty at HEAD may have gained anything.
 * Exits non-zero on the first violation, so a bad render cannot be committed on
 * the strength of a spot-check alone.
 */
export function verifyOnlyFill(keys) {
	const violations = [];
	for (const key of keys) {
		const path = `packages/${key}/CHANGELOG.md`;
		let before;
		try {
			before = parseSections(git(['show', `HEAD:${path}`]));
		} catch {
			continue;
		}
		const after = parseSections(readFileSync(join(ROOT, path), 'utf8'));
		if (before.length !== after.length) {
			violations.push(`${path}: section count ${before.length} -> ${after.length}`);
			continue;
		}
		before.forEach((section, index) => {
			const now = after[index];
			if (section.version !== now.version || section.date !== now.date) {
				violations.push(
					`${path}: heading ${index} changed (${section.version} ${section.date} -> ${now.version} ${now.date})`,
				);
			} else if (!section.empty && section.text !== now.text) {
				violations.push(
					`${path}: section ${section.version} already had content and was REWRITTEN`,
				);
			}
		});
	}
	if (violations.length > 0) {
		console.log('ONLY-FILL VIOLATED:');
		for (const v of violations) {
			console.log(`  ${v}`);
		}
		return false;
	}
	console.log(`Only-fill verified against HEAD for ${keys.length} changelog(s).`);
	return true;
}

function main() {
	const args = process.argv.slice(2);
	const named = args.filter((a) => !a.startsWith('--'));
	const keys = named.length > 0 ? named : Object.keys(PACKAGES);
	const history = loadHistory();
	const handles = buildHandleMap(history);
	const rootIndex = releaseCommitsFromRootChangelog();
	if (args.includes('--verify')) {
		process.exit(verifyOnlyFill(keys) ? 0 : 1);
	}
	if (args.includes('--validate-ranges')) {
		const { disagree } = validateRanges(keys);
		process.exit(disagree === 0 ? 0 : 1);
	}
	if (args.includes('--validate-template')) {
		const { checked, exact } = validateTemplate(keys, history, handles, rootIndex);
		process.exit(checked === exact ? 0 : 1);
	}
	backfill(keys, history, handles, rootIndex, { write: args.includes('--write') });
}

if (process.argv[1]?.endsWith('backfill-changelog-sections.mjs')) {
	main();
}
