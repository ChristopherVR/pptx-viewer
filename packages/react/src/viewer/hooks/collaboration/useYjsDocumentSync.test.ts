/**
 * Tests for the document-sync data path used by useYjsDocumentSync.
 *
 * The hook is a thin React wrapper over the shared, framework-agnostic sync
 * primitives (`reconcileSlidesInYDoc`, `readSlidesFromYDoc`,
 * `observeYDocSlides`, `LOCAL_SYNC_ORIGIN`). The React package runs in a node
 * test environment with no DOM renderer, so rather than exercise a fake
 * reimplementation we drive those REAL primitives against REAL `yjs`
 * documents, on the same `pptx:slides` schema the hook uses in production.
 *
 * @module collaboration/useYjsDocumentSync.test
 */
import type { PptxSlide, PptxElement } from 'pptx-viewer-core';
import type { YDocLike, YjsFactories } from 'pptx-viewer-shared';
import {
	LOCAL_SYNC_ORIGIN,
	observeYDocSlides,
	reconcileSlidesInYDoc,
	readSlidesFromYDoc,
} from 'pptx-viewer-shared';
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Helpers: real yjs factories + slide fixtures
// ---------------------------------------------------------------------------

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

function asDoc(doc: Y.Doc): YDocLike {
	return doc as unknown as YDocLike;
}

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

function makeSlides(count: number): PptxSlide[] {
	return Array.from({ length: count }, (_, i) =>
		makeSlide({ id: `slide-${i + 1}`, rId: `rId${i + 1}`, slideNumber: i + 1 }),
	);
}

// ===========================================================================
// Tests
// ===========================================================================

describe('useYjsDocumentSync data path (real shared sync)', () => {
	// -----------------------------------------------------------------------
	// Local -> Y.Doc: reconcile writes slides on the pptx:slides array
	// -----------------------------------------------------------------------
	describe('reconcile local slides into the Y.Doc', () => {
		it('seeds an empty doc with the slide list', () => {
			const doc = new Y.Doc();
			reconcileSlidesInYDoc(makeSlides(3), asDoc(doc), factories);

			const arr = doc.getArray('pptx:slides');
			expect(arr).toHaveLength(3);
			expect((arr.get(0) as Y.Map<unknown>).get('id')).toBe('slide-1');
			expect((arr.get(2) as Y.Map<unknown>).get('id')).toBe('slide-3');
			doc.destroy();
		});

		it('round-trips slides through read', () => {
			const doc = new Y.Doc();
			const slides = makeSlides(2);
			slides[0] = {
				...slides[0],
				elements: [{ type: 'text', id: 'txt-1', x: 100, y: 200 } as unknown as PptxElement],
			};
			slides[1] = { ...slides[1], hidden: true, sectionName: 'Appendix' };

			reconcileSlidesInYDoc(slides, asDoc(doc), factories);
			const read = readSlidesFromYDoc(asDoc(doc));

			expect(read).toHaveLength(2);
			expect(read[0].id).toBe('slide-1');
			expect(read[0].elements[0].id).toBe('txt-1');
			expect(read[1].hidden).toBeTruthy();
			expect(read[1].sectionName).toBe('Appendix');
			doc.destroy();
		});

		it('preserves per-element Y.Maps when reconciling an unchanged slide', () => {
			const doc = new Y.Doc();
			const slides = makeSlides(1);
			slides[0] = {
				...slides[0],
				elements: [{ type: 'text', id: 'el-1', x: 0 } as unknown as PptxElement],
			};
			reconcileSlidesInYDoc(slides, asDoc(doc), factories);
			const firstMap = doc.getArray('pptx:slides').get(0);

			// Reconcile the identical state again: the slide Y.Map instance is kept.
			reconcileSlidesInYDoc(slides, asDoc(doc), factories);
			expect(doc.getArray('pptx:slides').get(0)).toBe(firstMap);
			doc.destroy();
		});

		it('deletes removed slides and inserts new ones by id', () => {
			const doc = new Y.Doc();
			reconcileSlidesInYDoc(makeSlides(4), asDoc(doc), factories);
			expect(doc.getArray('pptx:slides')).toHaveLength(4);

			reconcileSlidesInYDoc(makeSlides(2), asDoc(doc), factories);
			const read = readSlidesFromYDoc(asDoc(doc));
			expect(read.map((s) => s.id)).toStrictEqual(['slide-1', 'slide-2']);
			doc.destroy();
		});
	});

	// -----------------------------------------------------------------------
	// Origin tagging: the hook skips its own local-sync writes
	// -----------------------------------------------------------------------
	describe('transaction origin tagging', () => {
		it('tags local reconcile writes with LOCAL_SYNC_ORIGIN', () => {
			const doc = new Y.Doc();
			const origins: unknown[] = [];
			const unobserve = observeYDocSlides(asDoc(doc), (_events, transaction) => {
				origins.push(transaction?.origin);
			});

			reconcileSlidesInYDoc(makeSlides(1), asDoc(doc), factories);

			expect(origins).toContain(LOCAL_SYNC_ORIGIN);
			unobserve();
			doc.destroy();
		});

		it('remote writes carry a different (non-local) origin', () => {
			// A second doc plays the remote peer; its updates apply with an
			// origin that is NOT LOCAL_SYNC_ORIGIN, so the hook would react to them.
			const local = new Y.Doc();
			const remote = new Y.Doc();
			reconcileSlidesInYDoc(makeSlides(1), asDoc(remote), factories);

			const seenOrigins: unknown[] = [];
			const unobserve = observeYDocSlides(asDoc(local), (_events, transaction) => {
				seenOrigins.push(transaction?.origin);
			});

			Y.applyUpdate(local, Y.encodeStateAsUpdate(remote), 'remote-peer');

			expect(seenOrigins.length).toBeGreaterThan(0);
			expect(seenOrigins).not.toContain(LOCAL_SYNC_ORIGIN);
			unobserve();
			local.destroy();
			remote.destroy();
		});
	});

	// -----------------------------------------------------------------------
	// Two-peer convergence over the real schema
	// -----------------------------------------------------------------------
	describe('two-peer sync', () => {
		it('propagates a reconcile from one peer to the other', () => {
			const a = new Y.Doc();
			const b = new Y.Doc();
			a.on('update', (u: Uint8Array) => Y.applyUpdate(b, u));
			b.on('update', (u: Uint8Array) => Y.applyUpdate(a, u));

			reconcileSlidesInYDoc(makeSlides(2), asDoc(a), factories);

			const onB = readSlidesFromYDoc(asDoc(b));
			expect(onB.map((s) => s.id)).toStrictEqual(['slide-1', 'slide-2']);
			a.destroy();
			b.destroy();
		});

		it('notifies the observer with the transact origin', () => {
			const doc = new Y.Doc();
			const handler = vi.fn();
			const unobserve = observeYDocSlides(asDoc(doc), handler);

			reconcileSlidesInYDoc(makeSlides(1), asDoc(doc), factories, 'custom-origin');

			expect(handler.mock.calls.length).toBeGreaterThan(0);
			const lastCall = handler.mock.calls.at(-1);
			expect(lastCall?.[1]?.origin).toBe('custom-origin');
			unobserve();
			doc.destroy();
		});
	});
});
