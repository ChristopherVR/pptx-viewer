import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, test } from 'vitest';
import * as Y from 'yjs';

import { getAssetsMap } from './collaboration-assets';
import { LOCAL_SYNC_ORIGIN, reconcileSlidesInYDoc } from './collaboration-reconcile';
import type { YDocLike, YjsFactories, YMapLike } from './collaboration-sync';
import {
	observeYDocSlides,
	readSlidesFromYDoc,
	writeSlidesToYDoc,
	YDOC_SLIDES_KEY,
} from './collaboration-sync';

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

const asDoc = (doc: Y.Doc): YDocLike => doc as unknown as YDocLike;

function makeElement(id: string, text: string, extra: Record<string, unknown> = {}): PptxElement {
	return {
		id,
		type: 'text',
		x: 10,
		y: 20,
		width: 300,
		height: 80,
		textSegments: [{ text, style: {} }],
		...extra,
	} as unknown as PptxElement;
}

function makeSlide(
	id: string,
	elements: PptxElement[],
	extra: Record<string, unknown> = {},
): PptxSlide {
	return { id, slideNumber: 1, elements, ...extra } as unknown as PptxSlide;
}

function syncDocs(a: Y.Doc, b: Y.Doc): void {
	Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
	Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

describe('reconcileSlidesInYDoc', () => {
	it('populates an empty doc equivalently to writeSlidesToYDoc', () => {
		const slides = [
			makeSlide('s1', [makeElement('e1', 'Hello')]),
			makeSlide('s2', [makeElement('e2', 'World')], { notes: 'note' }),
		];
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		reconcileSlidesInYDoc(slides, asDoc(docA), factories);
		writeSlidesToYDoc(slides, asDoc(docB), factories);
		expect(readSlidesFromYDoc(asDoc(docA))).toStrictEqual(readSlidesFromYDoc(asDoc(docB)));
	});

	it('keeps Y.Map identity for unchanged slides and elements', () => {
		const doc = new Y.Doc();
		const slides = [
			makeSlide('s1', [makeElement('e1', 'Hello')]),
			makeSlide('s2', [makeElement('e2', 'World')]),
		];
		reconcileSlidesInYDoc(slides, asDoc(doc), factories);
		const arr = doc.getArray(YDOC_SLIDES_KEY);
		const slide1Map = arr.get(0);
		const slide2Map = arr.get(1);

		const changed = [slides[0], makeSlide('s2', [makeElement('e2', 'World!')])];
		reconcileSlidesInYDoc(changed, asDoc(doc), factories);

		expect(arr.get(0)).toBe(slide1Map);
		expect(arr.get(1)).toBe(slide2Map);
		const read = readSlidesFromYDoc(asDoc(doc));
		expect(
			(read[1].elements[0] as unknown as { textSegments: { text: string }[] }).textSegments[0].text,
		).toBe('World!');
	});

	it('is a no-op (emits no events) when nothing changed', () => {
		const doc = new Y.Doc();
		const slides = [
			makeSlide('s1', [
				makeElement('e1', 'Hello', {
					textSegments: [
						{ text: 'Hello', style: { bold: true } },
						{ text: '', style: {}, isParagraphBreak: true },
						{ text: 'World', style: {} },
					],
				}),
			]),
			makeSlide('s2', [makeElement('e2', 'Body')], { transition: { type: 'fade' } }),
		];
		reconcileSlidesInYDoc(slides, asDoc(doc), factories);

		let events = 0;
		const unobserve = observeYDocSlides(asDoc(doc), () => {
			events += 1;
		});
		// Re-reconcile a deep clone so no object identity shortcuts apply.
		reconcileSlidesInYDoc(JSON.parse(JSON.stringify(slides)) as PptxSlide[], asDoc(doc), factories);
		unobserve();
		expect(events).toBe(0);
	});

	it('merges concurrent edits to different slides from two peers', () => {
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		const initial = [
			makeSlide('s1', [makeElement('e1', 'Alpha')]),
			makeSlide('s2', [makeElement('e2', 'Beta')]),
		];
		reconcileSlidesInYDoc(initial, asDoc(docA), factories);
		syncDocs(docA, docB);

		// Peer A moves the element on slide 1; peer B rewrites text on slide 2.
		const slidesA = readSlidesFromYDoc(asDoc(docA));
		(slidesA[0].elements[0] as unknown as { x: number }).x = 999;
		reconcileSlidesInYDoc(slidesA, asDoc(docA), factories);

		const slidesB = readSlidesFromYDoc(asDoc(docB));
		(slidesB[1].elements[0] as unknown as { textSegments: unknown }).textSegments = [
			{ text: 'Beta edited', style: {} },
		];
		reconcileSlidesInYDoc(slidesB, asDoc(docB), factories);

		syncDocs(docA, docB);

		for (const doc of [docA, docB]) {
			const read = readSlidesFromYDoc(asDoc(doc));
			expect((read[0].elements[0] as unknown as { x: number }).x).toBe(999);
			expect(
				(read[1].elements[0] as unknown as { textSegments: { text: string }[] }).textSegments[0]
					.text,
			).toBe('Beta edited');
		}
	});

	it('merges a concurrent element move and element edit on the same slide', () => {
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		const initial = [makeSlide('s1', [makeElement('e1', 'One'), makeElement('e2', 'Two')])];
		reconcileSlidesInYDoc(initial, asDoc(docA), factories);
		syncDocs(docA, docB);

		const slidesA = readSlidesFromYDoc(asDoc(docA));
		(slidesA[0].elements[0] as unknown as { x: number }).x = 500;
		reconcileSlidesInYDoc(slidesA, asDoc(docA), factories);

		const slidesB = readSlidesFromYDoc(asDoc(docB));
		(slidesB[0].elements[1] as unknown as { y: number }).y = 700;
		reconcileSlidesInYDoc(slidesB, asDoc(docB), factories);

		syncDocs(docA, docB);
		for (const doc of [docA, docB]) {
			const read = readSlidesFromYDoc(asDoc(doc));
			expect((read[0].elements[0] as unknown as { x: number }).x).toBe(500);
			expect((read[0].elements[1] as unknown as { y: number }).y).toBe(700);
		}
	});

	it('merges concurrent InkML part identity and raw XML edits independently', () => {
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		const contentPart: PptxElement = {
			type: 'contentPart',
			id: 'ink-content-1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkPartPath: 'ppt/ink/ink1.xml',
			inkPartRawXml: { ink: { '@_documentID': 'initial' } },
		};
		reconcileSlidesInYDoc([makeSlide('s1', [contentPart])], asDoc(docA), factories);
		syncDocs(docA, docB);

		const slidesA = readSlidesFromYDoc(asDoc(docA));
		slidesA[0].elements[0].inkPartPath = 'ppt/ink/ink2.xml';
		reconcileSlidesInYDoc(slidesA, asDoc(docA), factories);

		const slidesB = readSlidesFromYDoc(asDoc(docB));
		slidesB[0].elements[0].inkPartRawXml = { ink: { '@_documentID': 'peer-b' } };
		reconcileSlidesInYDoc(slidesB, asDoc(docB), factories);

		syncDocs(docA, docB);
		for (const doc of [docA, docB]) {
			const merged = readSlidesFromYDoc(asDoc(doc))[0].elements[0];
			expect(merged.inkPartPath).toBe('ppt/ink/ink2.xml');
			expect(merged.inkPartRawXml).toStrictEqual({ ink: { '@_documentID': 'peer-b' } });
		}
	});

	it('handles element insertion, removal, and reordering', () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc(
			[makeSlide('s1', [makeElement('e1', 'A'), makeElement('e2', 'B'), makeElement('e3', 'C')])],
			asDoc(doc),
			factories,
		);
		// Remove e2, swap e1/e3, insert e4.
		reconcileSlidesInYDoc(
			[makeSlide('s1', [makeElement('e3', 'C'), makeElement('e4', 'D'), makeElement('e1', 'A')])],
			asDoc(doc),
			factories,
		);
		const read = readSlidesFromYDoc(asDoc(doc));
		expect(read[0].elements.map((e) => e.id)).toStrictEqual(['e3', 'e4', 'e1']);
	});

	it('handles slide removal and reordering', () => {
		const doc = new Y.Doc();
		const s = (id: string) => makeSlide(id, [makeElement(`${id}-e`, id)]);
		reconcileSlidesInYDoc([s('s1'), s('s2'), s('s3')], asDoc(doc), factories);
		reconcileSlidesInYDoc([s('s3'), s('s1')], asDoc(doc), factories);
		const read = readSlidesFromYDoc(asDoc(doc));
		expect(read.map((slide) => slide.id)).toStrictEqual(['s3', 's1']);
	});

	it('removes fields that became undefined', () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc(
			[makeSlide('s1', [], { notes: 'hello', transition: { type: 'fade' } })],
			asDoc(doc),
			factories,
		);
		reconcileSlidesInYDoc([makeSlide('s1', [])], asDoc(doc), factories);
		const map = doc.getArray(YDOC_SLIDES_KEY).get(0) as Y.Map<unknown>;
		expect(map.get('notes')).toBeUndefined();
		expect(map.get('_tr')).toBeUndefined();
	});

	it('tags transactions with LOCAL_SYNC_ORIGIN (or a custom origin)', () => {
		const doc = new Y.Doc();
		const origins: unknown[] = [];
		const arr = doc.getArray(YDOC_SLIDES_KEY);
		arr.observeDeep((_events, txn) => {
			origins.push(txn.origin);
		});
		reconcileSlidesInYDoc([makeSlide('s1', [])], asDoc(doc), factories);
		reconcileSlidesInYDoc(
			[makeSlide('s1', []), makeSlide('s2', [])],
			asDoc(doc),
			factories,
			'custom-origin',
		);
		expect(origins).toStrictEqual([LOCAL_SYNC_ORIGIN, 'custom-origin']);
	});

	it('edits the Y.Text of changed elements in place, keeping its identity', () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc(
			[makeSlide('s1', [makeElement('e1', 'Stable'), makeElement('e2', 'Changing')])],
			asDoc(doc),
			factories,
		);
		const arr = doc.getArray(YDOC_SLIDES_KEY);
		const slideMap = arr.get(0) as Y.Map<unknown>;
		const elements = slideMap.get('elements') as Y.Array<Y.Map<unknown>>;
		const stableText = elements.get(0).get('textBody');
		const changingText = elements.get(1).get('textBody');

		reconcileSlidesInYDoc(
			[makeSlide('s1', [makeElement('e1', 'Stable'), makeElement('e2', 'Changed!')])],
			asDoc(doc),
			factories,
		);
		expect(elements.get(0).get('textBody')).toBe(stableText);
		expect(elements.get(1).get('textBody')).toBe(changingText);
		expect((elements.get(1).get('textBody') as Y.Text).toString()).toBe('Changed!');
	});

	it('merges concurrent edits to the SAME text element at character level', () => {
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		reconcileSlidesInYDoc([makeSlide('s1', [makeElement('e1', 'Beta')])], asDoc(docA), factories);
		syncDocs(docA, docB);

		// Peer A prepends to the text while peer B appends to the same run.
		const slidesA = readSlidesFromYDoc(asDoc(docA));
		(slidesA[0].elements[0] as unknown as { textSegments: unknown }).textSegments = [
			{ text: 'Hello Beta', style: {} },
		];
		reconcileSlidesInYDoc(slidesA, asDoc(docA), factories);

		const slidesB = readSlidesFromYDoc(asDoc(docB));
		(slidesB[0].elements[0] as unknown as { textSegments: unknown }).textSegments = [
			{ text: 'Beta!', style: {} },
		];
		reconcileSlidesInYDoc(slidesB, asDoc(docB), factories);

		syncDocs(docA, docB);
		for (const doc of [docA, docB]) {
			const read = readSlidesFromYDoc(asDoc(doc));
			const seg = (read[0].elements[0] as unknown as { textSegments: { text: string }[] })
				.textSegments[0];
			expect(seg.text).toBe('Hello Beta!');
		}
	});
});

