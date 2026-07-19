import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { ELEMENT_FIELD_KIND, SLIDE_FIELD_KIND } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
	ASSET_ELEMENT_FIELDS,
	assetVersionKey,
	getAssetsMap,
	isAssetVersionKey,
} from './collaboration-assets';
import { reconcileElementYMap, reconcileSlidesInYDoc } from './collaboration-reconcile';
import type { YDocLike, YjsFactories, YMapLike } from './collaboration-sync';
import {
	COMPLEX_ELEMENT_FIELDS,
	COMPLEX_SLIDE_FIELDS,
	observeYDocSlides,
	readElementFromYMap,
	readSlideFromYMap,
	readSlidesFromYDoc,
	SCALAR_ELEMENT_KEYS,
	SCALAR_SLIDE_KEYS,
	writeElementToYMap,
	writeSlideToYMap,
} from './collaboration-sync';

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

const asDoc = (doc: Y.Doc): YDocLike => doc as unknown as YDocLike;
const asMap = (map: Y.Map<unknown>): YMapLike => map as unknown as YMapLike;

// Yjs throws "Invalid access" when reading a type that was never integrated
// into a Y.Doc, so every round-trip pushes the freshly-written map into a
// throwaway doc-owned array before reading it back.
function roundTripElement(element: PptxElement): PptxElement {
	const doc = new Y.Doc();
	const assets = getAssetsMap(asDoc(doc));
	const map = new Y.Map();
	writeElementToYMap(element, asMap(map), factories, assets);
	const holder = doc.getArray('_test');
	holder.push([map]);
	return readElementFromYMap(asMap(holder.get(0) as Y.Map<unknown>), assets);
}

function roundTripSlide(slide: PptxSlide): PptxSlide {
	const doc = new Y.Doc();
	const assets = getAssetsMap(asDoc(doc));
	const map = new Y.Map();
	writeSlideToYMap(slide, asMap(map), factories, assets);
	const holder = doc.getArray('_test');
	holder.push([map]);
	return readSlideFromYMap(asMap(holder.get(0) as Y.Map<unknown>), assets);
}

