/**
 * Tests for PptxHandlerRuntimeSaveShapeXml:
 *   - createInkShapeXml logic (ink path token parsing, shape XML generation)
 *   - buildGroupShapeXml logic (group structure, child categorization)
 *   - createOleGraphicFrameXml + applyOleTypedFieldUpdates (OLE round-trip)
 */
import { describe, it, expect } from 'vitest';

import type { OlePptxElement, XmlObject } from '../../types';

// ---------------------------------------------------------------------------
// OLE save helpers — re-implemented from PptxHandlerRuntimeSaveShapeXml so
// the tests can exercise the logic without instantiating the full
// PptxHandlerRuntime mixin chain (which has a top-level circular import
// when loaded standalone).
// ---------------------------------------------------------------------------
const OLE_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole';

function createOleGraphicFrameXml(el: OlePptxElement, embedRelationshipId: string): XmlObject {
	const offX = String(Math.round(el.x * EMU_PER_PX));
	const offY = String(Math.round(el.y * EMU_PER_PX));
	const extCx = String(Math.round(Math.max(el.width, 1) * EMU_PER_PX));
	const extCy = String(Math.round(Math.max(el.height, 1) * EMU_PER_PX));

	const oleObj: XmlObject = {
		'@_showAsIcon': el.oleShowAsIcon ? '1' : '0',
		'@_imgW': el.oleImgW !== undefined ? String(el.oleImgW) : extCx,
		'@_imgH': el.oleImgH !== undefined ? String(el.oleImgH) : extCy,
	};
	if (el.oleProgId) {
		oleObj['@_progId'] = el.oleProgId;
	}
	if (el.oleName) {
		oleObj['@_name'] = el.oleName;
	}
	if (el.oleClsId) {
		oleObj['@_classid'] = el.oleClsId;
	}
	if (embedRelationshipId) {
		oleObj['@_r:id'] = embedRelationshipId;
	}
	if (el.isLinked) {
		oleObj['p:link'] = { '@_r:id': embedRelationshipId, '@_updateAutomatic': '1' };
	} else {
		oleObj['p:embed'] = {};
	}
	oleObj['p:pic'] = {
		'p:nvPicPr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.oleName || 'OleObject' },
			'p:cNvPicPr': {},
			'p:nvPr': {},
		},
		'p:blipFill': { 'a:blip': {}, 'a:stretch': { 'a:fillRect': {} } },
		'p:spPr': {
			'a:xfrm': {
				'a:off': { '@_x': offX, '@_y': offY },
				'a:ext': { '@_cx': extCx, '@_cy': extCy },
			},
			'a:prstGeom': { '@_prst': 'rect', 'a:avLst': {} },
		},
	};
	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.oleName || 'OleObject' },
			'p:cNvGraphicFramePr': { 'a:graphicFrameLocks': { '@_noChangeAspect': '1' } },
			'p:nvPr': {},
		},
		'p:xfrm': {
			'a:off': { '@_x': offX, '@_y': offY },
			'a:ext': { '@_cx': extCx, '@_cy': extCy },
		},
		'a:graphic': {
			'a:graphicData': { '@_uri': OLE_GRAPHIC_DATA_URI, 'p:oleObj': oleObj },
		},
	};
}

