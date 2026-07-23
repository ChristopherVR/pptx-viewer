import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
	createCollaborationLivePatcher,
	findElementYMap,
	publishLiveGeometry,
	publishLiveInlineText,
} from './collaboration-live-patch';
import { LOCAL_SYNC_ORIGIN, reconcileSlidesInYDoc } from './collaboration-reconcile';
import type { YDocLike, YjsFactories } from './collaboration-sync';
import { readSlidesFromYDoc } from './collaboration-sync';

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

const asDoc = (doc: Y.Doc): YDocLike => doc as unknown as YDocLike;

function makeElement(id: string, text: string): PptxElement {
	return {
		id,
		type: 'text',
		x: 10,
		y: 20,
		width: 300,
		height: 80,
		text,
		textSegments: [{ text, style: {} }],
	} as unknown as PptxElement;
}

function makeSlide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, slideNumber: 1, elements } as unknown as PptxSlide;
}

function seedDoc(): Y.Doc {
	const doc = new Y.Doc();
	reconcileSlidesInYDoc([makeSlide('s1', [makeElement('e1', 'Hello')])], asDoc(doc), factories);
	return doc;
}

const firstElement = (doc: Y.Doc): Record<string, unknown> =>
	readSlidesFromYDoc(asDoc(doc))[0].elements[0] as unknown as Record<string, unknown>;

describe('createCollaborationLivePatcher', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('no-ops safely without a doc', () => {
		const patcher = createCollaborationLivePatcher();
		expect(patcher.isActive()).toBeFalsy();
		expect(() => {
			patcher.patchGeometry('s1', 'e1', { x: 5 });
			patcher.patchText('s1', 'e1', 'hi');
			patcher.flush();
			patcher.dispose();
		}).not.toThrow();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('writes the first geometry patch immediately', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		expect(patcher.isActive()).toBeTruthy();

		patcher.patchGeometry('s1', 'e1', { x: 111, y: 222 });
		expect(firstElement(doc).x).toBe(111);
		expect(firstElement(doc).y).toBe(222);
	});

	it('throttles bursts to one write per window and flushes the trailing state', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher({ throttleMs: 50 });
		patcher.configure(asDoc(doc), factories);

		let writes = 0;
		doc.on('afterTransaction', () => {
			writes++;
		});

		patcher.patchGeometry('s1', 'e1', { x: 1 });
		expect(writes).toBe(1);
		for (let i = 2; i <= 10; i++) {
			vi.advanceTimersByTime(4);
			patcher.patchGeometry('s1', 'e1', { x: i });
		}
		// Still inside the first 50ms window: nothing extra was written yet.
		expect(writes).toBe(1);
		expect(firstElement(doc).x).toBe(1);

		vi.advanceTimersByTime(50);
		expect(writes).toBe(2);
		expect(firstElement(doc).x).toBe(10);
	});

	it('flush() writes pending state synchronously and cancels the timer', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher({ throttleMs: 50 });
		patcher.configure(asDoc(doc), factories);

		patcher.patchGeometry('s1', 'e1', { x: 1 });
		patcher.patchGeometry('s1', 'e1', { x: 2, width: 400 });
		expect(vi.getTimerCount()).toBe(1);

		patcher.flush();
		expect(vi.getTimerCount()).toBe(0);
		expect(firstElement(doc).x).toBe(2);
		expect(firstElement(doc).width).toBe(400);
	});

	it('tags every transaction with LOCAL_SYNC_ORIGIN', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);

		const origins: unknown[] = [];
		doc.on('afterTransaction', (transaction: Y.Transaction) => {
			origins.push(transaction.origin);
		});

		patcher.patchGeometry('s1', 'e1', { x: 9 });
		patcher.patchText('s1', 'e1', 'Hey');
		patcher.flush();

		expect(origins.length).toBeGreaterThan(0);
		expect(origins.every((o) => o === LOCAL_SYNC_ORIGIN)).toBeTruthy();
	});

	it('patches text through the character-level Y.Text merge', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);

		const before = findElementYMap(asDoc(doc), 's1', 'e1')?.get('textBody');
		patcher.patchText('s1', 'e1', 'Hello world', {
			textSegments: [{ text: 'Hello', style: {} }],
		});
		patcher.flush();

		const element = firstElement(doc);
		expect(element.text).toBe('Hello world');
		expect(element.textSegments).toStrictEqual([{ text: 'Hello world', style: {} }]);
		// In-place merge: the Y.Text instance is reused, not replaced.
		expect(findElementYMap(asDoc(doc), 's1', 'e1')?.get('textBody')).toBe(before);
	});

	it('merges concurrent typing on the same element instead of last-write-wins', () => {
		const docA = seedDoc();
		const docB = new Y.Doc();
		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

		const patcherA = createCollaborationLivePatcher();
		const patcherB = createCollaborationLivePatcher();
		patcherA.configure(asDoc(docA), factories);
		patcherB.configure(asDoc(docB), factories);

		patcherA.patchText('s1', 'e1', 'Hello!', { textSegments: [{ text: 'Hello', style: {} }] });
		patcherA.flush();
		patcherB.patchText('s1', 'e1', '>Hello', { textSegments: [{ text: 'Hello', style: {} }] });
		patcherB.flush();

		Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB)));
		Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA)));

		const merged = (firstElement(docA).textSegments as Array<{ text: string }>)
			.map((s) => s.text)
			.join('');
		expect(merged).toBe('>Hello!');
		expect(merged).toBe(
			(firstElement(docB).textSegments as Array<{ text: string }>).map((s) => s.text).join(''),
		);
	});

	it('finds the element without a slide id and ignores unknown ids', () => {
		const doc = seedDoc();
		expect(findElementYMap(asDoc(doc), undefined, 'e1')).toBeDefined();
		expect(findElementYMap(asDoc(doc), 's1', 'missing')).toBeUndefined();

		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		expect(() => {
			patcher.patchGeometry('nope', 'missing', { x: 1 });
			patcher.flush();
		}).not.toThrow();
	});

	it('configure(null) goes dormant and drops pending patches', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher({ throttleMs: 50 });
		patcher.configure(asDoc(doc), factories);
		patcher.patchGeometry('s1', 'e1', { x: 1 });
		patcher.patchGeometry('s1', 'e1', { x: 77 });

		patcher.configure(null, null);
		expect(patcher.isActive()).toBeFalsy();
		expect(vi.getTimerCount()).toBe(0);
		patcher.flush();
		expect(firstElement(doc).x).toBe(1);
	});
});

