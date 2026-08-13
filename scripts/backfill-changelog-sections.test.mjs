import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	applyFills,
	classify,
	COMMIT_PARSERS,
	groupHeading,
	parseSections,
	preprocess,
	renderBody,
	renderBullet,
} from './backfill-changelog-sections.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const commit = (id, subject, username = 'ChristopherVR') => ({ id, subject, username });

// ---------------------------------------------------------------------------
// The only-fill guarantee. This is the property the whole repair rests on:
// a fill may only INSERT under a heading, never touch anything else.
// ---------------------------------------------------------------------------

test('applyFills inserts under the named heading and changes nothing else', () => {
	const before = [
		'# Changelog',
		'',
		'## [2.0.0](x) - 2026-08-01',
		'',
		'## [1.9.0](x) - 2026-07-01',
		'',
		'### Bug Fixes',
		'',
		'- **core:** Existing entry',
		'',
	].join('\n');
	const after = applyFills(before, [
		{ headingLine: 2, body: '### Features\n\n- **core:** New entry' },
	]);

	// Every original line survives, in order.
	const originalLines = before.split('\n');
	const afterLines = after.split('\n');
	let cursor = 0;
	for (const line of originalLines) {
		const found = afterLines.indexOf(line, cursor);
		assert.notEqual(found, -1, `original line vanished: ${JSON.stringify(line)}`);
		cursor = found + 1;
	}
	// The section that already had content is untouched.
	const sections = parseSections(after);
	assert.equal(sections.length, 2);
	assert.equal(sections[1].text, '### Bug Fixes\n\n- **core:** Existing entry');
	assert.equal(sections[0].text, '### Features\n\n- **core:** New entry');
});

test('applyFills never reorders or drops a heading', () => {
	const before = ['## [3.0.0](x) - 2026-08-01', '', '## [2.0.0](x) - 2026-07-01', ''].join('\n');
	const after = applyFills(before, [{ headingLine: 0, body: '### Features\n\n- Something' }]);
	const headings = parseSections(after).map((s) => s.version);
	assert.deepEqual(headings, ['3.0.0', '2.0.0']);
});

test('a fill list that names no section is a no-op', () => {
	const before = '## [1.0.0](x) - 2026-01-01\n\n### Chores\n\n- Kept\n';
	assert.equal(applyFills(before, []), before);
});

// ---------------------------------------------------------------------------
// Template fidelity, unit level. `--validate-template` proves it against 231
// shipped sections; these pin the individual rules it depends on.
// ---------------------------------------------------------------------------

test('COMMIT_PARSERS mirrors cliff.toml', () => {
	const toml = readFileSync(join(ROOT, 'cliff.toml'), 'utf8');
	const groups = [...toml.matchAll(/group\s*=\s*"(<!--\s*\d+\s*-->[^"]+)"/gu)].map((m) => m[1]);
	const mine = COMMIT_PARSERS.filter((p) => p.group).map((p) => p.group);
	for (const group of mine) {
		assert.ok(groups.includes(group), `cliff.toml has no group "${group}"`);
	}
	// cliff.toml's Security parser keys off the BODY, which this renderer does
	// not read; every other group must be represented.
	const missing = groups.filter((g) => !mine.includes(g) && !/Security/u.test(g));
	assert.deepEqual(missing, []);
});

test('classify drops what git-cliff drops', () => {
	assert.equal(classify('Merge branch "main" of https://example.invalid'), null);
	assert.equal(classify('chore(release): bump versions and update changelogs [skip ci]'), null);
	assert.equal(classify('not a conventional commit'), null);
});

test('classify picks the first matching parser', () => {
	// `chore(deps)` is Dependencies, but `chore(deps-dev)` falls through to Chores.
	assert.equal(classify('chore(deps): update x').group, '<!-- 8 -->Dependencies');
	assert.equal(classify('chore(deps-dev): bump y').group, '<!-- 9 -->Chores');
	assert.equal(classify('feat(shared): a thing').group, '<!-- 0 -->Features');
	assert.equal(classify('ci(docs): a thing').group, '<!-- 6 -->Build & CI');
});

test('classify keeps the scope and upper-cases the description', () => {
	const c = classify('fix(react,vue): wire the surfaces that rendered without acting');
	assert.equal(c.scope, 'react,vue');
	assert.equal(c.message, 'Wire the surfaces that rendered without acting');
});

test('a breaking marker does not change the group', () => {
	assert.equal(classify('feat(core)!: drop the old API').group, '<!-- 0 -->Features');
});

test('preprocess links issue references', () => {
	assert.match(
		preprocess('chore(deps): update dompurify (#151)'),
		/\(\[#151\]\(.*\/issues\/151\)\)/u,
	);
	assert.equal(preprocess('fix(core): no refs here'), 'fix(core): no refs here');
});

test('groupHeading strips the sort key', () => {
	assert.equal(groupHeading('<!-- 6 -->Build & CI'), 'Build & CI');
});

test('renderBullet matches the shipped bullet shape', () => {
	assert.equal(
		renderBullet({
			scope: 'core',
			message: 'Stop save rewriting what the author never wrote',
			username: 'ChristopherVR',
			id: '6fb2767583de0e82747c3700e3311869dd693a1d',
		}),
		'- **core:** Stop save rewriting what the author never wrote (by @ChristopherVR) ' +
			'([6fb2767](https://github.com/ChristopherVR/pptx-viewer/commit/6fb2767583de0e82747c3700e3311869dd693a1d))',
	);
});

test('a scopeless commit renders without a bold prefix', () => {
	const bullet = renderBullet({
		scope: '',
		message: 'Build issue',
		username: 'x',
		id: 'a'.repeat(40),
	});
	assert.ok(bullet.startsWith('- Build issue '), bullet);
});

test('renderBody orders groups by sort key and commits oldest-first', () => {
	const body = renderBody([
		commit('a'.repeat(40), 'test(e2e): older test'),
		commit('b'.repeat(40), 'fix(core): older fix'),
		commit('c'.repeat(40), 'fix(core): newer fix'),
		commit('d'.repeat(40), 'feat(shared): a feature'),
	]);
	const headings = [...body.matchAll(/^### (.+)$/gmu)].map((m) => m[1]);
	assert.deepEqual(headings, ['Features', 'Bug Fixes', 'Testing']);
	assert.ok(body.indexOf('Older fix') < body.indexOf('Newer fix'));
});

test('renderBody returns empty when nothing survives the parsers', () => {
	assert.equal(renderBody([commit('a'.repeat(40), 'Merge branch "x"')]), '');
	assert.equal(renderBody([]), '');
});

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test('parseSections finds headings, bodies and commit shas', () => {
	const text = [
		'# Changelog',
		'',
		'## [2.0.0](https://x/tag/p@2.0.0) - 2026-08-01',
		'',
		'### Bug Fixes',
		'',
		'- **core:** Thing ([abc1234](https://x/commit/abc1234def))',
		'',
		'## [1.0.0](https://x/tag/p@1.0.0) - 2026-07-01',
		'',
	].join('\n');
	const sections = parseSections(text);
	assert.equal(sections.length, 2);
	assert.equal(sections[0].version, '2.0.0');
	assert.equal(sections[0].date, '2026-08-01');
	assert.equal(sections[0].empty, false);
	assert.deepEqual(sections[0].shas, ['abc1234def']);
	assert.equal(sections[1].empty, true);
});
