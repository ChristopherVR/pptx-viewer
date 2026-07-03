/**
 * collaboration-sync.ts: Framework-agnostic CRDT sync utilities for the
 * pptx-viewer collaboration stack (Yjs backend).
 *
 * Exports:
 *  - Structural Yjs interfaces (no hard yjs import - bindings pass live instances)
 *  - YjsFactories: factory interface bindings implement using `new Y.Map()` etc.
 *  - writeElementToYMap / readElementFromYMap: PptxElement <-> YMapLike
 *  - writeSlideToYMap / readSlideFromYMap: PptxSlide <-> YMapLike
 *  - writeSlidesToYDoc / readSlidesFromYDoc: PptxSlide[] <-> Y.Doc
 *  - observeYDocSlides: register a change listener on the pptx:slides array
 *  - re-exports of the text codec (collaboration-text-codec.ts)
 *
 * Y.Doc schema:
 *   pptx:slides  - Y.Array of slide Y.Maps
 *   Each slide Y.Map has scalar keys + `_`-prefixed JSON blobs + `elements`
 *   Each element Y.Map has scalar keys + `_`-prefixed JSON blobs + `textBody`
 *   textBody is a Y.Text with one delta-op per TextSegment
 *
 * NOTE: packages/tools' pptx-codec.ts implements a similar schema but with
 * different complex-field key prefixes (e.g. `_textStyle` vs `_ts` here); the
 * two doc layouts are NOT interchangeable on the same Y.Doc.
 *
 * Prefer `reconcileSlidesInYDoc` (collaboration-reconcile.ts) over
 * `writeSlidesToYDoc` for live editing: it updates only what changed instead
 * of replacing the whole slides array, so concurrent edits merge per
 * slide/element/field rather than colliding at document granularity.
 */

import type { PptxSlide, PptxElement } from 'pptx-viewer-core';

import type { YTextLike } from './collaboration-text-codec';
import { encodeTextBody, decodeTextBody, isYTextLike } from './collaboration-text-codec';

export * from './collaboration-text-codec';

// ---------------------------------------------------------------------------
// Structural Yjs interfaces (no 'yjs' import; bindings supply live instances)
// ---------------------------------------------------------------------------

export interface YMapLike {
	get: (key: string) => unknown;
	set: (key: string, value: unknown) => void;
	delete: (key: string) => void;
	forEach: (cb: (value: unknown, key: string) => void) => void;
}

/** Shape of the Yjs transaction passed to (deep) observers. */
export interface YTransactionLike {
	origin?: unknown;
}

export type YDeepObserver = (events?: unknown, transaction?: YTransactionLike) => void;

export interface YArrayLike {
	readonly length: number;
	get: (index: number) => unknown;
	push: (items: unknown[]) => void;
	delete: (index: number, length?: number) => void;
	insert: (index: number, items: unknown[]) => void;
	toArray: () => unknown[];
	observe: (handler: () => void) => void;
	unobserve: (handler: () => void) => void;
	observeDeep: (handler: YDeepObserver) => void;
	unobserveDeep: (handler: YDeepObserver) => void;
}

export interface YDocLike {
	getMap: (name: string) => YMapLike;
	getArray: (name: string) => YArrayLike;
	transact: (fn: () => void, origin?: unknown) => void;
}

export interface YjsFactories {
	createMap: () => YMapLike;
	createArray: () => YArrayLike;
	createText: () => YTextLike;
}

// ---------------------------------------------------------------------------
// Y.Doc schema constants
// ---------------------------------------------------------------------------

export const YDOC_SLIDES_KEY = 'pptx:slides';
export const YDOC_META_KEY = 'pptx:meta';

export const SCALAR_ELEMENT_KEYS: ReadonlySet<string> = new Set([
	'id',
	'type',
	'x',
	'y',
	'width',
	'height',
	'rotation',
	'flipHorizontal',
	'flipVertical',
	'hidden',
	'opacity',
	'text',
	'name',
	'altText',
	'shapeType',
	'placeholder',
	'imagePath',
	'imageData',
	'svgContent',
	'inkSvg',
	'sourceSlideId',
	'mediaType',
	'mediaPath',
	'linkedTxbxId',
	'linkedTxbxSeq',
	'promptText',
]);

export const COMPLEX_ELEMENT_FIELDS: Readonly<Record<string, string>> = {
	textStyle: '_ts',
	shapeStyle: '_ss',
	shapeAdjustments: '_sa',
	adjustmentHandles: '_ah',
	tableData: '_td',
	chartData: '_cd',
	smartArtData: '_smad',
	connectionStart: '_cs',
	connectionEnd: '_ce',
	animations: '_an',
	nativeAnimations: '_na',
	children: '_ch',
	paragraphIndents: '_pi',
	rawXml: '_rx',
	actionClick: '_ac',
	actionHover: '_av',
	locks: '_lk',
	imageEffects: '_ie',
	cropShape: '_cr',
	mediaBookmarks: '_mb',
	captionTracks: '_ct',
};
const REV_COMPLEX_ELEMENT: Record<string, string> = Object.fromEntries(
	Object.entries(COMPLEX_ELEMENT_FIELDS).map(([k, v]) => [v, k]),
);

export const SCALAR_SLIDE_KEYS: ReadonlySet<string> = new Set([
	'id',
	'rId',
	'sourceSlideId',
	'layoutPath',
	'layoutName',
	'slideNumber',
	'hidden',
	'sectionName',
	'sectionId',
	'backgroundColor',
	'backgroundImage',
	'backgroundGradient',
	'notes',
	'backgroundShowAnimation',
	'showMasterShapes',
	'isDirty',
]);

