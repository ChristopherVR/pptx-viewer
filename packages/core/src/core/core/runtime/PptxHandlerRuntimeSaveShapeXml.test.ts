/**
 * Tests for PptxHandlerRuntimeSaveShapeXml:
 *   - createInkShapeXml logic (ink path token parsing, shape XML generation)
 *   - buildGroupShapeXml logic (group structure, child categorization)
 *   - createOleGraphicFrameXml + applyOleTypedFieldUpdates (OLE round-trip)
 *
 * The group-shape and ChartEx blocks at the bottom import the REAL production
 * symbols (`save-group-shape-xml`, `PptxHandler`) rather than re-implementing
 * them, so they actually pin the writer's behaviour.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type {
	GroupPptxElement,
	OlePptxElement,
	PptxData,
	PptxElement,
	XmlObject,
} from '../../types';
import {
	createGroupChildCollectors,
	pickGroupChildFromCollectors,
} from './save-group-child-collectors';
import {
	GROUP_CHILD_TAGS,
	appendGroupChildren,
	applyGroupChildTransform,
	buildGroupNonVisualXml,
	buildGroupPropertiesXml,
	buildGroupTransformXml,
	classifyGroupChildTag,
} from './save-group-shape-xml';

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
// Group child routing: the REAL `classifyGroupChildTag` decision function.
//
// Regression guard for the P0 corruption: `<p:grpSp>` used to have exactly
// three buckets (pic / cxnSp / everything-else -> `p:sp`), so grouping a chart,
// table, SmartArt, OLE object, media clip or nested group emitted
// `<p:sp><p:nvGraphicFramePr>`, invalid against CT_GroupShape (§19.3.1.45),
// which PowerPoint answers with the file-repair dialog.
// ---------------------------------------------------------------------------
describe('classifyGroupChildTag', () => {
	const graphicFrame: XmlObject = {
		'p:nvGraphicFramePr': { 'p:cNvPr': { '@_id': '5', '@_name': 'Chart 1' } },
		'p:xfrm': {},
		'a:graphic': { 'a:graphicData': { '@_uri': 'urn:x' } },
	};

	it.each(['chart', 'table', 'smartArt', 'ole', 'media'] as const)(
		'routes a %s graphic frame to p:graphicFrame, never p:sp',
		(type) => {
			expect(classifyGroupChildTag(type, graphicFrame)).toBe('p:graphicFrame');
		},
	);

	it('routes a graphic frame with no nvGraphicFramePr but a:graphic + p:xfrm', () => {
		expect(classifyGroupChildTag('chart', { 'p:xfrm': {}, 'a:graphic': {} })).toBe(
			'p:graphicFrame',
		);
	});

	it('routes a nested group to p:grpSp', () => {
		expect(classifyGroupChildTag('group', { 'p:nvGrpSpPr': {}, 'p:grpSpPr': {} })).toBe('p:grpSp');
	});

	it('routes a content part to p:contentPart', () => {
		expect(classifyGroupChildTag('contentPart', { '@_r:id': 'rId3' })).toBe('p:contentPart');
	});

	it('routes shapes and text to p:sp', () => {
		expect(classifyGroupChildTag('shape', { 'p:nvSpPr': {}, 'p:spPr': {} })).toBe('p:sp');
		expect(classifyGroupChildTag('text', {})).toBe('p:sp');
	});

	it('routes pictures and images to p:pic', () => {
		expect(classifyGroupChildTag('picture', { 'p:nvPicPr': {} })).toBe('p:pic');
		expect(classifyGroupChildTag('image', {})).toBe('p:pic');
	});

	it('routes connectors to p:cxnSp', () => {
		expect(classifyGroupChildTag('connector', { 'p:nvCxnSpPr': {} })).toBe('p:cxnSp');
	});

	it('prefers the markup shape over the typed discriminant for p:pic-shaped media', () => {
		// Real PowerPoint stores video/audio as `p:pic`, not a graphic frame.
		expect(classifyGroupChildTag('media', { 'p:nvPicPr': {} })).toBe('p:pic');
	});

	it('routes a 3D model and the zoom family to their own tags', () => {
		expect(classifyGroupChildTag('model3d', { 'p16:model3Drel': { '@_r:id': 'rId9' } })).toBe(
			'p16:model3D',
		);
		expect(classifyGroupChildTag('zoom', { 'pslz:sldZmObj': {} })).toBe('pslz:sldZm');
		expect(classifyGroupChildTag('zoom', { 'psezm:sectionZmObj': {} })).toBe('psezm:sectionZm');
		expect(classifyGroupChildTag('zoom', { 'psuz:summaryZmObj': {} })).toBe('psuz:summaryZm');
	});

	it('returns null for a node it cannot place, rather than defaulting to p:sp', () => {
		expect(classifyGroupChildTag('unknown', { 'vendor:thing': {} })).toBeNull();
	});
});

describe('appendGroupChildren', () => {
	it('emits every CT_GroupShape bucket and keeps p:extLst last', () => {
		const grpXml: XmlObject = {
			'p:nvGrpSpPr': {},
			'p:grpSpPr': {},
			'p:extLst': { 'p:ext': { '@_uri': 'urn:keep' } },
		};
		appendGroupChildren(grpXml, [
			{ tag: 'p:pic', xml: { id: 'pic' } },
			{ tag: 'p:graphicFrame', xml: { id: 'frame' } },
			{ tag: 'p:sp', xml: { id: 'sp' } },
			{ tag: 'p:grpSp', xml: { id: 'grp' } },
			{ tag: 'p:cxnSp', xml: { id: 'cxn' } },
			{ tag: 'p:contentPart', xml: { id: 'part' } },
		]);

		expect(grpXml['p:graphicFrame']).toStrictEqual({ id: 'frame' });
		expect(grpXml['p:grpSp']).toStrictEqual({ id: 'grp' });
		expect(grpXml['p:contentPart']).toStrictEqual({ id: 'part' });
		const keys = Object.keys(grpXml);
		expect(keys[0]).toBe('p:nvGrpSpPr');
		expect(keys[1]).toBe('p:grpSpPr');
		expect(keys.at(-1)).toBe('p:extLst');
		// Document order, not per-tag grouping: the picture was authored first.
		expect(keys.indexOf('p:pic')).toBeLessThan(keys.indexOf('p:sp'));
	});

	it('preserves intra-group paint order for a picture behind later shapes', () => {
		// CT_GroupShape is a painter's-algorithm sequence. Per-tag arrays used
		// to hoist the picture in front of every shape in the group.
		const grpXml: XmlObject = { 'p:nvGrpSpPr': {}, 'p:grpSpPr': {} };
		appendGroupChildren(grpXml, [
			{ tag: 'p:pic', xml: { id: 'backdrop' } },
			{ tag: 'p:sp', xml: { id: 'a' } },
			{ tag: 'p:sp', xml: { id: 'b' } },
			{ tag: 'p:pic', xml: { id: 'badge' } },
			{ tag: 'p:sp', xml: { id: 'c' } },
		]);

		expect(Object.keys(grpXml)).toStrictEqual([
			'p:nvGrpSpPr',
			'p:grpSpPr',
			'p:pic',
			'p:sp',
			'p:pic#pptx-order-2',
			'p:sp#pptx-order-3',
		]);
		expect(grpXml['p:sp']).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
		expect(grpXml['p:pic#pptx-order-2']).toStrictEqual({ id: 'badge' });
	});

	it('leaves an already-grouped child list marker-free', () => {
		const grpXml: XmlObject = { 'p:nvGrpSpPr': {}, 'p:grpSpPr': {} };
		appendGroupChildren(grpXml, [
			{ tag: 'p:sp', xml: { id: 'a' } },
			{ tag: 'p:sp', xml: { id: 'b' } },
			{ tag: 'p:pic', xml: { id: 'p' } },
		]);
		expect(Object.keys(grpXml)).toStrictEqual(['p:nvGrpSpPr', 'p:grpSpPr', 'p:sp', 'p:pic']);
	});

	it('omits buckets with no children', () => {
		const grpXml: XmlObject = { 'p:nvGrpSpPr': {}, 'p:grpSpPr': {} };
		appendGroupChildren(grpXml, [{ tag: 'p:sp', xml: {} }]);
		for (const tag of GROUP_CHILD_TAGS) {
			if (tag !== 'p:sp') {
				expect(grpXml[tag]).toBeUndefined();
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Group identity: the REAL nvGrpSpPr / grpSpPr builders.
//
// `p:nvGrpSpPr/p:cNvPr/@id` is what `p:timing`'s `p:spTgt/@spid`, the
// Selection Pane and `a:hlinkClick` bind to. The writer used to fabricate a
// fresh skeleton (`id="0"`, `name=<internal element id>`) for every parsed
// group, silently unbinding every animation on it and dropping the whole
// `p:grpSpPr` (fill, effects, `a:grpSpLocks`).
// ---------------------------------------------------------------------------
describe('buildGroupNonVisualXml', () => {
	const rawGroup: XmlObject = {
		'p:nvGrpSpPr': {
			'p:cNvPr': {
				'@_id': '10',
				'@_name': 'Group 1',
				'@_descr': 'org chart',
				'a:hlinkClick': { '@_r:id': 'rId7' },
			},
			'p:cNvGrpSpPr': { 'a:grpSpLocks': { '@_noUngrp': '1' } },
			'p:nvPr': {},
		},
	};

	it('preserves the original id, name, alt text, hyperlink and group locks', () => {
		const nv = buildGroupNonVisualXml(rawGroup, undefined, 'slide1-group-0');
		const cNvPr = nv['p:cNvPr'] as XmlObject;
		expect(cNvPr['@_id']).toBe('10');
		expect(cNvPr['@_name']).toBe('Group 1');
		expect(cNvPr['@_descr']).toBe('org chart');
		expect(cNvPr['a:hlinkClick']).toStrictEqual({ '@_r:id': 'rId7' });
		expect((nv['p:cNvGrpSpPr'] as XmlObject)['a:grpSpLocks']).toStrictEqual({ '@_noUngrp': '1' });
	});

	it('does not mutate the loaded tree', () => {
		const nv = buildGroupNonVisualXml(rawGroup, undefined, 'fallback');
		(nv['p:cNvPr'] as XmlObject)['@_id'] = '999';
		const original = (rawGroup['p:nvGrpSpPr'] as XmlObject)['p:cNvPr'] as XmlObject;
		expect(original['@_id']).toBe('10');
	});

	it('lets a model rename win over the original markup name', () => {
		// Groups never reach `applyNameToCnvPr` (the element writer returns
		// early for them), so the rename has to be applied right here.
		const nv = buildGroupNonVisualXml(rawGroup, 'RENAMED-GROUP', 'fallback');
		expect((nv['p:cNvPr'] as XmlObject)['@_name']).toBe('RENAMED-GROUP');
		expect((nv['p:cNvPr'] as XmlObject)['@_id']).toBe('10');
	});

	it('honours an explicit empty model name without dropping the attribute', () => {
		const nv = buildGroupNonVisualXml(rawGroup, '', 'fallback');
		expect((nv['p:cNvPr'] as XmlObject)['@_name']).toBe('');
	});

	it('fabricates a skeleton only when the group has no original markup', () => {
		const nv = buildGroupNonVisualXml(undefined, undefined, 'My Group');
		expect(nv).toStrictEqual({
			'p:cNvPr': { '@_id': '0', '@_name': 'My Group' },
			'p:cNvGrpSpPr': {},
			'p:nvPr': {},
		});
	});
});

describe('buildGroupPropertiesXml', () => {
	it('keeps the original group fill and puts the rebuilt a:xfrm first', () => {
		const rawGroup: XmlObject = {
			'p:grpSpPr': {
				'a:xfrm': { 'a:off': { '@_x': '1' } },
				'a:solidFill': { 'a:schemeClr': { '@_val': 'accent1' } },
				'a:effectLst': {},
			},
		};
		const xfrm: XmlObject = { 'a:off': { '@_x': '42', '@_y': '42' } };
		const props = buildGroupPropertiesXml(rawGroup, xfrm);
		expect(Object.keys(props)[0]).toBe('a:xfrm');
		expect(props['a:xfrm']).toBe(xfrm);
		expect(props['a:solidFill']).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent1' } });
		expect(props['a:effectLst']).toStrictEqual({});
	});

	it('puts a:xfrm first even when the original had none (CT_GroupShapeProperties is a sequence)', () => {
		const props = buildGroupPropertiesXml({ 'p:grpSpPr': { 'a:solidFill': {} } }, { 'a:off': {} });
		expect(Object.keys(props)).toStrictEqual(['a:xfrm', 'a:solidFill']);
	});
});

describe('buildGroupTransformXml', () => {
	it('resets the child coordinate space to the group extent', () => {
		const xfrm = buildGroupTransformXml(
			{ x: 10, y: 20, width: 100, height: 50, rotation: 90, flipHorizontal: true },
			EMU_PER_PX,
		);
		expect(xfrm['@_rot']).toBe(String(90 * 60000));
		expect(xfrm['@_flipH']).toBe('1');
		expect(xfrm['a:chOff']).toStrictEqual({ '@_x': '0', '@_y': '0' });
		expect(xfrm['a:chExt']).toStrictEqual(xfrm['a:ext']);
	});
});

describe('applyGroupChildTransform', () => {
	it('rewrites a graphic frame transform at p:xfrm', () => {
		const xml: XmlObject = { 'p:nvGraphicFramePr': {}, 'p:xfrm': {}, 'a:graphic': {} };
		applyGroupChildTransform(xml, { x: 3, y: 4, width: 5, height: 6 }, EMU_PER_PX);
		expect((xml['p:xfrm'] as XmlObject)['a:off']).toStrictEqual({
			'@_x': String(3 * EMU_PER_PX),
			'@_y': String(4 * EMU_PER_PX),
		});
	});

	it('rewrites a nested group transform at p:grpSpPr/a:xfrm', () => {
		const xml: XmlObject = { 'p:nvGrpSpPr': {}, 'p:grpSpPr': { 'a:xfrm': {} } };
		applyGroupChildTransform(xml, { x: 1, y: 1, width: 2, height: 2 }, EMU_PER_PX);
		const xfrm = (xml['p:grpSpPr'] as XmlObject)['a:xfrm'] as XmlObject;
		expect((xfrm['a:ext'] as XmlObject)['@_cx']).toBe(String(2 * EMU_PER_PX));
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

// ---------------------------------------------------------------------------
// End-to-end round-trips through the real save pipeline.
// ---------------------------------------------------------------------------

function fixturePath(name: string): string {
	return fileURLToPath(new URL(`../../../../../../e2e/fixtures/${name}`, import.meta.url));
}

async function loadFixture(name: string): Promise<{ handler: PptxHandler; data: PptxData }> {
	const bytes = readFileSync(fixturePath(name));
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, data };
}

async function slideXmlFrom(saved: Uint8Array, part = 'ppt/slides/slide1.xml'): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	return zip.file(part)!.async('string');
}

const CHART_GALLERY = 'chart-gallery.pptx';
const LINKED_TEXTBOX = 'linked-textbox.pptx';

describe.runIf(existsSync(fixturePath(CHART_GALLERY)))(
	'grouping a graphic frame (save round-trip)',
	() => {
		it('writes a grouped chart as <p:graphicFrame>, not <p:sp>', async () => {
			const { handler, data } = await loadFixture(CHART_GALLERY);
			const slide = data.slides[0];
			const chart = slide.elements.find((el) => el.type === 'chart');
			expect(chart).toBeDefined();

			const group: GroupPptxElement = {
				type: 'group',
				id: 'grp-chart',
				x: chart!.x,
				y: chart!.y,
				width: chart!.width,
				height: chart!.height,
				children: [{ ...chart!, x: 0, y: 0 } as PptxElement],
			};
			slide.elements = [group, ...slide.elements.filter((el) => el.type !== 'chart')];
			slide.isDirty = true;

			const xml = await slideXmlFrom(await handler.save(data.slides));
			const grpSp = xml.slice(xml.indexOf('<p:grpSp>'), xml.indexOf('</p:grpSp>'));

			expect(grpSp).toContain('<p:graphicFrame>');
			// The P0: CT_Shape may not carry p:nvGraphicFramePr / a:graphic.
			expect(grpSp).not.toContain('<p:sp>');
			expect(xml).not.toMatch(/<p:sp>\s*<p:nvGraphicFramePr/u);
		});

		it('re-parses the grouped chart as a chart element', async () => {
			const { handler, data } = await loadFixture(CHART_GALLERY);
			const slide = data.slides[0];
			const chart = slide.elements.find((el) => el.type === 'chart')!;
			slide.elements = [
				{
					type: 'group',
					id: 'grp-chart',
					x: chart.x,
					y: chart.y,
					width: chart.width,
					height: chart.height,
					children: [{ ...chart, x: 0, y: 0 } as PptxElement],
				} satisfies GroupPptxElement,
			];
			slide.isDirty = true;

			const saved = await handler.save(data.slides);
			const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
			const group = reloaded.slides[0].elements.find((el) => el.type === 'group');
			expect(group).toBeDefined();
			expect((group as GroupPptxElement).children.map((child) => child.type)).toStrictEqual([
				'chart',
			]);
		});
	},
);

describe.runIf(existsSync(fixturePath(LINKED_TEXTBOX)))('group identity (save round-trip)', () => {
	it('keeps every group cNvPr id and name so p:spTgt/@spid still resolves', async () => {
		const { handler, data } = await loadFixture(LINKED_TEXTBOX);
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const xml = await slideXmlFrom(await handler.save(data.slides));

		const names = [
			...xml.matchAll(/<p:grpSp><p:nvGrpSpPr><p:cNvPr id="(\d+)" name="([^"]*)"/gu),
		].map((match) => `${match[1]}:${match[2]}`);
		expect(names).toContain('20:GroupB');
		expect(names).toContain('30:GroupC-outer');
		expect(names).toContain('40:GroupD');
		// The old writer emitted the internal element id as the name.
		expect(xml).not.toContain('name="ppt/slides/slide1.xml-group-');
	});
});

describe('chartEx graphic frame markup', () => {
	it('emits <cx:chart> in the chartex namespace, not the 2006 <c:chart>', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'funnel',
					{
						categories: ['Lead', 'Qualified', 'Won'],
						series: [{ name: 'Opportunities', values: [120, 75, 30], color: '#4472C4' }],
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const xml = await slideXmlFrom(await handler.save(data.slides));
		expect(xml).toContain('uri="http://schemas.microsoft.com/office/drawing/2014/chartex"');
		expect(xml).toContain(
			'<cx:chart xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"',
		);
		expect(xml).not.toContain('<c:chart');
	});

	it('still emits <c:chart> in the 2006 namespace for a classic chart', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'bar',
					{
						categories: ['A', 'B'],
						series: [{ name: 'S', values: [1, 2] }],
					},
					{ x: 50, y: 50, width: 400, height: 300 },
				)
				.build(),
		);

		const xml = await slideXmlFrom(await handler.save(data.slides));
		expect(xml).toContain('uri="http://schemas.openxmlformats.org/drawingml/2006/chart"');
		expect(xml).toContain(
			'<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"',
		);
		expect(xml).not.toContain('<cx:chart');
	});
});

// ---------------------------------------------------------------------------
// Collector read-back: how a child serialised by the element writer is mapped
// back onto its CT_GroupShape tag.
// ---------------------------------------------------------------------------
describe('pickGroupChildFromCollectors', () => {
	it('returns null when the element writer skipped the child', () => {
		expect(pickGroupChildFromCollectors(createGroupChildCollectors())).toBeNull();
	});

	it.each([
		['shapes', 'p:sp'],
		['pics', 'p:pic'],
		['connectors', 'p:cxnSp'],
		['graphicFrames', 'p:graphicFrame'],
		['groups', 'p:grpSp'],
		['model3ds', 'p16:model3D'],
		['contentParts', 'p:contentPart'],
	] as const)('maps the %s collector to %s', (bucket, tag) => {
		const collectors = createGroupChildCollectors();
		collectors[bucket].push({ id: 'x' });
		expect(pickGroupChildFromCollectors(collectors)).toStrictEqual({ tag, xml: { id: 'x' } });
	});

	it('splits the shared zoom collector by node shape', () => {
		const collectors = createGroupChildCollectors();
		collectors.zooms.push({ 'psuz:summaryZmObj': {} });
		expect(pickGroupChildFromCollectors(collectors)?.tag).toBe('psuz:summaryZm');
	});
});

// ---------------------------------------------------------------------------
// Edits to a shape INSIDE a group must reach the file.
//
// Group children used to serialise from their own rawXml with only the
// transform patched, so a text, fill, stroke or geometry edit to a grouped
// shape was silently dropped on save: the UI showed it, the saved deck did
// not. The XML always differs after a round-trip (text bodies are
// regenerated), so these assert the specific mutated value, and the reloaded
// model, never "the XML changed".
// ---------------------------------------------------------------------------
describe.runIf(existsSync(fixturePath(LINKED_TEXTBOX)))(
	'group child edits (save round-trip)',
	() => {
		const EDITED = 'EDITED_CHILD_TEXT';

		function editChild(child: PptxElement): void {
			if ('text' in child) {
				child.text = EDITED;
			}
			if ('paragraphs' in child && Array.isArray(child.paragraphs)) {
				for (const paragraph of child.paragraphs) {
					for (const segment of paragraph.segments ?? []) {
						segment.text = EDITED;
					}
				}
			}
			child.x = 123;
			child.y = 45;
			if ('shapeStyle' in child) {
				child.shapeStyle = { ...(child.shapeStyle ?? {}), fillMode: 'solid', fillColor: '#FF00FF' };
			}
		}

		it('persists a grouped shape text, fill and position edit', async () => {
			const { handler, data } = await loadFixture(LINKED_TEXTBOX);
			const slide = data.slides.find((s) => s.elements.some((el) => el.type === 'group'))!;
			const group = slide.elements.find((el) => el.type === 'group') as GroupPptxElement;
			editChild(group.children[0]);
			slide.isDirty = true;

			const saved = await handler.save(data.slides);
			const xml = await slideXmlFrom(saved, slide.id);
			const grpSp = xml.slice(xml.indexOf('<p:grpSp>'), xml.indexOf('</p:grpSp>'));

			expect(grpSp).toContain(EDITED);
			expect(grpSp).toContain('FF00FF');
			expect(grpSp).toContain(`x="${Math.round(123 * EMU_PER_PX)}"`);

			const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
			const rGroup = reloaded.slides
				.find((s) => s.id === slide.id)!
				.elements.find((el) => el.type === 'group') as GroupPptxElement;
			const rChild = rGroup.children[0];
			expect(rChild.text).toBe(EDITED);
			expect(rChild.x).toBeCloseTo(123, 0);
			expect(rChild.shapeStyle?.fillColor?.toUpperCase()).toContain('FF00FF');
		});

		it('persists an edit to a child nested two groups deep', async () => {
			const { handler, data } = await loadFixture(LINKED_TEXTBOX);
			const slide = data.slides.find((s) => s.elements.some((el) => el.type === 'group'))!;
			const source = slide.elements.find((el) => el.type === 'group') as GroupPptxElement;
			const leaf = { ...source.children[0], x: 0, y: 0 } as PptxElement;
			editChild(leaf);

			slide.elements = [
				{
					type: 'group',
					id: 'outer',
					x: 20,
					y: 20,
					width: 400,
					height: 200,
					children: [
						{
							type: 'group',
							id: 'inner',
							x: 10,
							y: 10,
							width: 200,
							height: 100,
							children: [leaf],
						} satisfies GroupPptxElement,
					],
				} satisfies GroupPptxElement,
			];
			slide.isDirty = true;

			const xml = await slideXmlFrom(await handler.save(data.slides), slide.id);
			expect(xml.match(/<p:grpSp>/gu) ?? []).toHaveLength(2);
			expect(xml).toContain(EDITED);
			expect(xml).toContain('FF00FF');
		});
	},
);

describe.runIf(existsSync(fixturePath(CHART_GALLERY)))(
	'intra-group paint order (save round-trip)',
	() => {
		async function savedGroupTagOrder(chartFirst: boolean): Promise<string[]> {
			const { handler, data } = await loadFixture(CHART_GALLERY);
			const slide = data.slides[0];
			const chart = slide.elements.find((el) => el.type === 'chart')!;
			const text = slide.elements.find((el) => el.type === 'text')!;
			const children = chartFirst ? [chart, text] : [text, chart];
			slide.elements = [
				{
					type: 'group',
					id: 'grp-order',
					x: 0,
					y: 0,
					width: 600,
					height: 400,
					children: children.map((child) => ({ ...child }) as PptxElement),
				} satisfies GroupPptxElement,
			];
			slide.isDirty = true;

			const xml = await slideXmlFrom(await handler.save(data.slides));
			const grpSp = xml.slice(xml.indexOf('</p:grpSpPr>'), xml.indexOf('</p:grpSp>'));
			return [
				{ tag: 'p:sp', at: grpSp.indexOf('<p:sp>') },
				{ tag: 'p:graphicFrame', at: grpSp.indexOf('<p:graphicFrame>') },
			]
				.filter((entry) => entry.at >= 0)
				.sort((a, b) => a.at - b.at)
				.map((entry) => entry.tag);
		}

		it('emits group children in model order, not grouped by tag', async () => {
			// CT_GroupShape is a painter's-algorithm list, so this IS z-order.
			await expect(savedGroupTagOrder(true)).resolves.toStrictEqual(['p:graphicFrame', 'p:sp']);
			await expect(savedGroupTagOrder(false)).resolves.toStrictEqual(['p:sp', 'p:graphicFrame']);
		});

		it('never leaks an ordering marker into the serialized XML', async () => {
			const { handler, data } = await loadFixture(CHART_GALLERY);
			const slide = data.slides[0];
			const chart = slide.elements.find((el) => el.type === 'chart')!;
			const text = slide.elements.find((el) => el.type === 'text')!;
			slide.elements = [
				{
					type: 'group',
					id: 'grp-order',
					x: 0,
					y: 0,
					width: 600,
					height: 400,
					children: [{ ...chart }, { ...text }, { ...chart, id: 'c2' }] as PptxElement[],
				} satisfies GroupPptxElement,
			];
			slide.isDirty = true;

			// Saving twice proves the markers are not written back into the
			// cached slide tree.
			await handler.save(data.slides);
			const xml = await slideXmlFrom(await handler.save(data.slides));
			expect(xml).not.toContain('#pptx-order-');
			expect(xml).toContain('<p:graphicFrame>');
		});
	},
);