function applyOleTypedFieldUpdates(shape: XmlObject, el: OlePptxElement): void {
	const oleObj = shape['a:graphic']?.['a:graphicData']?.['p:oleObj'] as XmlObject | undefined;
	if (!oleObj) {
		return;
	}
	if (el.oleProgId) {
		oleObj['@_progId'] = el.oleProgId;
	}
	if (el.oleName !== undefined) {
		if (el.oleName.length > 0) {
			oleObj['@_name'] = el.oleName;
		} else {
			delete oleObj['@_name'];
		}
	}
	if (el.oleClsId) {
		oleObj['@_classid'] = el.oleClsId;
	}
	if (el.oleShowAsIcon !== undefined) {
		oleObj['@_showAsIcon'] = el.oleShowAsIcon ? '1' : '0';
	}
	if (el.oleImgW !== undefined) {
		oleObj['@_imgW'] = String(el.oleImgW);
	}
	if (el.oleImgH !== undefined) {
		oleObj['@_imgH'] = String(el.oleImgH);
	}
	if (el.isLinked === true) {
		if (!oleObj['p:link']) {
			const existingRid = String(
				(oleObj['p:embed'] as XmlObject | undefined)?.['@_r:id'] || oleObj['@_r:id'] || '',
			).trim();
			oleObj['p:link'] = existingRid
				? { '@_r:id': existingRid, '@_updateAutomatic': '1' }
				: { '@_updateAutomatic': '1' };
		}
		delete oleObj['p:embed'];
	} else if (el.isLinked === false) {
		if (!oleObj['p:embed']) {
			oleObj['p:embed'] = {};
		}
		delete oleObj['p:link'];
	}
}

const EMU_PER_PX = 9525;

// ---------------------------------------------------------------------------
// Ink path token parsing — reimplemented from createInkShapeXml
// ---------------------------------------------------------------------------
function parseInkPathTokens(svgPath: string): {
	moveTo: { x: number; y: number }[];
	lineTo: { x: number; y: number }[];
} {
	const moveToList: { x: number; y: number }[] = [];
	const lnToList: { x: number; y: number }[] = [];
	const tokens = svgPath.match(/[ML]\s*[\d.eE+-]+\s+[\d.eE+-]+/g);
	if (tokens) {
		for (const token of tokens) {
			const parts = token.trim().split(/\s+/);
			const cmd = parts[0];
			const x = parseFloat(parts[1]);
			const y = parseFloat(parts[2]);
			if (cmd === 'M') {
				moveToList.push({ x, y });
			} else if (cmd === 'L') {
				lnToList.push({ x, y });
			}
		}
	}
	return { moveTo: moveToList, lineTo: lnToList };
}

function buildInkShapeXml(el: {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	inkPaths: string[];
	inkColors?: string[];
	inkWidths?: number[];
	inkOpacities?: number[];
}): XmlObject {
	const offX = String(Math.round(el.x * EMU_PER_PX));
	const offY = String(Math.round(el.y * EMU_PER_PX));
	const extCx = String(Math.round(Math.max(el.width, 1) * EMU_PER_PX));
	const extCy = String(Math.round(Math.max(el.height, 1) * EMU_PER_PX));

	const xmlPaths: XmlObject[] = el.inkPaths.map((svgPath) => {
		const moveToList: XmlObject[] = [];
		const lnToList: XmlObject[] = [];
		const tokens = svgPath.match(/[ML]\s*[\d.eE+-]+\s+[\d.eE+-]+/g);
		if (tokens) {
			for (const token of tokens) {
				const parts = token.trim().split(/\s+/);
				const cmd = parts[0];
				const x = parseFloat(parts[1]);
				const y = parseFloat(parts[2]);
				const pt = {
					'@_x': String(Math.round(x * EMU_PER_PX)),
					'@_y': String(Math.round(y * EMU_PER_PX)),
				};
				if (cmd === 'M') {
					moveToList.push({ 'a:pt': pt });
				} else if (cmd === 'L') {
					lnToList.push({ 'a:pt': pt });
				}
			}
		}
		const pathXml: XmlObject = {
			'@_w': extCx,
			'@_h': extCy,
			'@_stroke': '1',
			'@_fill': 'none',
		};
		if (moveToList.length > 0) {
			pathXml['a:moveTo'] = moveToList.length === 1 ? moveToList[0] : moveToList;
		}
		if (lnToList.length > 0) {
			pathXml['a:lnTo'] = lnToList.length === 1 ? lnToList[0] : lnToList;
		}
		return pathXml;
	});

	const strokeColor = el.inkColors?.[0] ?? '#000000';
	const strokeWidth = el.inkWidths?.[0] ?? 2;
	const strokeOpacity = el.inkOpacities?.[0] ?? 1;
	const cleanColor = strokeColor.replace('#', '');

	return {
		'p:nvSpPr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.id },
			'p:cNvSpPr': {},
			'p:nvPr': {},
		},
		'p:spPr': {
			'a:xfrm': {
				'a:off': { '@_x': offX, '@_y': offY },
				'a:ext': { '@_cx': extCx, '@_cy': extCy },
			},
			'a:custGeom': {
				'a:avLst': {},
				'a:gdLst': {},
				'a:ahLst': {},
				'a:cxnLst': {},
				'a:rect': { '@_l': '0', '@_t': '0', '@_r': extCx, '@_b': extCy },
				'a:pathLst': {
					'a:path': xmlPaths.length === 1 ? xmlPaths[0] : xmlPaths,
				},
			},
			'a:noFill': {},
			'a:ln': {
				'@_w': String(Math.round(strokeWidth * EMU_PER_PX)),
				'@_cap': 'rnd',
				'a:solidFill': {
					'a:srgbClr': {
						'@_val': cleanColor,
						...(strokeOpacity < 1
							? {
									'a:alpha': {
										'@_val': String(Math.round(strokeOpacity * 100000)),
									},
								}
							: {}),
					},
				},
				'a:round': {},
			},
		},
	};
}