describe('collaboration-sync: element field coverage', () => {
	it('round-trips OLE fields, including binary payloads via the asset map', () => {
		const ole: PptxElement = {
			type: 'ole',
			id: 'ole_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			oleTarget: 'oleObject1.bin',
			oleProgId: 'Excel.Sheet.12',
			oleObjectType: 'excel',
			fileName: 'budget.xlsx',
			isLinked: false,
			previewImage: 'data:image/png;base64,AAA',
			previewImageData: 'data:image/png;base64,BBB',
			oleShowAsIcon: false,
			oleEmbeddedData: 'data:application/vnd.ms-excel;base64,CCC',
			oleEmbeddedFileName: 'budget.xlsx',
			oleEmbeddedMimeType: 'application/vnd.ms-excel',
			oleEmbeddedByteSize: 1234,
			extensionXml: [{ uri: '{ABC}', xml: {} }],
		};
		expect(roundTripElement(ole)).toStrictEqual(ole);
	});

	it('round-trips media fields, including binary payloads via the asset map', () => {
		const media: PptxElement = {
			type: 'media',
			id: 'vid_1',
			x: 0,
			y: 0,
			width: 640,
			height: 360,
			mediaType: 'video',
			mediaPath: 'ppt/media/media1.mp4',
			mediaData: 'data:video/mp4;base64,AAA',
			mediaReferenceKind: 'videoFile',
			mediaReferenceName: 'media1.mp4',
			mediaReferenceContentType: 'video/mp4',
			posterFramePath: 'ppt/media/image1.png',
			posterFrameData: 'data:image/png;base64,BBB',
			autoPlay: true,
			volume: 0.8,
			bookmarks: [{ name: 'chapter1', timeMs: 1000 }],
			metadata: { durationMs: 5000 },
		};
		expect(roundTripElement(media)).toStrictEqual(media);
	});

	it('round-trips ink fields', () => {
		const ink: PptxElement = {
			type: 'ink',
			id: 'ink_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkPaths: ['M 0 0 L 10 10'],
			inkColors: ['#ff0000'],
			inkWidths: [2],
			inkOpacities: [1],
			inkTool: 'pen',
			inkPointPressures: [[0.5, 0.6]],
		};
		expect(roundTripElement(ink)).toStrictEqual(ink);
	});

	it('round-trips ContentPart ink strokes', () => {
		const contentPart: PptxElement = {
			type: 'contentPart',
			id: 'cp_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			inkStrokes: [{ path: 'M 0 0', color: '#000', width: 1, opacity: 1 }],
			inkPartPath: 'ppt/ink/ink1.xml',
			inkPartRawXml: { ink: { '@_documentID': 'ink-doc-1' } },
		};
		expect(roundTripElement(contentPart)).toStrictEqual(contentPart);
	});

	it('round-trips Zoom fields', () => {
		const zoom: PptxElement = {
			type: 'zoom',
			id: 'zm_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			zoomType: 'summary',
			targetSlideIndex: 3,
			targetSectionId: 'sec1',
			summaryTargets: [
				{ targetSlideIndex: 3, sectionId: 'sec1', x: 0, y: 0, width: 100, height: 100 },
			],
			summaryLayout: 'grid',
		};
		expect(roundTripElement(zoom)).toStrictEqual(zoom);
	});

	it('round-trips Model3D fields, including binary model data via the asset map', () => {
		const model: PptxElement = {
			type: 'model3d',
			id: 'mdl_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			modelPath: 'ppt/media/model1.glb',
			modelData: 'data:model/gltf-binary;base64,AAA',
			modelMimeType: 'model/gltf-binary',
			posterImage: 'data:image/png;base64,BBB',
		};
		expect(roundTripElement(model)).toStrictEqual(model);
	});

	it('round-trips Group fill and custom-geometry fields on a Shape', () => {
		const group: PptxElement = {
			type: 'group',
			id: 'grp_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			children: [],
			groupFill: { fillColor: '#00ff00' },
		};
		expect(roundTripElement(group)).toStrictEqual(group);

		const shape: PptxElement = {
			type: 'shape',
			id: 'shp_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
			customGeometryPaths: [{ fill: 'norm', points: [] }] as never,
			customGeometryConnectionSites: [{ x: 0, y: 0, angle: 0 }] as never,
		};
		expect(roundTripElement(shape)).toStrictEqual(shape);
	});

	it('round-trips image crop/tile/svg fields', () => {
		const image: PptxElement = {
			type: 'image',
			id: 'img_1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imagePath: 'ppt/media/image1.png',
			svgData: 'data:image/svg+xml;base64,AAA',
			svgPath: 'ppt/media/image1.svg',
			cropLeft: 0.1,
			cropTop: 0.2,
			cropRight: 0.1,
			cropBottom: 0.2,
			tileOffsetX: 5,
			tileOffsetY: 5,
			tileScaleX: 100,
			tileScaleY: 100,
			tileFlip: 'xy',
			tileAlignment: 'tl',
		};
		expect(roundTripElement(image)).toStrictEqual(image);
	});

	it('round-trips base fields: shapeId, skew, extLstXml', () => {
		const text: PptxElement = {
			type: 'text',
			id: 'txt_1',
			shapeId: '42',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			skewX: 5,
			skewY: -5,
			extLstXml: [{ uri: '{XYZ}', xml: {} }],
			text: 'Hello',
		};
		expect(roundTripElement(text)).toStrictEqual(text);
	});

	it('no longer reads or writes the removed phantom scalar keys', () => {
		const doc = new Y.Doc();
		const assets = getAssetsMap(asDoc(doc));
		const map = new Y.Map();
		// Simulate a legacy Y.Doc written by the old schema.
		map.set('id', 'el_1');
		map.set('type', 'text');
		map.set('placeholder', 'title');
		map.set('svgContent', '<svg/>');
		map.set('inkSvg', '<svg/>');
		map.set('sourceSlideId', 'slide1');
		const read = readElementFromYMap(asMap(map), assets) as unknown as Record<string, unknown>;
		expect(read.placeholder).toBeUndefined();
		expect(read.svgContent).toBeUndefined();
		expect(read.inkSvg).toBeUndefined();
		expect(read.sourceSlideId).toBeUndefined();
	});

	it('only writes an asset payload to the shared assets map when it changes', () => {
		const doc = new Y.Doc();
		const assets = getAssetsMap(asDoc(doc));
		const map = new Y.Map();
		const media: PptxElement = {
			type: 'media',
			id: 'vid_1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			mediaData: 'data:video/mp4;base64,AAA',
		};
		writeElementToYMap(media, asMap(map), factories, assets);
		expect(assets.get('vid_1:mediaData')).toBe('data:video/mp4;base64,AAA');

		let setCalls = 0;
		const originalSet = assets.set.bind(assets);
		assets.set = (key: string, value: unknown) => {
			setCalls++;
			return originalSet(key, value);
		};
		// Re-write the identical element (as an unrelated field-only reconcile would).
		writeElementToYMap({ ...media, x: 5 }, asMap(map), factories, assets);
		expect(setCalls).toBe(0);
	});

	it('deletes the asset entry when a binary field is cleared via reconcile', () => {
		const doc = new Y.Doc();
		const assets = getAssetsMap(asDoc(doc));
		const map = new Y.Map();
		const media: PptxElement = {
			type: 'media',
			id: 'vid_1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			mediaData: 'data:video/mp4;base64,AAA',
		};
		writeElementToYMap(media, asMap(map), factories, assets);
		const holder = doc.getArray('_test');
		holder.push([map]);
		expect(assets.get('vid_1:mediaData')).toBeDefined();

		reconcileElementYMap(
			asMap(holder.get(0) as Y.Map<unknown>),
			{ ...media, mediaData: undefined },
			factories,
			assets,
		);
		expect(assets.get('vid_1:mediaData')).toBeUndefined();
		expect((holder.get(0) as Y.Map<unknown>).get('_mdRef')).toBeUndefined();
	});
});

