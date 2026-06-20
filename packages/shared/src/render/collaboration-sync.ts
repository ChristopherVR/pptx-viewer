/**
 * collaboration-sync.ts: Framework-agnostic CRDT sync utilities for the
 * pptx-viewer collaboration stack (Yjs backend).
 *
 * Exports:
 *  - Structural Yjs interfaces (no hard yjs import - bindings pass live instances)
 *  - YjsFactories: factory interface bindings implement using `new Y.Map()` etc.
 *  - encodeTextBody / decodeTextBody: TextSegment[] <-> YTextLike delta
 *  - writeElementToYMap / readElementFromYMap: PptxElement <-> YMapLike
 *  - writeSlideToYMap / readSlideFromYMap: PptxSlide <-> YMapLike
 *  - writeSlidesToYDoc / readSlidesFromYDoc: PptxSlide[] <-> Y.Doc
 *  - observeYDocSlides: register a change listener on the pptx:slides array
 *
 * Y.Doc schema (matches pptx-codec.ts in packages/tools):
 *   pptx:slides  - Y.Array of slide Y.Maps
 *   Each slide Y.Map has scalar keys + `_`-prefixed JSON blobs + `elements`
 *   Each element Y.Map has scalar keys + `_`-prefixed JSON blobs + `textBody`
 *   textBody is a Y.Text with one delta-op per TextSegment
 */

import type { PptxSlide, PptxElement } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Structural Yjs interfaces (no 'yjs' import; bindings supply live instances)
// ---------------------------------------------------------------------------

export interface DeltaOp {
	insert?: unknown;
	attributes?: Record<string, unknown>;
}

export interface YTextLike {
	insert: (index: number, text: string, attrs?: Record<string, string>) => void;
	toDelta: () => DeltaOp[];
	toString: () => string;
}

export interface YMapLike {
	get: (key: string) => unknown;
	set: (key: string, value: unknown) => void;
	forEach: (cb: (value: unknown, key: string) => void) => void;
}

