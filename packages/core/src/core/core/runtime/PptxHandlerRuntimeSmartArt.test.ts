import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxSmartArtDrawingShape } from '../../types';
import {
	collectDrawingShapeNodes,
	parseDrawingRelTargets,
	parseDrawingShapesFromPart,
	picBlipEmbedId,
} from './smartart-drawing-blip';
import type { DrawingBlipDeps } from './smartart-drawing-blip';

// ---------------------------------------------------------------------------
// Local-name XML accessors (mirror xmlLookupService for the tests, matching on
// the part of a prefixed key after the colon).
// ---------------------------------------------------------------------------
function getChild(parent: XmlObject | undefined, localName: string): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	for (const [key, value] of Object.entries(parent)) {
		const local = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
		if (local === localName && value && typeof value === 'object' && !Array.isArray(value)) {
			return value as XmlObject;
		}
	}
	return undefined;
}

function getChildren(parent: XmlObject | undefined, localName: string): XmlObject[] {
	if (!parent) {
		return [];
	}
	for (const [key, value] of Object.entries(parent)) {
		const local = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
		if (local !== localName) {
			continue;
		}
		if (Array.isArray(value)) {
			return value.filter(
				(entry): entry is XmlObject =>
					typeof entry === 'object' && entry !== null && !Array.isArray(entry),
			);
		}
		if (value && typeof value === 'object') {
			return [value as XmlObject];
		}
	}
	return [];
}