export const COMPLEX_SLIDE_FIELDS: Readonly<Record<string, string>> = {
	transition: '_tr',
	animations: '_an',
	nativeAnimations: '_na',
	rawTiming: '_rt',
	notesSegments: '_ns',
	comments: '_cm',
	warnings: '_wa',
	rawXml: '_rx',
	clrMapOverride: '_cm2',
	guides: '_gu',
	customerData: '_cu',
	activeXControls: '_ax',
};
const REV_COMPLEX_SLIDE: Record<string, string> = Object.fromEntries(
	Object.entries(COMPLEX_SLIDE_FIELDS).map(([k, v]) => [v, k]),
);

// ---------------------------------------------------------------------------
// Element serialization
// ---------------------------------------------------------------------------

export function writeElementToYMap(
	element: PptxElement,
	ymap: YMapLike,
	factories: YjsFactories,
): void {
	const rec = element as unknown as Record<string, unknown>;
	for (const [key, value] of Object.entries(rec)) {
		if (value === undefined) {
			continue;
		}
		if (SCALAR_ELEMENT_KEYS.has(key)) {
			ymap.set(key, value);
		} else if (key === 'textSegments') {
			if (Array.isArray(value)) {
				const ytext = factories.createText();
				encodeTextBody(value, ytext);
				ymap.set('textBody', ytext);
			}
		} else if (COMPLEX_ELEMENT_FIELDS[key]) {
			ymap.set(COMPLEX_ELEMENT_FIELDS[key], JSON.stringify(value));
		}
	}
}

export function readElementFromYMap(ymap: YMapLike): PptxElement {
	const element: Record<string, unknown> = {};
	ymap.forEach((value: unknown, key: string) => {
		if (key === 'textBody') {
			if (isYTextLike(value)) {
				element.textSegments = decodeTextBody(value);
			}
		} else if (REV_COMPLEX_ELEMENT[key]) {
			try {
				element[REV_COMPLEX_ELEMENT[key]] = JSON.parse(value as string);
			} catch {
				/* skip */
			}
		} else {
			element[key] = value;
		}
	});
	return element as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Slide serialization
// ---------------------------------------------------------------------------

export function writeSlideToYMap(slide: PptxSlide, ymap: YMapLike, factories: YjsFactories): void {
	const rec = slide as unknown as Record<string, unknown>;
	for (const key of SCALAR_SLIDE_KEYS) {
		if (rec[key] !== undefined) {
			ymap.set(key, rec[key]);
		}
	}
	for (const [original, prefixed] of Object.entries(COMPLEX_SLIDE_FIELDS)) {
		if (rec[original] !== undefined) {
			ymap.set(prefixed, JSON.stringify(rec[original]));
		}
	}
	const elemArr = factories.createArray();
	for (const el of slide.elements) {
		const elemMap = factories.createMap();
		writeElementToYMap(el, elemMap, factories);
		elemArr.push([elemMap]);
	}
	ymap.set('elements', elemArr);
}

export function readSlideFromYMap(ymap: YMapLike): PptxSlide {
	const slide: Record<string, unknown> = {};
	for (const key of SCALAR_SLIDE_KEYS) {
		const v = ymap.get(key);
		if (v !== undefined) {
			slide[key] = v;
		}
	}
	for (const [prefixed, original] of Object.entries(REV_COMPLEX_SLIDE)) {
		const v = ymap.get(prefixed) as string | undefined;
		if (v !== undefined) {
			try {
				slide[original] = JSON.parse(v);
			} catch {
				/* skip */
			}
		}
	}
	const elemArr = ymap.get('elements') as YArrayLike | undefined;
	const elements: PptxElement[] = [];
	if (elemArr) {
		for (let i = 0; i < elemArr.length; i++) {
			elements.push(readElementFromYMap(elemArr.get(i) as YMapLike));
		}
	}
	slide.elements = elements;
	return slide as unknown as PptxSlide;
}

// ---------------------------------------------------------------------------
// Y.Doc-level helpers
// ---------------------------------------------------------------------------

/**
 * Replace the full slides array in the Y.Doc. Coarse: prefer
 * `reconcileSlidesInYDoc` for live editing; this remains suitable for
 * one-shot seeding of an empty document.
 */
export function writeSlidesToYDoc(
	slides: PptxSlide[],
	ydoc: YDocLike,
	factories: YjsFactories,
	origin?: unknown,
): void {
	ydoc.transact(() => {
		const arr = ydoc.getArray(YDOC_SLIDES_KEY);
		if (arr.length > 0) {
			arr.delete(0, arr.length);
		}
		for (const slide of slides) {
			const ymap = factories.createMap();
			writeSlideToYMap(slide, ymap, factories);
			arr.push([ymap]);
		}
	}, origin);
}

export function readSlidesFromYDoc(ydoc: YDocLike): PptxSlide[] {
	const arr = ydoc.getArray(YDOC_SLIDES_KEY);
	const slides: PptxSlide[] = [];
	for (let i = 0; i < arr.length; i++) {
		slides.push(readSlideFromYMap(arr.get(i) as YMapLike));
	}
	return slides;
}

/**
 * Observe (deeply) the pptx:slides array. The handler receives the Yjs
 * events plus the transaction, so callers can skip their own writes by
 * checking `transaction.origin` (see LOCAL_SYNC_ORIGIN in
 * collaboration-reconcile.ts).
 */
export function observeYDocSlides(ydoc: YDocLike, onChange: YDeepObserver): () => void {
	const arr = ydoc.getArray(YDOC_SLIDES_KEY);
	arr.observeDeep(onChange);
	return () => arr.unobserveDeep(onChange);
}
