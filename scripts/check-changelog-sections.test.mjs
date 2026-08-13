import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { test } from 'node:test';

import { changelogFiles, checkChangelog, parseSections } from './check-changelog-sections.mjs';

/** The exact stub the hourly release run prepended seven times. */
const STUB = ['## 2026-08-13', '', '_Releases: _', ''].join('\n');

const REAL = [
	'## 2026-08-13',
	'',
	'_Releases: pptx-viewer-core@2.3.6, pptx-react-viewer@2.18.0_',
	'',
	'### Bug Fixes',
	'',
	'- **core:** Stop save rewriting what the author never wrote',
	'',
].join('\n');

const HEADER = ['# Changelog', '', 'All notable changes are documented here.', ''].join('\n');

test('parseSections splits on ## headings and ignores the file header', () => {
	const sections = parseSections(`${HEADER}${REAL}${STUB}`);
	assert.equal(sections.length, 2);
	assert.equal(sections[0].heading, '## 2026-08-13');
	assert.ok(sections[0].body.some((l) => l.startsWith('_Releases: pptx-viewer-core')));
	assert.ok(sections[1].body.includes('_Releases: _'));
});

test('a section with an empty release list is rejected', () => {
	const findings = checkChangelog(HEADER + STUB, { requireReleases: true });
	assert.equal(findings.length, 1);
	assert.match(findings[0].problem, /empty release list/u);
	assert.equal(findings[0].heading, '## 2026-08-13');
});

test('a real section with the same date is accepted', () => {
	assert.deepEqual(checkChangelog(HEADER + REAL, { requireReleases: true }), []);
});

test('two real sections sharing a date are both accepted', () => {
	// Two releases can legitimately run on one day, so same-date sections are
	// NOT the defect; only an empty release list is.
	const sameDay = REAL + REAL;
	assert.deepEqual(checkChangelog(HEADER + sameDay, { requireReleases: true }), []);
	assert.equal(parseSections(HEADER + sameDay).length, 2);
});

test('a dated root section with no release line at all is rejected', () => {
	const orphan = ['## 2026-08-13', '', '### Bug Fixes', '', '- **core:** Something', ''].join('\n');
	const findings = checkChangelog(HEADER + orphan, { requireReleases: true });
	assert.equal(findings.length, 1);
	assert.match(findings[0].problem, /no `_Releases/u);
});

test('per-package sections are version-headed, so the release-line rule does not apply', () => {
	const perPackage = [
		'## [2.19.0](https://example.invalid/tag/pptx-vue-viewer@2.19.0) - 2026-08-13',
		'',
		'### Bug Fixes',
		'',
		'- **core:** Stop save rewriting what the author never wrote',
		'',
	].join('\n');
	assert.deepEqual(checkChangelog(HEADER + perPackage), []);
	// ... but a stub release list is rejected in any changelog.
	assert.equal(checkChangelog(HEADER + STUB).length, 1);
});

test('every changelog in the repo is free of stub sections', () => {
	const files = changelogFiles();
	assert.ok(files.length >= 2, 'expected the root changelog and at least one package changelog');
	// changelogFiles() lists the root changelog first; only it carries release lines.
	const [rootChangelog] = files;
	const failures = files.flatMap((file) =>
		checkChangelog(readFileSync(file, 'utf8'), {
			requireReleases: file === rootChangelog,
		}).map(
			({ line, heading, problem }) =>
				`${relative(process.cwd(), file)}:${line} ${heading} ${problem}`,
		),
	);
	assert.deepEqual(failures, []);
});