describe('observeYDocSlides origin filtering', () => {
	it('lets observers distinguish local reconcile writes from remote updates', () => {
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		const seenOrigins: unknown[] = [];
		observeYDocSlides(asDoc(docB), (_events, txn) => {
			seenOrigins.push(txn?.origin);
		});

		reconcileSlidesInYDoc([makeSlide('s1', [])], asDoc(docB), factories);
		reconcileSlidesInYDoc([makeSlide('sA', [makeElement('e', 'from A')])], asDoc(docA), factories);
		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA), 'remote');

		expect(seenOrigins[0]).toBe(LOCAL_SYNC_ORIGIN);
		expect(seenOrigins[1]).toBe('remote');
	});
});

describe('reconcileSlidesInYDoc: asset map', () => {
	it('does not rewrite pptx:assets when reconciling an unrelated field change', () => {
		const doc = new Y.Doc();
		const media = makeElement('vid_1', 'ignored', {
			type: 'media',
			mediaType: 'video',
			mediaData: 'data:video/mp4;base64,AAA',
		});
		const slides = [makeSlide('s1', [media])];
		reconcileSlidesInYDoc(slides, asDoc(doc), factories);

		const assets = getAssetsMap(asDoc(doc));
		let setCalls = 0;
		const originalSet = assets.set.bind(assets);
		assets.set = (key: string, value: unknown) => {
			setCalls++;
			return originalSet(key, value);
		};

		// Move the element (unrelated to the binary field) and reconcile again.
		const moved = [makeSlide('s1', [{ ...media, x: 500 } as unknown as PptxElement])];
		reconcileSlidesInYDoc(moved, asDoc(doc), factories);

		expect(setCalls).toBe(0);
		expect((assets as unknown as { get: (k: string) => unknown }).get('vid_1:mediaData')).toBe(
			'data:video/mp4;base64,AAA',
		);
		expect((readSlidesFromYDoc(asDoc(doc))[0].elements[0] as unknown as { x: number }).x).toBe(500);
	});
});

// Ensure the YMapLike structural interface (with delete) still matches Y.Map.
test('y.Map satisfies YMapLike', () => {
	const doc = new Y.Doc();
	const map: YMapLike = doc.getMap('m') as unknown as YMapLike;
	map.set('k', 1);
	expect(map.get('k')).toBe(1);
	map.delete('k');
	expect(map.get('k')).toBeUndefined();
});
