import { ELEMENT_FIELD_KIND, PptxHandler, SLIDE_FIELD_KIND } from 'pptx-viewer-core';
import type { PptxSlide, PptxElement } from 'pptx-viewer-core';
import { Doc as YDoc, Array as YArray, Map as YMap, Text as YText } from 'yjs';

import { encodeTextBodyToYText, decodeTextBodyFromYText } from './text-body-codec.js';

export const ORIGIN_FILE_LOAD = 'file-load';

/**
 * Bidirectional format codec: file bytes <-> Y.Doc shared types.
 *
 * Y.Doc schema:
 *   pptx:meta    Y.Map  - width, height, widthEmu, heightEmu, sourceBytes
 *   pptx:slides  Y.Array<Y.Map> - one map per slide
 *     Each slide Y.Map: scalar fields + `_`-prefixed JSON blobs + `elements` Y.Array<Y.Map>
 *     Each element Y.Map: scalar fields + `_`-prefixed JSON blobs + `textBody` Y.Text
 *     textBody Y.Text: one delta op per TextSegment (see text-body-codec.ts)
 *
 * NOTE: the viewer bindings' sync schema (pptx-viewer-shared
 * collaboration-sync.ts) uses SHORT complex-field key prefixes (`_ts`, `_tr`)
 * while this codec uses long ones (`_textStyle`, `_transition`). The two doc
 * layouts are similar but NOT interchangeable on the same Y.Doc.
 */
export interface FormatCodec {
	readonly formatId: string;
	readonly extensions: string[];
	hydrate: (ydoc: YDoc, bytes: Uint8Array, origin?: string) => Promise<void>;
	dehydrate: (ydoc: YDoc, dirtyPaths?: string[]) => Promise<Uint8Array>;
	observe: (ydoc: YDoc, onChange: () => void) => () => void;
}

/**
 * Field coverage is derived from `pptx-viewer-core`'s
 * `ELEMENT_FIELD_KIND`/`SLIDE_FIELD_KIND` (the same canonical inventory the
 * viewer's `collaboration-sync.ts` allowlists derive from), so this codec
 * automatically tracks every field `PptxElement`/`PptxSlide` declares
 * instead of drifting out of sync with a hand-maintained list. Wire-format
 * prefixes stay long-form (`_textStyle`) here versus the viewer schema's
 * short-form (`_ts`) - the two Y.Doc layouts are intentionally NOT
 * interchangeable, only the field *coverage* is required to match.
 *
 * `asset`-kind fields (large binary payloads like `mediaData`) are simply
 * embedded as scalars here rather than routed through a separate asset map:
 * this codec does one-shot bidirectional file<->Y.Doc conversion, not a
 * live P2P transport, so there's no repeated-write cost to avoid.
 */
// Exported (not just module-private) so tests can assert coverage without
// needing binary round-trip fixtures for every element kind.
export const SCALAR_ELEMENT_KEYS = new Set(
	Object.entries(ELEMENT_FIELD_KIND)
		.filter(([, kind]) => kind === 'scalar' || kind === 'asset')
		.map(([field]) => field),
);

// textSegments (kind 'text') is handled as Y.Text (textBody key); all
// 'complex' fields remain JSON blobs under a long-form `_<field>` prefix.
export const COMPLEX_FIELD_MAP: Record<string, string> = Object.fromEntries(
	Object.entries(ELEMENT_FIELD_KIND)
		.filter(([, kind]) => kind === 'complex')
		.map(([field]) => [field, `_${field}`]),
);

const REVERSE_COMPLEX_MAP: Record<string, string> = {};
for (const [original, prefixed] of Object.entries(COMPLEX_FIELD_MAP)) {
	REVERSE_COMPLEX_MAP[prefixed] = original;
}

export const SCALAR_SLIDE_KEYS = new Set(
	Object.entries(SLIDE_FIELD_KIND)
		.filter(([, kind]) => kind === 'scalar')
		.map(([field]) => field),
);

// 'elements' (kind 'nested') is handled as its own Y.Array of Y.Maps below.
export const COMPLEX_SLIDE_FIELD_MAP: Record<string, string> = Object.fromEntries(
	Object.entries(SLIDE_FIELD_KIND)
		.filter(([, kind]) => kind === 'complex')
		.map(([field]) => [field, `_${field}`]),
);

const REVERSE_COMPLEX_SLIDE_MAP: Record<string, string> = {};
for (const [original, prefixed] of Object.entries(COMPLEX_SLIDE_FIELD_MAP)) {
	REVERSE_COMPLEX_SLIDE_MAP[prefixed] = original;
}

export class PptxCodec implements FormatCodec {
	readonly formatId = 'pptx';
	readonly extensions = ['.pptx', '.ppt'];

