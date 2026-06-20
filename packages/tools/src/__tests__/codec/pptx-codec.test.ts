import { PptxHandler } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { Doc as YDoc } from 'yjs';

import { PptxCodec, ORIGIN_FILE_LOAD } from '../../codec/index.js';
import { createTestPptxBytes } from '../helpers/create-test-pptx.js';

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

describe('pptxCodec hydrate', () => {
	it('hydrates a Y.Doc from real PPTX bytes', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(2);

		await codec.hydrate(ydoc, bytes);

		const meta = ydoc.getMap('pptx:meta');
		expect(meta.get('width')).toBeDefined();
		expect(meta.get('height')).toBeDefined();
		expectTypeOf(meta.get('width')).toBeNumber();
		expectTypeOf(meta.get('height')).toBeNumber();

		const slidesArray = ydoc.getArray('pptx:slides');
		expect(slidesArray).toHaveLength(2);
	});

	it('stores source bytes in meta', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(1);

		await codec.hydrate(ydoc, bytes);

		const meta = ydoc.getMap('pptx:meta');
		const sourceBytes = meta.get('sourceBytes');
		expect(sourceBytes).toBeDefined();
	});

	it('preserves slide data in Y.Doc', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(3);

		await codec.hydrate(ydoc, bytes);

		const slidesArray = ydoc.getArray('pptx:slides');
		expect(slidesArray).toHaveLength(3);

		// Each slide map should have an id
		for (let i = 0; i < slidesArray.length; i++) {
			const slideMap = slidesArray.get(i) as { get: (key: string) => unknown };
			expect(slideMap.get('id')).toBeTruthy();
		}
	});

	it('uses custom origin when provided', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(1);

		let capturedOrigin: unknown;
		ydoc.on('beforeTransaction', (tr: { origin: unknown }) => {
			capturedOrigin = tr.origin;
		});

		await codec.hydrate(ydoc, bytes, 'custom-origin');
		expect(capturedOrigin).toBe('custom-origin');
	});

	it('defaults to ORIGIN_FILE_LOAD origin', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(1);

		let capturedOrigin: unknown;
		ydoc.on('beforeTransaction', (tr: { origin: unknown }) => {
			capturedOrigin = tr.origin;
		});

		await codec.hydrate(ydoc, bytes);
		expect(capturedOrigin).toBe(ORIGIN_FILE_LOAD);
	});

	it('clears existing slides on re-hydrate', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();

		// First hydrate with 2 slides
		const bytes2 = await createTestPptxBytes(2);
		await codec.hydrate(ydoc, bytes2);
		expect(ydoc.getArray('pptx:slides')).toHaveLength(2);

		// Re-hydrate with 3 slides
		const bytes3 = await createTestPptxBytes(3);
		await codec.hydrate(ydoc, bytes3);
		expect(ydoc.getArray('pptx:slides')).toHaveLength(3);
	});
});

describe('pptxCodec dehydrate', () => {
	it('dehydrates Y.Doc back to PPTX bytes', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const originalBytes = await createTestPptxBytes(2);

		await codec.hydrate(ydoc, originalBytes);
		const outputBytes = await codec.dehydrate(ydoc);

		expect(outputBytes).toBeInstanceOf(Uint8Array);
		expect(outputBytes.length).toBeGreaterThan(0);
	});

	it('dehydrated bytes produce valid PPTX', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const originalBytes = await createTestPptxBytes(2);

		await codec.hydrate(ydoc, originalBytes);
		const outputBytes = await codec.dehydrate(ydoc);

		// Load the output to verify it's valid
		const handler = new PptxHandler();
		const pptxData = await handler.load(outputBytes.buffer as ArrayBuffer);
		expect(pptxData.slides).toHaveLength(2);
		expect(pptxData.width).toBeGreaterThan(0);
		expect(pptxData.height).toBeGreaterThan(0);
	});

	it('throws when no source bytes available', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		// Don't hydrate, just try to dehydrate an empty doc
		await expect(codec.dehydrate(ydoc)).rejects.toThrow();
	});
});