function ensureArray(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter((v): v is XmlObject => typeof v === 'object' && v !== null);
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

/**
 * Stub of the real `parseDrawingShape`: builds a minimal shape and captures a
 * blip embed id found in the shape's own `spPr` (as `dsp:sp` carries it).
 */
function stubParseDrawingShape(node: XmlObject, index: number): PptxSmartArtDrawingShape | null {
	const spPr = getChild(node, 'spPr');
	if (!spPr) {
		return null;
	}
	const shape: PptxSmartArtDrawingShape = {
		id: String(node['@_modelId'] || `dsp-${index}`),
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
	};
	const blip = getChild(getChild(spPr, 'blipFill'), 'blip');
	const embed = blip ? String(blip['@_r:embed'] || '').trim() : '';
	if (embed) {
		shape.fillBlipEmbedId = embed;
	}
	return shape;
}

/** Build injected deps over an in-memory `{ path: xmlJson }` archive. */
function makeDeps(files: Record<string, string>): DrawingBlipDeps {
	return {
		readText: (path) => Promise.resolve(files[path]),
		parse: (xml) => JSON.parse(xml) as XmlObject,
		getChild,
		getChildren,
		parseDrawingShape: (node, index) => stubParseDrawingShape(node, index),
		emuPerPx: 9525,
		ensureArray,
		resolveImagePath: (base, target) => {
			const dir = base.slice(0, base.lastIndexOf('/'));
			if (target.startsWith('../')) {
				return `${dir.slice(0, dir.lastIndexOf('/'))}/${target.slice(3)}`;
			}
			return `${dir}/${target}`;
		},
		getImageData: (path) =>
			Promise.resolve(path === 'ppt/media/image1.png' ? 'data:image/png;base64,AAAA' : undefined),
	};
}

// ---------------------------------------------------------------------------
// collectDrawingShapeNodes
// ---------------------------------------------------------------------------
describe('collectDrawingShapeNodes', () => {
	it('enumerates top-level sp, bare pic, and sp nested in grpSp', () => {
		const spTree: XmlObject = {
			'dsp:sp': { '@_modelId': 'top' },
			'dsp:pic': { '@_modelId': 'pic' },
			'dsp:grpSp': {
				'dsp:sp': { '@_modelId': 'nested' },
				'dsp:grpSp': { 'dsp:sp': { '@_modelId': 'deep' } },
			},
		};
		const nodes = collectDrawingShapeNodes(spTree, getChildren);
		const ids = nodes.map((n) => String(n.node['@_modelId']));
		expect(ids).toContain('top');
		expect(ids).toContain('pic');
		expect(ids).toContain('nested');
		expect(ids).toContain('deep');
		expect(nodes.find((n) => n.node['@_modelId'] === 'pic')?.isPic).toBeTruthy();
		expect(nodes.find((n) => n.node['@_modelId'] === 'top')?.isPic).toBeFalsy();
	});

	it('returns an empty list for an undefined tree', () => {
		expect(collectDrawingShapeNodes(undefined, getChildren)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// picBlipEmbedId
// ---------------------------------------------------------------------------
describe('picBlipEmbedId', () => {
	it('reads r:embed from a pic blipFill (sibling of spPr)', () => {
		const pic: XmlObject = { 'dsp:blipFill': { 'a:blip': { '@_r:embed': 'rId9' } } };
		expect(picBlipEmbedId(pic, getChild)).toBe('rId9');
	});

	it('returns undefined when there is no blip', () => {
		expect(picBlipEmbedId({ 'dsp:spPr': {} }, getChild)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// parseDrawingRelTargets
// ---------------------------------------------------------------------------
describe('parseDrawingRelTargets', () => {
	it('maps relationship ids to targets', () => {
		const xml = JSON.stringify({
			Relationships: {
				Relationship: [
					{ '@_Id': 'rId1', '@_Target': '../media/image1.png' },
					{ '@_Id': 'rId2', '@_Target': '' },
				],
			},
		});
		const map = parseDrawingRelTargets(xml, JSON.parse, ensureArray);
		expect(map.get('rId1')).toBe('../media/image1.png');
		expect(map.has('rId2')).toBeFalsy();
	});

	it('returns an empty map on malformed input', () => {
		expect(parseDrawingRelTargets('not-json', JSON.parse, ensureArray).size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// parseDrawingShapesFromPart (integration)
// ---------------------------------------------------------------------------
describe('parseDrawingShapesFromPart', () => {
	const drawingPath = 'ppt/diagrams/drawing1.xml';
	const relsPath = 'ppt/diagrams/_rels/drawing1.xml.rels';
	const relsXml = JSON.stringify({
		Relationships: { Relationship: { '@_Id': 'rId1', '@_Target': '../media/image1.png' } },
	});

	it('resolves a dsp:sp blipFill embed id to a fillImageUrl data URL', async () => {
		const drawingXml = JSON.stringify({
			'dsp:drawing': {
				'dsp:spTree': {
					'dsp:sp': {
						'@_modelId': 's1',
						'dsp:spPr': { 'a:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } } },
					},
				},
			},
		});
		const shapes = await parseDrawingShapesFromPart(
			drawingPath,
			makeDeps({ [drawingPath]: drawingXml, [relsPath]: relsXml }),
		);
		expect(shapes).toHaveLength(1);
		expect(shapes[0].fillBlipEmbedId).toBe('rId1');
		expect(shapes[0].fillImageUrl).toBe('data:image/png;base64,AAAA');
	});

	it('resolves a bare dsp:pic blip and enumerates a grpSp-nested shape', async () => {
		const drawingXml = JSON.stringify({
			'dsp:drawing': {
				'dsp:spTree': {
					'dsp:pic': {
						'@_modelId': 'p1',
						'dsp:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } },
						'dsp:spPr': {},
					},
					'dsp:grpSp': { 'dsp:sp': { '@_modelId': 'nested', 'dsp:spPr': {} } },
				},
			},
		});
		const shapes = await parseDrawingShapesFromPart(
			drawingPath,
			makeDeps({ [drawingPath]: drawingXml, [relsPath]: relsXml }),
		);
		const pic = shapes.find((s) => s.id === 'p1');
		expect(pic?.fillImageUrl).toBe('data:image/png;base64,AAAA');
		expect(shapes.some((s) => s.id === 'nested')).toBeTruthy();
	});

	it('leaves fillImageUrl unset when the drawing rels file is missing', async () => {
		const drawingXml = JSON.stringify({
			'dsp:drawing': {
				'dsp:spTree': {
					'dsp:sp': {
						'@_modelId': 's1',
						'dsp:spPr': { 'a:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } } },
					},
				},
			},
		});
		const shapes = await parseDrawingShapesFromPart(
			drawingPath,
			makeDeps({ [drawingPath]: drawingXml }),
		);
		expect(shapes).toHaveLength(1);
		expect(shapes[0].fillBlipEmbedId).toBe('rId1');
		expect(shapes[0].fillImageUrl).toBeUndefined();
	});

	it('returns an empty list when the drawing part is absent', async () => {
		const shapes = await parseDrawingShapesFromPart(drawingPath, makeDeps({}));
		expect(shapes).toHaveLength(0);
	});
});
