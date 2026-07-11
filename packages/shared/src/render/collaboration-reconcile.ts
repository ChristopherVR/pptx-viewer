/**
 * collaboration-reconcile.ts: Granular Y.Doc reconciliation for collaborative
 * editing.
 *
 * `writeSlidesToYDoc` replaces the entire pptx:slides array on every write,
 * which makes concurrent edits collide at document granularity (last writer
 * wins for the whole deck). `reconcileSlidesInYDoc` instead diffs the desired
 * slide state against the live Y.Doc and only mutates what changed:
 *
 *  - slides and elements are matched by `id`; unchanged ones keep their Y.Map
 *    instance so concurrent field edits merge via Yjs
 *  - scalar / complex fields are compared and only set when different
 *  - textBody is edited in place (minimal char-level diff via
 *    collaboration-text-merge.ts) when its canonical decoded form differs;
 *    wholesale replacement is only a fallback
 *  - removed items are deleted, new ones inserted at their position; moves
 *    are delete+reinsert (Yjs has no move primitive)
 *
 * All mutations run in a single transaction tagged with LOCAL_SYNC_ORIGIN (or
 * a caller-supplied origin) so observers can ignore their own writes.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { getAssetsMap, reconcileAssetFields } from './collaboration-assets';
import type { YArrayLike, YDocLike, YjsFactories, YMapLike } from './collaboration-sync';
import {
	COMPLEX_ELEMENT_FIELDS,
	COMPLEX_SLIDE_FIELDS,
	SCALAR_ELEMENT_KEYS,
	SCALAR_SLIDE_KEYS,
	writeElementToYMap,
	writeSlideToYMap,
	YDOC_SLIDES_KEY,
} from './collaboration-sync';
import {
	decodeDelta,
	encodeSegmentsToDelta,
	encodeTextBody,
	isYTextLike,
} from './collaboration-text-codec';
import { isYTextEditable, mergeDeltaIntoYText } from './collaboration-text-merge';

/** Transaction origin used for local reconcile writes. */
export const LOCAL_SYNC_ORIGIN = 'pptx-viewer:local-sync';