// ---------------------------------------------------------------------------
// Tests: parseInkPathTokens
// ---------------------------------------------------------------------------
describe('parseInkPathTokens', () => {
	it('should parse M and L commands', () => {
		const result = parseInkPathTokens('M 10 20 L 30 40 L 50 60');
		expect(result.moveTo).toStrictEqual([{ x: 10, y: 20 }]);
		expect(result.lineTo).toStrictEqual([
			{ x: 30, y: 40 },
			{ x: 50, y: 60 },
		]);
	});

	it('should handle multiple M commands', () => {
		const result = parseInkPathTokens('M 0 0 M 100 200');
		expect(result.moveTo).toHaveLength(2);
		expect(result.lineTo).toHaveLength(0);
	});

	it('should return empty arrays for non-matching path', () => {
		const result = parseInkPathTokens('C 10 20 30 40 50 60');
		expect(result.moveTo).toHaveLength(0);
		expect(result.lineTo).toHaveLength(0);
	});

	it('should handle empty string', () => {
		const result = parseInkPathTokens('');
		expect(result.moveTo).toHaveLength(0);
		expect(result.lineTo).toHaveLength(0);
	});

	it('should parse floating-point coordinates', () => {
		const result = parseInkPathTokens('M 1.5 2.75 L 3.25 4.125');
		expect(result.moveTo[0]).toStrictEqual({ x: 1.5, y: 2.75 });
		expect(result.lineTo[0]).toStrictEqual({ x: 3.25, y: 4.125 });
	});
});

