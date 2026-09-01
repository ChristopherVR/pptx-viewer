import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractScopedBlocks, mergeScopedCss } from './vue-css-merge.mjs';

test('keeps only rules whose selector carries a [data-v-*] scope attribute', () => {
	const css =
		'.pptx-vue-viewer{display:flex}' +
		'.pptx-vue-annotation-overlay[data-v-abc123]{position:absolute;inset:0}';
	assert.equal(
		extractScopedBlocks(css),
		'.pptx-vue-annotation-overlay[data-v-abc123]{position:absolute;inset:0}',
	);
});

test('keeps an at-rule block whole when a nested rule is scoped', () => {
	const css =
		'@media (max-width:767px){.pptx-vue-toolbar{gap:.5rem}}' +
		'@media (max-width:767px){.pptx-vue-thing[data-v-xyz]{display:none}}';
	const result = extractScopedBlocks(css);
	assert.ok(result.includes('data-v-xyz'));
	assert.ok(!result.includes('.pptx-vue-toolbar'));
});

test('returns nothing when no rule is scoped', () => {
	assert.equal(extractScopedBlocks('.pptx-vue-viewer{display:flex}'), '');
});

test('mergeScopedCss appends the scoped rules after the Tailwind output', () => {
	const merged = mergeScopedCss('.absolute{position:absolute}', '.foo[data-v-1]{color:red}');
	assert.ok(merged.startsWith('.absolute{position:absolute}'));
	assert.ok(merged.includes('.foo[data-v-1]{color:red}'));
});

test('mergeScopedCss refuses to ship a build with no scoped rules at all', () => {
	assert.throws(() => mergeScopedCss('.absolute{position:absolute}', ''), /data-v-/);
});
