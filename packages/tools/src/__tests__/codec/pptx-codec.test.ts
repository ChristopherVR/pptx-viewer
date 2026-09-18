import JSZip from 'jszip';
import { ELEMENT_FIELD_KIND, PptxHandler, SLIDE_FIELD_KIND } from 'pptx-viewer-core';
import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { Doc as YDoc, Array as YArray, Map as YMap, Text as YText } from 'yjs';

import {
	COMPLEX_FIELD_MAP,
	COMPLEX_SLIDE_FIELD_MAP,
	ORIGIN_FILE_LOAD,
	PptxCodec,
	SCALAR_ELEMENT_KEYS,
	SCALAR_SLIDE_KEYS,
} from '../../codec/index.js';
import { decodeTextBodyFromYText, encodeTextBodyToYText } from '../../codec/text-body-codec.js';
import { createTestPptxBytes } from '../helpers/create-test-pptx.js';

describe('text body codec', () => {
	it('preserves paragraph formatting without inheriting it into following runs', () => {
		const paragraphProperties: TextStyle = {
			align: 'right',
			paragraphMarginLeft: 54,
			paragraphMarginRight: 12,
			paragraphIndent: -18,
			lineSpacing: 1.5,
			paragraphSpacingBefore: 7,
			paragraphSpacingAfter: 13,
			tabStops: [{ position: 96, align: 'dec' }],
		};
		const segments: TextSegment[] = [
			{ text: 'First', style: {}, paragraphProperties },
			{ text: 'Unstyled', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{
				text: 'Second',
				style: {},
				paragraphProperties: {
					paragraphMarginLeft: 0,
					paragraphIndent: 0,
					lineSpacingExactPt: 30,
					paragraphSpacingBefore: 0,
					paragraphSpacingAfter: 0,
				},
			},
		];
		const doc = new YDoc();
		const text = doc.getText('body');
		encodeTextBodyToYText(segments, text);
		expect(decodeTextBodyFromYText(text)).toStrictEqual(segments);
		doc.destroy();
	});

	it('preserves independent paragraph properties on empty carriers and coalesced breaks', () => {
		const paragraphProperties: TextStyle = {
			paragraphSpacingAfter: 14,
			tabStops: [{ position: 72, align: 'l' }],
		};
		const segments: TextSegment[] = [
			{ text: '', style: {}, paragraphProperties },
			{ text: '', style: {}, isParagraphBreak: true, paragraphProperties },
			{ text: '', style: {}, isParagraphBreak: true, paragraphProperties },
		];
		const doc = new YDoc();
		const text = doc.getText('body');
		encodeTextBodyToYText(segments, text);
		expect(text.toDelta()).toHaveLength(2);
		const decoded = decodeTextBodyFromYText(text);
		expect(decoded).toStrictEqual(segments);
		const first = decoded[1].paragraphProperties as TextStyle;
		const second = decoded[2].paragraphProperties as TextStyle;
		expect(first).not.toBe(second);
		expect(first.tabStops).not.toBe(second.tabStops);
		first.tabStops![0].position = 10;
		expect(second.tabStops![0].position).toBe(72);
		expect(paragraphProperties.tabStops![0].position).toBe(72);
		doc.destroy();
	});

	it('ignores malformed paragraph-property JSON and leaves legacy deltas unchanged', () => {
		const doc = new YDoc();
		const text = doc.getText('body');
		text.insert(0, 'Body', { pp: '{invalid' });
		text.insert(4, 'Legacy', {});
		expect(decodeTextBodyFromYText(text)).toStrictEqual([
			{ text: 'Body', style: {} },
			{ text: 'Legacy', style: {} },
		]);
		doc.destroy();
	});

	it.each([
		{
			name: 'paragraph',
			flag: { isParagraphBreak: true },
			metadata: { paragraphLevel: 2, endParaRunProperties: { '@_sz': '1800' } },
		},
		{
			name: 'soft line',
			flag: { isLineBreak: true },
			metadata: { breakRunProperties: { '@_lang': 'ja-JP', '@_sz': '1800' } },
		},
	])('restores each coalesced $name break with independent metadata', ({ flag, metadata }) => {
		const doc = new YDoc();
		const text = doc.getText('text');
		const breakSegment = {
			text: '',
			style: { fontSize: 18, authoredRunStyle: { fontSize: 18 } },
			...flag,
			...metadata,
		};
		const segments = [
			{ text: 'before', style: {} },
			structuredClone(breakSegment),
			structuredClone(breakSegment),
			structuredClone(breakSegment),
			{ text: 'after', style: { bold: true } },
		];
		encodeTextBodyToYText(segments, text);
		expect(text.toDelta().map((op) => op.insert)).toStrictEqual(['before', '\n\n\n', 'after']);
		const decoded = decodeTextBodyFromYText(text);
		expect(decoded).toStrictEqual(segments);
		expect(decoded[1]).not.toBe(decoded[2]);
		expect(decoded[1].style).not.toBe(decoded[2].style);
		expect((decoded[1].style as Record<string, unknown>).authoredRunStyle).not.toBe(
			(decoded[2].style as Record<string, unknown>).authoredRunStyle,
		);
		for (const [key, value] of Object.entries(metadata)) {
			if (typeof value === 'object') {
				expect(decoded[1][key]).not.toBe(decoded[2][key]);
			}
		}
		const reencoded = doc.getText('reencoded');
		encodeTextBodyToYText(decoded, reencoded);
		expect(reencoded.toDelta()).toStrictEqual(text.toDelta());
		doc.destroy();
	});

	it.each([
		{ insert: '\n', attributes: undefined, expected: { text: '\n', style: {} } },
		{ insert: '\n\n', attributes: undefined, expected: { text: '\n\n', style: {} } },
		{ insert: 'A\n\nB', attributes: undefined, expected: { text: 'A\n\nB', style: {} } },
		{ insert: '\n\n', attributes: { pb: '0' }, expected: { text: '\n\n', style: {} } },
		{
			insert: '\nA\n',
			attributes: { pb: '1' },
			expected: { text: '\nA\n', style: {}, isParagraphBreak: true },
		},
		{
			insert: '\r\n',
			attributes: { lb: '1' },
			expected: { text: '\r\n', style: {}, isLineBreak: true },
		},
	])('preserves non-marker text for %j', ({ insert, attributes, expected }) => {
		const doc = new YDoc();
		const text = doc.getText('text');
		text.insert(0, insert, attributes);
		expect(decodeTextBodyFromYText(text)).toStrictEqual([expected]);
		doc.destroy();
	});
});

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
	it('saves and reopens paragraph formatting from a Y.Text', async () => {
		const codec = new PptxCodec();
		const doc = new YDoc();
		await codec.hydrate(doc, await createTestPptxBytes(1));
		const slide = doc.getArray<YMap<unknown>>('pptx:slides').get(0);
		const element = (slide.get('elements') as YArray<YMap<unknown>>).get(0);
		const text = element.get('textBody') as YText;
		const paragraphProperties: TextStyle = {
			align: 'right',
			paragraphMarginLeft: 54,
			paragraphMarginRight: 12,
			paragraphIndent: -18,
			lineSpacing: 1.5,
			paragraphSpacingBefore: 8,
			paragraphSpacingAfter: 16,
			tabStops: [{ position: 96, align: 'dec' }],
		};
		text.delete(0, text.length);
		encodeTextBodyToYText([{ text: 'Formatted paragraph', style: {}, paragraphProperties }], text);
		element.set('text', 'Formatted paragraph');
		const bytes = await codec.dehydrate(doc);
		const zip = await JSZip.loadAsync(bytes);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const body = xml.match(/<p:txBody>[\s\S]*?<\/p:txBody>/u)?.[0] ?? '';
		expect(body).toContain('marL="514350"');
		expect(body).toContain('marR="114300"');
		expect(body).toContain('indent="-171450"');
		expect(body).toContain('<a:spcPct val="150000"');
		expect(body).toContain('<a:spcBef><a:spcPts val="600"');
		expect(body).toContain('<a:spcAft><a:spcPts val="1200"');
		const handler = new PptxHandler();
		const data = await handler.load(bytes.buffer as ArrayBuffer);
		const reopened = data.slides[0].elements.find(
			(candidate) => candidate.id === element.get('id'),
		);
		if (!reopened || !('textSegments' in reopened)) {
			throw new Error('Expected the saved text element');
		}
		expect(reopened.textSegments?.[0].paragraphProperties).toMatchObject(paragraphProperties);
		await codec.hydrate(doc, bytes);
		const rehydratedSlide = doc.getArray<YMap<unknown>>('pptx:slides').get(0);
		const rehydratedElement = (rehydratedSlide.get('elements') as YArray<YMap<unknown>>).get(0);
		expect(
			decodeTextBodyFromYText(rehydratedElement.get('textBody') as YText)[0].paragraphProperties,
		).toMatchObject(paragraphProperties);
		handler.dispose();
		doc.destroy();
	});

	it.each(['pb', 'lb'])('saves and reopens consecutive %s breaks from a Y.Text', async (flag) => {
		const codec = new PptxCodec();
		const doc = new YDoc();
		await codec.hydrate(doc, await createTestPptxBytes(1));
		const slide = doc.getArray<YMap<unknown>>('pptx:slides').get(0);
		const elements = slide.get('elements') as YArray<YMap<unknown>>;
		const element = elements.get(0);
		const text = element.get('textBody') as YText;
		text.delete(0, text.length);
		text.insert(0, 'before', { s: JSON.stringify({ bold: true }) });
		text.insert(6, '\n\n\n', { [flag]: '1', s: JSON.stringify({ fontSize: 18 }) });
		text.insert(9, 'after', {});
		element.set('text', 'before\n\n\nafter');
		const bytes = await codec.dehydrate(doc);
		const zip = await JSZip.loadAsync(bytes);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const body = xml.match(/<p:txBody>[\s\S]*?<\/p:txBody>/u)?.[0] ?? '';
		expect(body.match(flag === 'pb' ? /<a:p(?:\s|\/|>)/gu : /<a:br(?:\s|\/|>)/gu)).toHaveLength(
			flag === 'pb' ? 4 : 3,
		);
		const data = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const reopened = data.slides[0].elements.find(
			(candidate) => candidate.id === element.get('id'),
		);
		expect(reopened).toBeDefined();
		if (!reopened || !('textSegments' in reopened)) {
			throw new Error('Expected the saved text element');
		}
		const segments = reopened.textSegments ?? [];
		expect(segments.map((segment) => segment.text).join('')).toBe('before\n\n\nafter');
		doc.destroy();
	});

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

describe('pptxCodec field-schema coverage', () => {
	it('scalar + complex element keys + textSegments cover every PptxElement field', () => {
		const coveredKind: Record<string, string> = { textSegments: 'text' };
		for (const key of SCALAR_ELEMENT_KEYS) {
			const kind = ELEMENT_FIELD_KIND[key as keyof typeof ELEMENT_FIELD_KIND];
			coveredKind[key] = kind === 'asset' ? 'asset' : 'scalar';
		}
		for (const key of Object.keys(COMPLEX_FIELD_MAP)) {
			coveredKind[key] = 'complex';
		}

		for (const [field, kind] of Object.entries(ELEMENT_FIELD_KIND)) {
			expect(
				coveredKind[field],
				`field "${field}" is declared on PptxElement but not handled`,
			).toBe(kind);
		}
		expect(Object.keys(coveredKind).sort()).toStrictEqual(Object.keys(ELEMENT_FIELD_KIND).sort());
	});

	it('scalar + complex slide keys + elements cover every PptxSlide field', () => {
		const coveredKind: Record<string, string> = { elements: 'nested' };
		for (const key of SCALAR_SLIDE_KEYS) {
			coveredKind[key] = 'scalar';
		}
		for (const key of Object.keys(COMPLEX_SLIDE_FIELD_MAP)) {
			coveredKind[key] = 'complex';
		}

		for (const [field, kind] of Object.entries(SLIDE_FIELD_KIND)) {
			expect(coveredKind[field], `field "${field}" is declared on PptxSlide but not handled`).toBe(
				kind,
			);
		}
		expect(Object.keys(coveredKind).sort()).toStrictEqual(Object.keys(SLIDE_FIELD_KIND).sort());
	});

	it('no longer includes the removed phantom keys', () => {
		expect(SCALAR_ELEMENT_KEYS.has('placeholder')).toBeFalsy();
		expect(SCALAR_ELEMENT_KEYS.has('svgContent')).toBeFalsy();
		expect(SCALAR_ELEMENT_KEYS.has('inkSvg')).toBeFalsy();
		expect(SCALAR_ELEMENT_KEYS.has('sourceSlideId')).toBeFalsy();
		expect(COMPLEX_FIELD_MAP.connectionStart).toBeUndefined();
		expect(COMPLEX_FIELD_MAP.connectionEnd).toBeUndefined();
		expect(COMPLEX_FIELD_MAP.mediaBookmarks).toBeUndefined();
		expect(COMPLEX_FIELD_MAP.bookmarks).toBe('_bookmarks');
	});

	it('covers newly-added binary/OLE/ink/3D fields', () => {
		expect(SCALAR_ELEMENT_KEYS.has('oleEmbeddedData')).toBeTruthy();
		expect(SCALAR_ELEMENT_KEYS.has('mediaData')).toBeTruthy();
		expect(SCALAR_ELEMENT_KEYS.has('modelData')).toBeTruthy();
		expect(SCALAR_ELEMENT_KEYS.has('inkPaths')).toBeTruthy();
		expect(COMPLEX_FIELD_MAP.extensionXml).toBe('_extensionXml');
		expect(COMPLEX_FIELD_MAP.groupFill).toBe('_groupFill');
		expect(COMPLEX_SLIDE_FIELD_MAP.notesShapes).toBe('_notesShapes');
		expect(COMPLEX_SLIDE_FIELD_MAP.headerFooterFlags).toBe('_headerFooterFlags');
	});
});