describe('collaboration-sync: in-place asset swap propagation', () => {
	function mediaSlide(mediaData: string): PptxSlide {
		return {
			id: 's1',
			slideNumber: 1,
			elements: [
				{
					type: 'media',
					id: 'vid_1',
					x: 0,
					y: 0,
					width: 640,
					height: 360,
					mediaType: 'video',
					mediaData,
				} as PptxElement,
			],
		} as PptxSlide;
	}

	it('fires the pptx:slides observer and re-resolves the binary when an existing element swaps its payload', () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc([mediaSlide('data:video/mp4;base64,AAA')], asDoc(doc), factories);

		let observerFired = 0;
		const unobserve = observeYDocSlides(asDoc(doc), () => {
			observerFired++;
		});

		// Swap the binary on the SAME element id (an in-place media replacement).
		reconcileSlidesInYDoc([mediaSlide('data:video/mp4;base64,ZZZ')], asDoc(doc), factories);
		unobserve();

		// The slides observer must have fired so peers re-read.
		expect(observerFired).toBeGreaterThan(0);

		// A fresh read resolves the NEW binary from the assets map.
		const [slide] = readSlidesFromYDoc(asDoc(doc));
		const el = slide.elements[0] as unknown as Record<string, unknown>;
		expect(el.mediaData).toBe('data:video/mp4;base64,ZZZ');
		// The internal version token never leaks onto the element.
		expect(el.mediaData__v).toBeUndefined();
	});

	it('bumps the per-field version counter on the element map when the payload changes', () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc([mediaSlide('data:video/mp4;base64,AAA')], asDoc(doc), factories);
		const arr = doc.getArray('pptx:slides');
		const elemMap = (arr.get(0) as Y.Map<unknown>).get('elements') as Y.Array<Y.Map<unknown>>;
		const vKey = assetVersionKey('mediaData');
		const before = elemMap.get(0).get(vKey);

		reconcileSlidesInYDoc([mediaSlide('data:video/mp4;base64,ZZZ')], asDoc(doc), factories);
		const after = elemMap.get(0).get(vKey);

		expect(after).not.toBe(before);
		expect(after).toBeTypeOf('number');
		expect(isAssetVersionKey(vKey)).toBeTruthy();
	});

	it('does NOT bump the version counter when the payload is unchanged', () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc([mediaSlide('data:video/mp4;base64,AAA')], asDoc(doc), factories);
		const arr = doc.getArray('pptx:slides');
		const elemMap = (arr.get(0) as Y.Map<unknown>).get('elements') as Y.Array<Y.Map<unknown>>;
		const vKey = assetVersionKey('mediaData');
		const before = elemMap.get(0).get(vKey);

		// Re-reconcile the identical deck: no payload change, no version bump.
		reconcileSlidesInYDoc([mediaSlide('data:video/mp4;base64,AAA')], asDoc(doc), factories);
		expect(elemMap.get(0).get(vKey)).toBe(before);
	});
});

describe('collaboration-sync: slide field coverage', () => {
	it('round-trips newly-covered slide fields', () => {
		const slide: PptxSlide = {
			id: 's1',
			rId: 'rId2',
			slideNumber: 1,
			name: 'Intro',
			backgroundShadeToTitle: true,
			notesCSldName: 'Notes 1',
			backgroundPattern: {
				preset: 'pct50',
				foregroundColor: '#000',
				backgroundColor: '#fff',
			} as never,
			notesShapes: [],
			notesClrMapOverride: { bg1: 'lt1' },
			headerFooterFlags: { showDate: true } as never,
			elements: [],
		};
		expect(roundTripSlide(slide)).toStrictEqual(slide);
	});
});

describe('collaboration-sync: field-schema completeness guard', () => {
	it('scalar + complex + asset element keys + textSegments cover every PptxElement field', () => {
		const coveredKind: Record<string, string> = { textSegments: 'text' };
		for (const key of SCALAR_ELEMENT_KEYS) {
			coveredKind[key] = 'scalar';
		}
		for (const key of Object.keys(COMPLEX_ELEMENT_FIELDS)) {
			coveredKind[key] = 'complex';
		}
		for (const key of ASSET_ELEMENT_FIELDS) {
			coveredKind[key] = 'asset';
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
		for (const key of Object.keys(COMPLEX_SLIDE_FIELDS)) {
			coveredKind[key] = 'complex';
		}

		for (const [field, kind] of Object.entries(SLIDE_FIELD_KIND)) {
			expect(coveredKind[field], `field "${field}" is declared on PptxSlide but not handled`).toBe(
				kind,
			);
		}
		expect(Object.keys(coveredKind).sort()).toStrictEqual(Object.keys(SLIDE_FIELD_KIND).sort());
	});
});