export interface YArrayLike {
	readonly length: number;
	get: (index: number) => unknown;
	push: (items: unknown[]) => void;
	delete: (index: number, length?: number) => void;
	insert: (index: number, items: unknown[]) => void;
	toArray: () => unknown[];
	observe: (handler: () => void) => void;
	unobserve: (handler: () => void) => void;
	observeDeep: (handler: () => void) => void;
	unobserveDeep: (handler: () => void) => void;
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
// Y.Doc schema constants (mirror of pptx-codec.ts)
// ---------------------------------------------------------------------------

export const YDOC_SLIDES_KEY = 'pptx:slides';
export const YDOC_META_KEY = 'pptx:meta';

const SCALAR_ELEMENT_KEYS = new Set([
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

const COMPLEX_ELEMENT_FIELDS: Record<string, string> = {
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

const SCALAR_SLIDE_KEYS = new Set([
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

const COMPLEX_SLIDE_FIELDS: Record<string, string> = {
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
// Text-body encode/decode (TextSegment[] <-> YTextLike delta)
// ---------------------------------------------------------------------------

function buildSegmentAttrs(seg: Record<string, unknown>): Record<string, string> {
	const a: Record<string, string> = {};
	const style = seg.style;
	if (style && typeof style === 'object' && Object.keys(style).length > 0) {
		a.s = JSON.stringify(style);
	}
	if (seg.isParagraphBreak) {
		a.pb = '1';
	}
	if (seg.isLineBreak) {
		a.lb = '1';
	}
	if (seg.bulletInfo) {
		a.bi = JSON.stringify(seg.bulletInfo);
	}
	if (seg.paragraphLevel !== undefined) {
		a.pl = String(seg.paragraphLevel);
	}
	if (seg.endParaRunProperties) {
		a.pr = JSON.stringify(seg.endParaRunProperties);
	}
	if (typeof seg.fieldType === 'string') {
		a.ft = seg.fieldType;
	}
	if (typeof seg.fieldGuid === 'string') {
		a.fg = seg.fieldGuid;
	}
	if (seg.fieldGuidAttr === 'uuid' || seg.fieldGuidAttr === 'id') {
		a.fga = seg.fieldGuidAttr;
	}
	if (seg.fieldParagraphPropertiesXml) {
		a.fp = JSON.stringify(seg.fieldParagraphPropertiesXml);
	}
	if (seg.equationXml) {
		a.eq = JSON.stringify(seg.equationXml);
	}
	if (typeof seg.equationNumber === 'string') {
		a.en = seg.equationNumber;
	}
	if (seg.breakRunProperties) {
		a.br = JSON.stringify(seg.breakRunProperties);
	}
	if (typeof seg.rubyText === 'string') {
		a.rt = seg.rubyText;
	}
	if (typeof seg.rubyAlignment === 'string') {
		a.ra = seg.rubyAlignment;
	}
	if (seg.rubyFontSize !== undefined) {
		a.rfs = String(seg.rubyFontSize);
	}
	if (seg.rubyStyle) {
		a.rs = JSON.stringify(seg.rubyStyle);
	}
	return a;
}

export function encodeTextBody(segments: unknown[], ytext: YTextLike): void {
	let offset = 0;
	for (const raw of segments) {
		const seg = raw as Record<string, unknown>;
		const attrs = buildSegmentAttrs(seg);
		const hasAttrs = Object.keys(attrs).length > 0;
		if (seg.isParagraphBreak === true || seg.isLineBreak === true) {
			ytext.insert(offset, '\n', hasAttrs ? attrs : undefined);
			offset += 1;
		} else if (typeof seg.text === 'string' && seg.text.length > 0) {
			ytext.insert(offset, seg.text, hasAttrs ? attrs : undefined);
			offset += seg.text.length;
		} else {
			// Empty non-break run: use zero-width space to hold attributes
			ytext.insert(offset, '​', hasAttrs ? attrs : undefined);
			offset += 1;
		}
	}
}

export function decodeTextBody(ytext: YTextLike): Record<string, unknown>[] {
	const delta = ytext.toDelta();
	const segments: Record<string, unknown>[] = [];
	for (const op of delta) {
		if (typeof op.insert !== 'string' || op.insert === '') {
			continue;
		}
		const a = (op.attributes ?? {}) as Record<string, string>;
		const seg: Record<string, unknown> = { text: '', style: {} };
		if (a.s) {
			try {
				seg.style = JSON.parse(a.s);
			} catch {
				seg.style = {};
			}
		}
		if (a.pb === '1') {
			seg.isParagraphBreak = true;
		}
		if (a.lb === '1') {
			seg.isLineBreak = true;
		}
		if (a.bi) {
			try {
				seg.bulletInfo = JSON.parse(a.bi);
			} catch {
				/* skip */
			}
		}
		if (a.pl !== undefined) {
			seg.paragraphLevel = Number(a.pl);
		}
		if (a.pr) {
			try {
				seg.endParaRunProperties = JSON.parse(a.pr);
			} catch {
				/* skip */
			}
		}
		if (a.ft) {
			seg.fieldType = a.ft;
		}
		if (a.fg) {
			seg.fieldGuid = a.fg;
		}
		if (a.fga === 'uuid' || a.fga === 'id') {
			seg.fieldGuidAttr = a.fga;
		}
		if (a.fp) {
			try {
				seg.fieldParagraphPropertiesXml = JSON.parse(a.fp);
			} catch {
				/* skip */
			}
		}
		if (a.eq) {
			try {
				seg.equationXml = JSON.parse(a.eq);
			} catch {
				/* skip */
			}
		}
		if (a.en) {
			seg.equationNumber = a.en;
		}
		if (a.br) {
			try {
				seg.breakRunProperties = JSON.parse(a.br);
			} catch {
				/* skip */
			}
		}
		if (a.rt) {
			seg.rubyText = a.rt;
		}
		if (a.ra) {
			seg.rubyAlignment = a.ra;
		}
		if (a.rfs !== undefined) {
			seg.rubyFontSize = Number(a.rfs);
		}
		if (a.rs) {
			try {
				seg.rubyStyle = JSON.parse(a.rs);
			} catch {
				/* skip */
			}
		}
		if (op.insert !== '\n' && op.insert !== '​') {
			seg.text = op.insert;
		}
		segments.push(seg);
	}
	return segments;
}

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

function isYTextLike(value: unknown): value is YTextLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as YTextLike).toDelta === 'function'
	);
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

export function observeYDocSlides(ydoc: YDocLike, onChange: () => void): () => void {
	const arr = ydoc.getArray(YDOC_SLIDES_KEY);
	arr.observeDeep(onChange);
	return () => arr.unobserveDeep(onChange);
}