describe('pptxCodec fidelity', () => {
	it('round-trip preserves slide data deeply (load -> hydrate -> dehydrate -> reload)', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const originalBytes = await createTestPptxBytes(3);

		const handler1 = new PptxHandler();
		const originalData = await handler1.load(originalBytes.buffer as ArrayBuffer);

		await codec.hydrate(ydoc, originalBytes);
		const outputBytes = await codec.dehydrate(ydoc);

		const handler2 = new PptxHandler();
		const roundTripData = await handler2.load(outputBytes.buffer as ArrayBuffer);

		expect(roundTripData.slides).toHaveLength(originalData.slides.length);
		for (let i = 0; i < originalData.slides.length; i++) {
			const orig = originalData.slides[i];
			const rt = roundTripData.slides[i];
			expect(rt.id).toBe(orig.id);
			expect(rt.elements).toHaveLength(orig.elements.length);
			for (let j = 0; j < orig.elements.length; j++) {
				const origEl = orig.elements[j];
				const rtEl = rt.elements[j];
				expect(rtEl.type).toBe(origEl.type);
				expect(rtEl.id).toBe(origEl.id);
				// Text segments must round-trip through Y.Text with the same
				// count and text content (style key order may differ).
				if ('textSegments' in origEl && origEl.textSegments) {
					expect(rtEl).toHaveProperty('textSegments');
					const origSegs = origEl.textSegments as Array<{
						text?: string;
						isParagraphBreak?: boolean;
					}>;
					const rtSegs = (rtEl as typeof origEl).textSegments as typeof origSegs;
					expect(rtSegs).toHaveLength(origSegs.length);
					const origText = origSegs.map((s) => s.text ?? '').join('');
					const rtText = rtSegs.map((s) => s.text ?? '').join('');
					expect(rtText).toBe(origText);
				}
			}
		}
	});

	it('textBody Y.Text is present in element Y.Map for text elements', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(1);
		await codec.hydrate(ydoc, bytes);

		const slidesArray = ydoc.getArray('pptx:slides');
		for (let i = 0; i < slidesArray.length; i++) {
			const slideMap = slidesArray.get(i) as { get: (k: string) => unknown };
			const elemArr = slideMap.get('elements') as
				| { length: number; get: (i: number) => unknown }
				| undefined;
			if (!elemArr) {
				continue;
			}
			for (let j = 0; j < elemArr.length; j++) {
				const elemMap = elemArr.get(j) as { get: (k: string) => unknown };
				const type = elemMap.get('type');
				// If the element has a textBody, verify it's a Y.Text (has toDelta)
				const textBody = elemMap.get('textBody');
				if (textBody) {
					expect((textBody as { toDelta?: unknown }).toDelta).toBeTypeOf('function');
					// _textSegments JSON blob should NOT exist (replaced by textBody)
					expect(elemMap.get('_textSegments')).toBeUndefined();
				}
				expect(type).toBeDefined();
			}
		}
	});
});

describe('pptxCodec round-trip', () => {
	it('preserves slide count through round-trip', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const originalBytes = await createTestPptxBytes(3);

		// Load original
		const handler1 = new PptxHandler();
		const originalData = await handler1.load(originalBytes.buffer as ArrayBuffer);

		// Round-trip through codec
		await codec.hydrate(ydoc, originalBytes);
		const roundTrippedBytes = await codec.dehydrate(ydoc);

		const handler2 = new PptxHandler();
		const roundTrippedData = await handler2.load(roundTrippedBytes.buffer as ArrayBuffer);

		expect(roundTrippedData.slides).toHaveLength(originalData.slides.length);
	});

	it('preserves canvas dimensions through round-trip', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const originalBytes = await createTestPptxBytes(1);

		const handler1 = new PptxHandler();
		const originalData = await handler1.load(originalBytes.buffer as ArrayBuffer);

		await codec.hydrate(ydoc, originalBytes);
		const roundTrippedBytes = await codec.dehydrate(ydoc);

		const handler2 = new PptxHandler();
		const roundTrippedData = await handler2.load(roundTrippedBytes.buffer as ArrayBuffer);

		expect(roundTrippedData.width).toBe(originalData.width);
		expect(roundTrippedData.height).toBe(originalData.height);
	});

	it('preserves element types through round-trip', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const originalBytes = await createTestPptxBytes(2);

		const handler1 = new PptxHandler();
		const originalData = await handler1.load(originalBytes.buffer as ArrayBuffer);

		await codec.hydrate(ydoc, originalBytes);
		const roundTrippedBytes = await codec.dehydrate(ydoc);

		const handler2 = new PptxHandler();
		const roundTrippedData = await handler2.load(roundTrippedBytes.buffer as ArrayBuffer);

		for (let i = 0; i < originalData.slides.length; i++) {
			const origElements = originalData.slides[i].elements;
			const rtElements = roundTrippedData.slides[i].elements;
			expect(rtElements).toHaveLength(origElements.length);
			for (let j = 0; j < origElements.length; j++) {
				expect(rtElements[j].type).toBe(origElements[j].type);
			}
		}
	});

	it('observe fires callback on Y.Doc slide changes', async () => {
		const codec = new PptxCodec();
		const ydoc = new YDoc();
		const bytes = await createTestPptxBytes(1);
		await codec.hydrate(ydoc, bytes);

		let callCount = 0;
		const unsub = codec.observe(ydoc, () => {
			callCount++;
		});

		// Modify a slide in the Y.Doc
		const slidesArray = ydoc.getArray('pptx:slides');
		const slideMap = slidesArray.get(0) as { set: (k: string, v: unknown) => void };
		slideMap.set('notes', 'Updated notes');

		expect(callCount).toBeGreaterThan(0);
		unsub();
	});
});
