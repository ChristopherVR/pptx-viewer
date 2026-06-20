import { PptxHandler } from 'pptx-viewer-core';
import type { PptxSlide, PptxElement } from 'pptx-viewer-core';
import { Doc as YDoc, Array as YArray, Map as YMap } from 'yjs';

export const ORIGIN_FILE_LOAD = 'file-load';

/**
 * Bidirectional format codec: file bytes <-> Y.Doc shared types.
 */
export interface FormatCodec {
	readonly formatId: string;
	readonly extensions: string[];
	hydrate: (ydoc: YDoc, bytes: Uint8Array, origin?: string) => Promise<void>;
	dehydrate: (ydoc: YDoc, dirtyPaths?: string[]) => Promise<Uint8Array>;
	observe: (ydoc: YDoc, onChange: () => void) => () => void;
}

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

const COMPLEX_FIELD_MAP: Record<string, string> = {
	textSegments: '_textSegments',
	textStyle: '_textStyle',
	shapeStyle: '_shapeStyle',
	shapeAdjustments: '_shapeAdjustments',
	adjustmentHandles: '_adjustmentHandles',
	tableData: '_tableData',
	chartData: '_chartData',
	smartArtData: '_smartArtData',
	connectionStart: '_connectionStart',
	connectionEnd: '_connectionEnd',
	animations: '_animations',
	nativeAnimations: '_nativeAnimations',
	children: '_children',
	paragraphIndents: '_paragraphIndents',
	rawXml: '_rawXml',
	actionClick: '_actionClick',
	actionHover: '_actionHover',
	locks: '_locks',
	imageEffects: '_imageEffects',
	cropShape: '_cropShape',
	mediaBookmarks: '_mediaBookmarks',
	captionTracks: '_captionTracks',
};

const REVERSE_COMPLEX_MAP: Record<string, string> = {};
for (const [original, prefixed] of Object.entries(COMPLEX_FIELD_MAP)) {
	REVERSE_COMPLEX_MAP[prefixed] = original;
}

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

const COMPLEX_SLIDE_FIELD_MAP: Record<string, string> = {
	transition: '_transition',
	animations: '_animations',
	nativeAnimations: '_nativeAnimations',
	rawTiming: '_rawTiming',
	notesSegments: '_notesSegments',
	comments: '_comments',
	warnings: '_warnings',
	rawXml: '_rawXml',
	clrMapOverride: '_clrMapOverride',
	guides: '_guides',
	customerData: '_customerData',
	activeXControls: '_activeXControls',
};

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

			const slidesArray = ydoc.getArray('pptx:slides');
			if (slidesArray.length > 0) {
				slidesArray.delete(0, slidesArray.length);
			}

			for (const slide of pptxData.slides) {
				const slideMap = this._slideToYMap(slide);
				slidesArray.push([slideMap]);
			}
		}, effectiveOrigin);
	}

	async dehydrate(ydoc: YDoc, _dirtyPaths?: string[]): Promise<Uint8Array> {
		const meta = ydoc.getMap('pptx:meta');
		const slidesArray = ydoc.getArray('pptx:slides');

		const slides: PptxSlide[] = [];
		for (let i = 0; i < slidesArray.length; i++) {
			const slideMap = slidesArray.get(i) as YMap<unknown>;
			slides.push(this._yMapToSlide(slideMap));
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
		const handler = () => onChange();
		slidesArray.observeDeep(handler);
		meta.observeDeep(handler);
		return () => {
			slidesArray.unobserveDeep(handler);
			meta.unobserveDeep(handler);
		};
	}

	private _slideToYMap(slide: PptxSlide): YMap<unknown> {
		const slideMap = new YMap<unknown>();
		const slideRecord = slide as unknown as Record<string, unknown>;
		for (const key of SCALAR_SLIDE_KEYS) {
			const value = slideRecord[key];
			if (value !== undefined) {
				slideMap.set(key, value);
			}
		}
		for (const [original, prefixed] of Object.entries(COMPLEX_SLIDE_FIELD_MAP)) {
			const value = slideRecord[original];
			if (value !== undefined) {
				slideMap.set(prefixed, JSON.stringify(value));
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
					// Corrupt or non-JSON value: leave field undefined to keep
					// dehydration safe rather than aborting the whole document.
				}
			}
		}
		const elementsArray = slideMap.get('elements') as YArray<YMap<unknown>> | undefined;
		const elements: PptxElement[] = [];
		if (elementsArray) {
			for (let i = 0; i < elementsArray.length; i++) {
				const elemMap = elementsArray.get(i) as YMap<unknown>;
				elements.push(this._yMapToElement(elemMap));
			}
		}
		slide['elements'] = elements;
		return slide as unknown as PptxSlide;
	}

	private _elementToYMap(element: PptxElement): YMap<unknown> {
		const elemMap = new YMap<unknown>();
		const record = element as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(record)) {
			if (value === undefined) {
				continue;
			}
			if (SCALAR_ELEMENT_KEYS.has(key)) {
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
			if (REVERSE_COMPLEX_MAP[key]) {
				try {
					element[REVERSE_COMPLEX_MAP[key]] = JSON.parse(value as string);
				} catch {
					// Corrupt JSON in Y.Doc: skip rather than throwing so the
					// element still hydrates with whatever scalar fields parsed.
				}
			} else {
				element[key] = value;
			}
		});
		return element as unknown as PptxElement;
	}
}
