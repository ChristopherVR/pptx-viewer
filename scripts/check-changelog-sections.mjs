/**
 * Guard: no changelog section may be a stub.
 *
 * Every CHANGELOG.md in this repo is PREPEND-ONLY. Old tags are culled weekly by
 * prune-releases.mjs, so a changelog can never be regenerated from tag history
 * without permanently losing the sections whose tags are gone. That makes a bad
 * section written by the release pipeline effectively permanent: the only way
 * out is a hand edit, which is exactly the operation the prepend-only rule
 * exists to avoid.
 *
 * The failure this catches actually happened. The hourly Release run bumps a
 * package whenever it changed since its own tag; when the only qualifying
 * package is a framework binding whose build then fails, the workflow reverts
 * the bump and drops it from the plan (release.yml, "Drop build-failed packages"),
 * leaving nothing to release. The root-changelog step ran anyway and prepended
 *
 *   ## 2026-08-13
 *
 *   _Releases: _
 *
 * a dated section that documents nothing, once an hour, for as long as the build
 * stayed broken. Seven accumulated in CHANGELOG.md.
 *
 * Two invariants, both cheap:
 *   1. No section anywhere declares an EMPTY release list (`_Releases: _`).
 *   2. Every dated section in the root changelog declares a release list at all.
 *
 * Usage: node scripts/check-changelog-sections.mjs [file...]
 *   With no arguments it checks CHANGELOG.md and packages/<pkg>/CHANGELOG.md.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A dated root section: `## 2026-08-13`. Per-package headings are versioned. */
const DATED_HEADING_RE = /^##\s+\d{4}-\d{2}-\d{2}\s*$/u;
/** The root changelog's release-list line, e.g. `_Releases: pptx-viewer-core@2.3.6_`. */
const RELEASES_RE = /^_Releases:(?<list>.*)_$/u;

/**
 * Split changelog text into sections: everything from one `## ` heading up to
 * (excluding) the next one. Text above the first heading is the file header and
 * is not a section.
 */
export function parseSections(text) {
	const lines = text.split('\n');
	const sections = [];
	let current = null;
	lines.forEach((line, index) => {
		if (line.startsWith('## ')) {
			current = { heading: line.trim(), line: index + 1, body: [] };
			sections.push(current);
		} else if (current) {
			current.body.push(line);
		}
	});
	return sections;
}

/**
 * Problems with one parsed section, as plain strings. A section is a stub when
 * it announces a release run that released nothing.
 */
export function sectionProblems(section, { requireReleases }) {
	const problems = [];
	const releaseLines = section.body
		.map((l) => RELEASES_RE.exec(l.trim()))
		.filter((m) => m !== null);

	if (releaseLines.some((m) => m.groups.list.trim().length === 0)) {
		problems.push(
			'declares an empty release list (`_Releases: _`), so it documents nothing. ' +
				'A release run that released no package must not write a section at all.',
		);
	}

	if (requireReleases && DATED_HEADING_RE.test(section.heading) && releaseLines.length === 0) {
		problems.push('is a dated section with no `_Releases: ..._` line naming what it released.');
	}

	return problems;
}

/** Every problem in one changelog file. `requireReleases` applies to the root. */
export function checkChangelog(text, { requireReleases = false } = {}) {
	return parseSections(text).flatMap((section) =>
		sectionProblems(section, { requireReleases }).map((problem) => ({
			line: section.line,
			heading: section.heading,
			problem,
		})),
	);
}

/** Root changelog plus every packages/<pkg>/CHANGELOG.md that exists. */
export function changelogFiles(root = ROOT) {
	const files = [];
	const rootChangelog = join(root, 'CHANGELOG.md');
	if (existsSync(rootChangelog)) {
		files.push(rootChangelog);
	}
	const packagesDir = join(root, 'packages');
	if (existsSync(packagesDir)) {
		for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			const candidate = join(packagesDir, entry.name, 'CHANGELOG.md');
			if (existsSync(candidate)) {
				files.push(candidate);
			}
		}
	}
	return files;
}

function main() {
	const files = process.argv.slice(2);
	const targets = files.length > 0 ? files : changelogFiles();
	let failures = 0;

	for (const file of targets) {
		const isRoot = relative(ROOT, file) === 'CHANGELOG.md';
		const findings = checkChangelog(readFileSync(file, 'utf8'), { requireReleases: isRoot });
		for (const { line, heading, problem } of findings) {
			failures++;
			console.log(`::error file=${relative(ROOT, file)},line=${line}::${heading} ${problem}`);
		}
	}

	if (failures > 0) {
		console.log(
			`\n${failures} stub changelog section(s). Changelogs here are prepend-only ` +
				'(prune-releases.mjs culls the tags they were generated from), so these cannot be ' +
				'regenerated away: fix the release pipeline, then remove exactly the stub sections by hand.',
		);
		process.exit(1);
	}

	console.log(`OK: ${targets.length} changelog(s) checked, no stub sections.`);
}

if (process.argv[1]?.endsWith('check-changelog-sections.mjs')) {
	main();
}