describe('publishLiveInlineText / publishLiveGeometry', () => {
	it('publishes the interim text of an element on the slide', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);

		publishLiveInlineText(patcher, makeSlide('s1', [makeElement('e1', 'Hello')]), 'e1', 'Hello!!');
		patcher.flush();
		expect(firstElement(doc).text).toBe('Hello!!');
	});

	it('no-ops for a missing patcher, slide, element or non-text element', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		const slide = makeSlide('s1', [makeElement('e1', 'Hello')]);
		const imageSlide = makeSlide('s1', [
			{ id: 'e1', type: 'image', x: 0, y: 0, width: 1, height: 1 } as unknown as PptxElement,
		]);

		publishLiveInlineText(null, slide, 'e1', 'x');
		publishLiveInlineText(patcher, undefined, 'e1', 'x');
		publishLiveInlineText(patcher, slide, null, 'x');
		publishLiveInlineText(patcher, slide, 'nope', 'x');
		publishLiveInlineText(patcher, imageSlide, 'e1', 'x');
		publishLiveGeometry(patcher, 's1', null, { x: 5 });
		patcher.flush();

		expect(firstElement(doc).text).toBe('Hello');
		expect(firstElement(doc).x).toBe(10);
	});

	it('publishLiveGeometry forwards to the patcher', () => {
		const doc = seedDoc();
		const patcher = createCollaborationLivePatcher();
		patcher.configure(asDoc(doc), factories);
		publishLiveGeometry(patcher, 's1', 'e1', { x: 42, rotation: 15 });
		patcher.flush();
		expect(firstElement(doc).x).toBe(42);
		expect(firstElement(doc).rotation).toBe(15);
	});
});