function jsonEqual(a: unknown, b: unknown): boolean {
	return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function reconcileScalars(
	ymap: YMapLike,
	rec: Record<string, unknown>,
	keys: ReadonlySet<string>,
): void {
	for (const key of keys) {
		const next = rec[key];
		const current = ymap.get(key);
		if (next === undefined) {
			if (current !== undefined) {
				ymap.delete(key);
			}
		} else if (!jsonEqual(current, next)) {
			ymap.set(key, next);
		}
	}
}

function reconcileComplexFields(
	ymap: YMapLike,
	rec: Record<string, unknown>,
	fields: Readonly<Record<string, string>>,
): void {
	for (const [original, prefixed] of Object.entries(fields)) {
		const next = rec[original] === undefined ? undefined : JSON.stringify(rec[original]);
		const current = ymap.get(prefixed);
		if (next === undefined) {
			if (current !== undefined) {
				ymap.delete(prefixed);
			}
		} else if (current !== next) {
			ymap.set(prefixed, next);
		}
	}
}

function reconcileTextBody(
	ymap: YMapLike,
	rec: Record<string, unknown>,
	factories: YjsFactories,
): void {
	const segments = rec.textSegments;
	const current = ymap.get('textBody');
	if (!Array.isArray(segments)) {
		if (current !== undefined) {
			ymap.delete('textBody');
		}
		return;
	}
	const desiredDelta = encodeSegmentsToDelta(segments);
	const desired = decodeDelta(desiredDelta);
	const existing = isYTextLike(current) ? decodeDelta(current.toDelta()) : undefined;
	if (existing !== undefined && jsonEqual(existing, desired)) {
		return;
	}
	// Prefer an in-place minimal edit so concurrent edits to the same text
	// element merge at character granularity instead of element-level LWW.
	if (isYTextEditable(current) && mergeDeltaIntoYText(current, desiredDelta)) {
		return;
	}
	const ytext = factories.createText();
	encodeTextBody(segments, ytext);
	ymap.set('textBody', ytext);
}

export function reconcileElementYMap(
	ymap: YMapLike,
	element: PptxElement,
	factories: YjsFactories,
	assets: YMapLike,
): void {
	const rec = element as unknown as Record<string, unknown>;
	reconcileScalars(ymap, rec, SCALAR_ELEMENT_KEYS);
	reconcileComplexFields(ymap, rec, COMPLEX_ELEMENT_FIELDS);
	reconcileTextBody(ymap, rec, factories);
	reconcileAssetFields(rec.id as string, rec, ymap, assets);
}

interface ReconcileAdapter<T> {
	idOf: (item: T) => string | undefined;
	create: (item: T) => YMapLike;
	update: (ymap: YMapLike, item: T) => void;
}

function mapIdAt(arr: YArrayLike, index: number): string | undefined {
	const entry = arr.get(index) as YMapLike | undefined;
	if (!entry || typeof entry.get !== 'function') {
		return undefined;
	}
	const id = entry.get('id');
	return typeof id === 'string' ? id : undefined;
}

/**
 * Reconcile a Y.Array of Y.Maps against a desired item list, matching by id.
 * Items without a string id fall back to positional matching.
 */
function reconcileYArrayById<T>(
	arr: YArrayLike,
	items: readonly T[],
	adapter: ReconcileAdapter<T>,
): void {
	const desiredIds = new Set<string>();
	for (const item of items) {
		const id = adapter.idOf(item);
		if (typeof id === 'string') {
			desiredIds.add(id);
		}
	}

	// Pass 1: delete maps whose id is gone (or duplicated); keep the last dup.
	const seen = new Set<string>();
	for (let i = arr.length - 1; i >= 0; i--) {
		const id = mapIdAt(arr, i);
		if (id === undefined) {
			continue;
		}
		if (!desiredIds.has(id) || seen.has(id)) {
			arr.delete(i, 1);
		} else {
			seen.add(id);
		}
	}

	// Pass 2: walk desired order; update in place, move, or insert.
	for (let pos = 0; pos < items.length; pos++) {
		const item = items[pos];
		const id = adapter.idOf(item);
		const idAtPos = pos < arr.length ? mapIdAt(arr, pos) : undefined;

		if (id === undefined) {
			// Positional fallback for id-less items.
			if (pos < arr.length && idAtPos === undefined) {
				adapter.update(arr.get(pos) as YMapLike, item);
			} else {
				arr.insert(pos, [adapter.create(item)]);
			}
			continue;
		}

		if (idAtPos === id) {
			adapter.update(arr.get(pos) as YMapLike, item);
			continue;
		}

		let foundAt = -1;
		for (let j = pos + 1; j < arr.length; j++) {
			if (mapIdAt(arr, j) === id) {
				foundAt = j;
				break;
			}
		}
		if (foundAt >= 0) {
			// Move: Yjs cannot re-insert an integrated type, so rebuild at pos.
			arr.delete(foundAt, 1);
		}
		arr.insert(pos, [adapter.create(item)]);
	}

	// Pass 3: trim trailing leftovers.
	if (arr.length > items.length) {
		arr.delete(items.length, arr.length - items.length);
	}
}

const isYArrayLike = (value: unknown): value is YArrayLike =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as YArrayLike).insert === 'function' &&
	typeof (value as YArrayLike).toArray === 'function';

export function reconcileSlideYMap(
	ymap: YMapLike,
	slide: PptxSlide,
	factories: YjsFactories,
	assets: YMapLike,
): void {
	const rec = slide as unknown as Record<string, unknown>;
	reconcileScalars(ymap, rec, SCALAR_SLIDE_KEYS);
	reconcileComplexFields(ymap, rec, COMPLEX_SLIDE_FIELDS);

	let elements = ymap.get('elements');
	if (!isYArrayLike(elements)) {
		elements = factories.createArray();
		ymap.set('elements', elements);
	}
	reconcileYArrayById<PptxElement>(elements as YArrayLike, slide.elements, {
		idOf: (el) => (typeof el.id === 'string' ? el.id : undefined),
		create: (el) => {
			const map = factories.createMap();
			writeElementToYMap(el, map, factories, assets);
			return map;
		},
		update: (map, el) => reconcileElementYMap(map, el, factories, assets),
	});
}

/**
 * Granular local -> Y.Doc sync: mutate only what changed, inside one
 * transaction tagged with `origin` (default LOCAL_SYNC_ORIGIN) so the
 * caller's own observer can skip the resulting events.
 */
export function reconcileSlidesInYDoc(
	slides: readonly PptxSlide[],
	ydoc: YDocLike,
	factories: YjsFactories,
	origin: unknown = LOCAL_SYNC_ORIGIN,
): void {
	const assets = getAssetsMap(ydoc);
	ydoc.transact(() => {
		const arr = ydoc.getArray(YDOC_SLIDES_KEY);
		reconcileYArrayById<PptxSlide>(arr, slides, {
			idOf: (slide) => (typeof slide.id === 'string' ? slide.id : undefined),
			create: (slide) => {
				const map = factories.createMap();
				writeSlideToYMap(slide, map, factories, assets);
				return map;
			},
			update: (map, slide) => reconcileSlideYMap(map, slide, factories, assets),
		});
	}, origin);
}
