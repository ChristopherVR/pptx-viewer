import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findDanglingRefs } from './check-published-shared-refs.mjs';

test('flags a bare import specifier', () => {
	assert.deepEqual(findDanglingRefs("import { ViewerMode } from 'pptx-viewer-shared';"), [
		"from 'pptx-viewer-shared'",
	]);
});

test('flags an export-from specifier', () => {
	assert.deepEqual(
		findDanglingRefs("export { parsePresentationSessionId } from 'pptx-viewer-shared';"),
		["from 'pptx-viewer-shared'"],
	);
});

test('flags a subpath specifier', () => {
	assert.deepEqual(findDanglingRefs("import type { Foo } from 'pptx-viewer-shared/render';"), [
		"from 'pptx-viewer-shared/render'",
	]);
});

test('flags a require() specifier (CJS declarations)', () => {
	assert.deepEqual(findDanglingRefs("import { X } from require('pptx-viewer-shared');"), [
		"require('pptx-viewer-shared'",
	]);
});

test('does not flag a plain-text comment mentioning the package name', () => {
	assert.deepEqual(findDanglingRefs('/** Bundled from pptx-viewer-shared at build time. */'), []);
});

test('does not flag an unrelated package with a similar prefix', () => {
	assert.deepEqual(findDanglingRefs("import { X } from 'pptx-viewer-shared-extra';"), []);
});

test('does not flag a clean declaration file', () => {
	assert.deepEqual(
		findDanglingRefs("import type { PptxSlide } from 'pptx-viewer-core';\nexport {};"),
		[],
	);
});

test('deduplicates repeated matches of the same specifier', () => {
	const source = [
		"import { A } from 'pptx-viewer-shared';",
		"import { B } from 'pptx-viewer-shared';",
	].join('\n');
	assert.deepEqual(findDanglingRefs(source), ["from 'pptx-viewer-shared'"]);
});
