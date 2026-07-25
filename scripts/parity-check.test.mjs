import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyse, COMMENT_MARKER, renderReport } from './parity-check.mjs';

const ids = (files) => analyse(files).findings.map((f) => f.id);

test('a core-only change raises nothing', () => {
	assert.deepEqual(ids(['packages/core/src/core/runtime/parse.ts']), []);
});

test('a docs-only change raises nothing', () => {
	assert.deepEqual(ids(['README.md', 'docs/guide/index.md']), []);
});

test('one binding touched flags partial coverage', () => {
	const found = ids(['packages/react/src/viewer/components/Ribbon.tsx']);
	assert.ok(found.includes('partial-bindings'));
});

test('all five bindings plus shared, tests and e2e raises nothing', () => {
	const files = [
		'packages/shared/src/render/thing.ts',
		'packages/shared/src/render/thing.test.ts',
		...['react', 'vue', 'angular', 'svelte', 'vanilla'].flatMap((b) => [
			`packages/${b}/src/thing.ts`,
			`packages/${b}/src/thing.test.ts`,
		]),
		'e2e/thing.spec.ts',
	];
	assert.deepEqual(ids(files), []);
});

test('test-only edits in a binding do not count as touching it', () => {
	assert.deepEqual(ids(['packages/react/src/viewer/Ribbon.test.tsx']), []);
});

test('two bindings without shared flags duplicated logic', () => {
	const found = ids(['packages/react/src/a.tsx', 'packages/vue/src/a.vue']);
	assert.ok(found.includes('no-shared'));
});

test('a capture spec does not satisfy the e2e requirement', () => {
	const found = ids(['packages/react/src/a.tsx', 'e2e/capture-docs-shots.spec.ts']);
	assert.ok(found.includes('no-e2e'));
});

test('a product spec does satisfy the e2e requirement', () => {
	const found = ids(['packages/react/src/a.tsx', 'e2e/viewer-basics.spec.ts']);
	assert.ok(!found.includes('no-e2e'));
});

test('english keys without locales are flagged', () => {
	const found = ids(['packages/shared/src/i18n/translations-en.ts']);
	assert.ok(found.includes('missing-locales'));
});

test('english keys with locales are not flagged', () => {
	const found = ids([
		'packages/shared/src/i18n/translations-en.ts',
		'packages/locales/src/de/index.ts',
		'packages/locales/src/es/index.ts',
		'packages/locales/src/fr/index.ts',
	]);
	assert.ok(!found.includes('missing-locales'));
});

test('renderReport returns null when there is nothing to say', () => {
	assert.equal(renderReport(analyse(['README.md'])), null);
});

test('renderReport emits the sticky marker and every binding row', () => {
	const report = renderReport(analyse(['packages/react/src/a.tsx']));
	assert.ok(report.startsWith(COMMENT_MARKER));
	for (const label of ['React', 'Vue', 'Angular', 'Svelte', 'Vanilla']) {
		assert.ok(report.includes(`| ${label} |`), `missing row for ${label}`);
	}
});
