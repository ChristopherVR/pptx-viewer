import assert from 'node:assert/strict';
import { test } from 'node:test';

import { installDevViewerHandle } from '../demos/dev-viewer-handle.ts';

test('development handles follow the current viewer and clean up their own installation', () => {
	const previousWindow = globalThis.window;
	globalThis.window = {};
	try {
		let viewer = null;
		const remove = installDevViewerHandle(() => viewer, true);
		assert.equal(window.__pptxViewer, null);
		viewer = { name: 'first' };
		assert.equal(window.__pptxViewer, viewer);
		viewer = { name: 'replacement' };
		assert.equal(window.__pptxViewer, viewer);
		const replacement = {};
		const removeReplacement = installDevViewerHandle(() => replacement, true);
		remove();
		assert.equal(window.__pptxViewer, replacement);
		removeReplacement();
		assert.equal(Object.hasOwn(window, '__pptxViewer'), false);
	} finally {
		if (previousWindow === undefined) {
			Reflect.deleteProperty(globalThis, 'window');
		} else {
			globalThis.window = previousWindow;
		}
	}
});

test('production and server rendering never expose a development handle', () => {
	const previousWindow = globalThis.window;
	try {
		Reflect.deleteProperty(globalThis, 'window');
		assert.doesNotThrow(() => installDevViewerHandle(() => ({}), true)());
		globalThis.window = {};
		const remove = installDevViewerHandle(() => ({}), false);
		assert.equal(Object.hasOwn(window, '__pptxViewer'), false);
		remove();
		assert.equal(Object.hasOwn(window, '__pptxViewer'), false);
	} finally {
		if (previousWindow === undefined) {
			Reflect.deleteProperty(globalThis, 'window');
		} else {
			globalThis.window = previousWindow;
		}
	}
});