	async hydrate(ydoc: YDoc, bytes: Uint8Array, origin?: string): Promise<void> {
		const effectiveOrigin = origin ?? ORIGIN_FILE_LOAD;
		const handler = new PptxHandler();
		const pptxData = await handler.load(bytes.buffer as ArrayBuffer);

		ydoc.transact(() => {
			const meta = ydoc.getMap('pptx:meta');
			meta.set('width', pptxData.width);
			meta.set('height', pptxData.height);
			if (pptxData.widthEmu !== undefined) {
				meta.set('widthEmu', pptxData.widthEmu);
			}
			if (pptxData.heightEmu !== undefined) {
				meta.set('heightEmu', pptxData.heightEmu);
			}

			const sourceBytesArr = new YArray<number>();
			sourceBytesArr.insert(0, Array.from(bytes));
			meta.set('sourceBytes', sourceBytesArr);

			const slidesArray = ydoc.getArray<YMap<unknown>>('pptx:slides');
			if (slidesArray.length > 0) {
				slidesArray.delete(0, slidesArray.length);
			}

			for (const slide of pptxData.slides) {
				slidesArray.push([this._slideToYMap(slide)]);
			}
		}, effectiveOrigin);
	}

	async dehydrate(ydoc: YDoc, _dirtyPaths?: string[]): Promise<Uint8Array> {
		const meta = ydoc.getMap('pptx:meta');
		const slidesArray = ydoc.getArray<YMap<unknown>>('pptx:slides');

		const slides: PptxSlide[] = [];
		for (let i = 0; i < slidesArray.length; i++) {
			slides.push(this._yMapToSlide(slidesArray.get(i)));
		}

		const sourceBytesArr = meta.get('sourceBytes') as YArray<number> | undefined;

		try {
			if (!sourceBytesArr || sourceBytesArr.length === 0) {
				throw new Error('No source bytes for PptxHandler');
			}
			const sourceBytes = new Uint8Array(sourceBytesArr.toArray());
			const handler = new PptxHandler();
			await handler.load(sourceBytes.buffer as ArrayBuffer);
			return await handler.save(slides);
		} catch {
			if (sourceBytesArr && sourceBytesArr.length > 0) {
				return new Uint8Array(sourceBytesArr.toArray());
			}
			throw new Error('No PPTX bytes available for dehydration');
		}
	}

	observe(ydoc: YDoc, onChange: () => void): () => void {
		const slidesArray = ydoc.getArray('pptx:slides');
		const meta = ydoc.getMap('pptx:meta');
		slidesArray.observeDeep(onChange);
		meta.observeDeep(onChange);
		return () => {
			slidesArray.unobserveDeep(onChange);
			meta.unobserveDeep(onChange);
		};
	}

	private _slideToYMap(slide: PptxSlide): YMap<unknown> {
		const slideMap = new YMap<unknown>();
		const rec = slide as unknown as Record<string, unknown>;
		for (const key of SCALAR_SLIDE_KEYS) {
			if (rec[key] !== undefined) {
				slideMap.set(key, rec[key]);
			}
		}
		for (const [original, prefixed] of Object.entries(COMPLEX_SLIDE_FIELD_MAP)) {
			if (rec[original] !== undefined) {
				slideMap.set(prefixed, JSON.stringify(rec[original]));
			}
		}
		const elementsArray = new YArray<YMap<unknown>>();
		for (const element of slide.elements) {
			elementsArray.push([this._elementToYMap(element)]);
		}
		slideMap.set('elements', elementsArray);
		return slideMap;
	}

	private _yMapToSlide(slideMap: YMap<unknown>): PptxSlide {
		const slide: Record<string, unknown> = {};
		for (const key of SCALAR_SLIDE_KEYS) {
			const value = slideMap.get(key);
			if (value !== undefined) {
				slide[key] = value;
			}
		}
		for (const [prefixed, original] of Object.entries(REVERSE_COMPLEX_SLIDE_MAP)) {
			const value = slideMap.get(prefixed) as string | undefined;
			if (value !== undefined) {
				try {
					slide[original] = JSON.parse(value);
				} catch {
					/* skip */
				}
			}
		}
		const elementsArray = slideMap.get('elements') as YArray<YMap<unknown>> | undefined;
		const elements: PptxElement[] = [];
		if (elementsArray) {
			for (let i = 0; i < elementsArray.length; i++) {
				elements.push(this._yMapToElement(elementsArray.get(i)));
			}
		}
		slide.elements = elements;
		return slide as unknown as PptxSlide;
	}

	private _elementToYMap(element: PptxElement): YMap<unknown> {
		const elemMap = new YMap<unknown>();
		const record = element as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(record)) {
			if (value === undefined) {
				continue;
			}
			if (key === 'textSegments') {
				if (Array.isArray(value)) {
					const ytext = new YText();
					encodeTextBodyToYText(value, ytext);
					elemMap.set('textBody', ytext);
				}
			} else if (SCALAR_ELEMENT_KEYS.has(key)) {
				elemMap.set(key, value);
			} else if (COMPLEX_FIELD_MAP[key]) {
				elemMap.set(COMPLEX_FIELD_MAP[key], JSON.stringify(value));
			}
		}
		return elemMap;
	}

	private _yMapToElement(elemMap: YMap<unknown>): PptxElement {
		const element: Record<string, unknown> = {};
		elemMap.forEach((value: unknown, key: string) => {
			if (key === 'textBody' && value instanceof YText) {
				element.textSegments = decodeTextBodyFromYText(value);
			} else if (REVERSE_COMPLEX_MAP[key]) {
				try {
					element[REVERSE_COMPLEX_MAP[key]] = JSON.parse(value as string);
				} catch {
					/* skip */
				}
			} else {
				element[key] = value;
			}
		});
		return element as unknown as PptxElement;
	}
}