// ---------------------------------------------------------------------------
// Tests: buildInkShapeXml
// ---------------------------------------------------------------------------
describe('buildInkShapeXml', () => {
	it('should create basic ink shape with correct transform', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			inkPaths: ['M 0 0 L 10 10'],
		});

		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		expect((xfrm['a:off'] as XmlObject)['@_x']).toBe(String(Math.round(10 * EMU_PER_PX)));
		expect((xfrm['a:off'] as XmlObject)['@_y']).toBe(String(Math.round(20 * EMU_PER_PX)));
	});

	it('should set element id and name', () => {
		const result = buildInkShapeXml({
			id: 'myInk',
			x: 0,
			y: 0,
			width: 50,
			height: 50,
			inkPaths: ['M 0 0'],
		});
		const nvSpPr = result['p:nvSpPr'] as XmlObject;
		expect((nvSpPr['p:cNvPr'] as XmlObject)['@_name']).toBe('myInk');
	});

	it('should use default stroke color #000000 when inkColors is undefined', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			inkPaths: ['M 0 0'],
		});
		const ln = (result['p:spPr'] as XmlObject)['a:ln'] as XmlObject;
		const fill = ln['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('000000');
	});

	it('should strip # from custom ink color', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			inkPaths: ['M 0 0'],
			inkColors: ['#FF0000'],
		});
		const ln = (result['p:spPr'] as XmlObject)['a:ln'] as XmlObject;
		const fill = ln['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
	});

	it('should include alpha when opacity is less than 1', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			inkPaths: ['M 0 0'],
			inkOpacities: [0.5],
		});
		const ln = (result['p:spPr'] as XmlObject)['a:ln'] as XmlObject;
		const srgb = (ln['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject;
		expect(srgb['a:alpha']).toBeDefined();
		expect((srgb['a:alpha'] as XmlObject)['@_val']).toBe(String(Math.round(0.5 * 100000)));
	});

	it('should not include alpha when opacity is 1', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			inkPaths: ['M 0 0'],
			inkOpacities: [1],
		});
		const ln = (result['p:spPr'] as XmlObject)['a:ln'] as XmlObject;
		const srgb = (ln['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject;
		expect(srgb['a:alpha']).toBeUndefined();
	});

	it('should clamp width to minimum 1 for zero-width elements', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			inkPaths: ['M 0 0'],
		});
		const spPr = result['p:spPr'] as XmlObject;
		const ext = (spPr['a:xfrm'] as XmlObject)['a:ext'] as XmlObject;
		expect(ext['@_cx']).toBe(String(Math.round(Number(EMU_PER_PX))));
		expect(ext['@_cy']).toBe(String(Math.round(Number(EMU_PER_PX))));
	});

	it('should unwrap single path (no array wrapper)', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			inkPaths: ['M 0 0 L 5 5'],
		});
		const custGeom = (result['p:spPr'] as XmlObject)['a:custGeom'] as XmlObject;
		const pathLst = custGeom['a:pathLst'] as XmlObject;
		// Single path should not be wrapped in an array
		expect(Array.isArray(pathLst['a:path'])).toBeFalsy();
	});

	it('should keep array for multiple paths', () => {
		const result = buildInkShapeXml({
			id: 'ink1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			inkPaths: ['M 0 0 L 5 5', 'M 1 1 L 2 2'],
		});
		const custGeom = (result['p:spPr'] as XmlObject)['a:custGeom'] as XmlObject;
		const pathLst = custGeom['a:pathLst'] as XmlObject;
		expect(Array.isArray(pathLst['a:path'])).toBeTruthy();
		expect(pathLst['a:path'] as XmlObject[]).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// Group shape child categorization — reimplemented from buildGroupShapeXml
// ---------------------------------------------------------------------------
describe('buildGroupShapeXml child categorization', () => {
	function categorizeChildren(
		children: Array<{
			type: string;
			rawXml?: XmlObject;
		}>,
	): { shapes: XmlObject[]; pics: XmlObject[]; connectors: XmlObject[] } {
		const shapes: XmlObject[] = [];
		const pics: XmlObject[] = [];
		const connectors: XmlObject[] = [];

		for (const child of children) {
			const xml = child.rawXml;
			if (!xml) {
				continue;
			}

			if (child.type === 'picture' || child.type === 'image') {
				pics.push(xml);
			} else if (child.type === 'connector') {
				connectors.push(xml);
			} else {
				shapes.push(xml);
			}
		}
		return { shapes, pics, connectors };
	}

	it('should categorize shape children', () => {
		const children = [
			{ type: 'text', rawXml: { name: 'text1' } as XmlObject },
			{ type: 'shape', rawXml: { name: 'shape1' } as XmlObject },
		];
		const result = categorizeChildren(children);
		expect(result.shapes).toHaveLength(2);
		expect(result.pics).toHaveLength(0);
		expect(result.connectors).toHaveLength(0);
	});

	it('should categorize picture children', () => {
		const children = [
			{ type: 'picture', rawXml: { name: 'pic1' } as XmlObject },
			{ type: 'image', rawXml: { name: 'img1' } as XmlObject },
		];
		const result = categorizeChildren(children);
		expect(result.pics).toHaveLength(2);
		expect(result.shapes).toHaveLength(0);
	});

	it('should categorize connector children', () => {
		const children = [{ type: 'connector', rawXml: { name: 'conn1' } as XmlObject }];
		const result = categorizeChildren(children);
		expect(result.connectors).toHaveLength(1);
	});

	it('should skip children without rawXml', () => {
		const children = [{ type: 'text' }, { type: 'shape' }];
		const result = categorizeChildren(children);
		expect(result.shapes).toHaveLength(0);
		expect(result.pics).toHaveLength(0);
		expect(result.connectors).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// OLE graphic-frame XML construction & updates
// ---------------------------------------------------------------------------

function makeOleElement(overrides: Partial<OlePptxElement> = {}): OlePptxElement {
	return {
		type: 'ole',
		id: 'ole1',
		x: 100,
		y: 200,
		width: 240,
		height: 180,
		oleProgId: 'Excel.Sheet.12',
		...overrides,
	} as OlePptxElement;
}

describe('createOleGraphicFrameXml', () => {
	it('emits showAsIcon=1 when oleShowAsIcon is true', () => {
		const xml = createOleGraphicFrameXml(makeOleElement({ oleShowAsIcon: true }), 'rId2');
		const oleObj = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['@_showAsIcon']).toBe('1');
	});

	it('emits showAsIcon=0 when oleShowAsIcon is false or undefined', () => {
		const xml = createOleGraphicFrameXml(makeOleElement({ oleShowAsIcon: false }), 'rId2');
		const oleObj = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['@_showAsIcon']).toBe('0');
	});

	it('honors typed oleImgW/oleImgH when present', () => {
		const xml = createOleGraphicFrameXml(
			makeOleElement({ oleImgW: 3048000, oleImgH: 2286000 }),
			'rId2',
		);
		const oleObj = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['@_imgW']).toBe('3048000');
		expect(oleObj['@_imgH']).toBe('2286000');
	});

	it('emits a <p:embed> child for embedded OLE objects', () => {
		const xml = createOleGraphicFrameXml(makeOleElement({ isLinked: false }), 'rId2');
		const oleObj = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['p:embed']).toBeDefined();
		expect(oleObj['p:link']).toBeUndefined();
	});

	it('emits a <p:link> child for linked OLE objects', () => {
		const xml = createOleGraphicFrameXml(makeOleElement({ isLinked: true }), 'rId2');
		const oleObj = ((xml['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['p:link']).toBeDefined();
		expect(oleObj['p:embed']).toBeUndefined();
	});
});

describe('applyOleTypedFieldUpdates', () => {
	function makeOleShape(initial: XmlObject): XmlObject {
		return {
			'a:graphic': {
				'a:graphicData': {
					'@_uri': 'http://schemas.openxmlformats.org/presentationml/2006/ole',
					'p:oleObj': initial,
				},
			},
		};
	}

	it('round-trips showAsIcon back into the existing rawXml', () => {
		const shape = makeOleShape({
			'@_showAsIcon': '0',
			'@_progId': 'Excel.Sheet.12',
			'p:embed': {},
		});
		applyOleTypedFieldUpdates(shape, makeOleElement({ oleShowAsIcon: true }));
		const oleObj = ((shape['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['@_showAsIcon']).toBe('1');
	});

	it('switches embedded → linked when isLinked is set to true', () => {
		const shape = makeOleShape({
			'@_progId': 'Excel.Sheet.12',
			'@_r:id': 'rId2',
			'p:embed': {},
		});
		applyOleTypedFieldUpdates(shape, makeOleElement({ isLinked: true }));
		const oleObj = ((shape['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['p:link']).toBeDefined();
		expect(oleObj['p:embed']).toBeUndefined();
	});

	it('switches linked → embedded when isLinked is set to false', () => {
		const shape = makeOleShape({
			'@_progId': 'Excel.Sheet.12',
			'p:link': { '@_r:id': 'rId4' },
		});
		applyOleTypedFieldUpdates(shape, makeOleElement({ isLinked: false }));
		const oleObj = ((shape['a:graphic'] as XmlObject)['a:graphicData'] as XmlObject)[
			'p:oleObj'
		] as XmlObject;
		expect(oleObj['p:embed']).toBeDefined();
		expect(oleObj['p:link']).toBeUndefined();
	});
});
