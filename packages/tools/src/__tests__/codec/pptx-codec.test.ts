import { describe, it, expect, expectTypeOf } from 'vitest';
import { Doc as YDoc } from 'yjs';

import { PptxCodec, ORIGIN_FILE_LOAD } from '../../codec/index.js';

describe('pptxCodec', () => {
	it('has correct formatId and extensions', () => {
		const codec = new PptxCodec();
		expect(codec.formatId).toBe('pptx');
		expect(codec.extensions).toContain('.pptx');
		expect(codec.extensions).toContain('.ppt');
	});

	it('exports ORIGIN_FILE_LOAD constant', () => {
		expect(ORIGIN_FILE_LOAD).toBe('file-load');
	});

	it('observe returns unsubscribe function', () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		let called = false;
		const unsub = codec.observe(ydoc, () => {
			called = true;
		});
		expectTypeOf(unsub).toBeFunction();

		// Trigger a change
		ydoc.getMap('pptx:meta').set('test', 'value');
		expect(called).toBeTruthy();

		// Unsubscribe
		unsub();
		called = false;
		ydoc.getMap('pptx:meta').set('test2', 'value2');
		// After unsubscribe, callback should not be called
		// (Yjs observe is synchronous, so this check is valid)
		expect(called).toBeFalsy();
	});
});
