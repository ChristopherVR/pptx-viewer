import { describe, it, expect } from 'vitest';

import type { PptxElement, PptxSmartArtDrawingShape, PptxSmartArtNode } from '../../types';
import {
	buildFabricatedDrawingXml,
	smartArtElementsToDrawingShapes,
} from './smartart-fabrication-drawing';

const NODES: PptxSmartArtNode[] = [
	{ id: 'n1', text: 'Top' },
	{ id: 'n2', text: 'Middle' },
	{ id: 'n3', text: 'Bottom' },
];

const GUIDS = new Map<string, string>([
	['n1', '{11111111-1111-1111-1111-111111111111}'],
	['n2', '{22222222-2222-2222-2222-222222222222}'],
	['n3', '{33333333-3333-3333-3333-333333333333}'],
]);

const SHAPES: PptxSmartArtDrawingShape[] = [
	{ id: 'engine-n1', shapeType: 'triangle', x: 250, y: 40, width: 100, height: 90, text: 'Top' },
	{ id: 'engine-n2', shapeType: 'trapezoid', x: 200, y: 140, width: 200, height: 90, text: 'Mid' },
	{ id: 'engine-n3', shapeType: 'trapezoid', x: 150, y: 240, width: 300, height: 90 },
];

describe('buildFabricatedDrawingXml', () => {
	it('returns undefined when there are no shapes', () => {
		expect(buildFabricatedDrawingXml(undefined, NODES, GUIDS)).toBeUndefined();
		expect(buildFabricatedDrawingXml([], NODES, GUIDS)).toBeUndefined();
	});

	it('serializes each shape with its own preset geometry', () => {
		const xml = buildFabricatedDrawingXml(SHAPES, NODES, GUIDS)!;
		expect(xml).toContain('prst="triangle"');
		expect(xml).toContain('prst="trapezoid"');
		expect(xml).not.toContain('prst="roundRect"');
		expect(xml.match(/<dsp:sp\b/gu) || []).toHaveLength(3);
	});

	it('uses presentation-point GUIDs for cached shape model ids', () => {
		const xml = buildFabricatedDrawingXml(SHAPES, NODES, GUIDS)!;
		// `engine-<nodeId>` ids resolve to the matching node GUID.
		expect(xml).toContain('modelId="{11111111-1111-1111-1111-111111111111}"');
		expect(xml).toContain('modelId="{22222222-2222-2222-2222-222222222222}"');
		expect(xml).toContain('modelId="{33333333-3333-3333-3333-333333333333}"');
	});

	it('converts EMU-pixel coordinates to whole EMU', () => {
		const xml = buildFabricatedDrawingXml([SHAPES[0]!], NODES, GUIDS)!;
		// 250px * 9525 = 2381250, 40px * 9525 = 381000
		expect(xml).toContain('<a:off x="2381250" y="381000"/>');
		expect(xml).toContain('<a:ext cx="952500" cy="857250"/>');
		expect(xml).toContain('<dsp:txXfrm>');
	});

	it('serializes cached shape rotation and skew transforms', () => {
		const xml = buildFabricatedDrawingXml(
			[
				{
					...SHAPES[0]!,
					rotation: 15,
					skewX: 10,
					skewY: -5,
				},
			],
			NODES,
			GUIDS,
		)!;
		expect(xml).toContain('<a:xfrm rot="900000" skewX="600000" skewY="-300000">');
	});

	it('escapes shape text', () => {
		const xml = buildFabricatedDrawingXml(
			[{ id: 'engine-n1', shapeType: 'rect', x: 0, y: 0, width: 10, height: 10, text: 'A & <B>' }],
			NODES,
			GUIDS,
		)!;
		expect(xml).toContain('A &amp; &lt;B&gt;');
	});

	it('defaults missing geometry to rect', () => {
		const xml = buildFabricatedDrawingXml(
			[{ id: 'x', x: 0, y: 0, width: 10, height: 10 }],
			NODES,
			GUIDS,
		)!;
		expect(xml).toContain('prst="rect"');
	});

	it('serializes structured custom geometry instead of a rectangle', () => {
		const xml = buildFabricatedDrawingXml(
			[
				{
					id: 'engine-n1',
					shapeType: 'custom',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					customGeometryPaths: [
						{
							width: 100,
							height: 100,
							segments: [
								{ type: 'moveTo', pt: { x: 100, y: 50 } },
								{ type: 'arcTo', wR: 50, hR: 50, stAng: 0, swAng: 10800000 },
							],
						},
					],
				},
			],
			NODES,
			GUIDS,
		)!;
		expect(xml).toContain('<a:custGeom>');
		expect(xml).toContain('<a:arcTo wR="50" hR="50" stAng="0" swAng="10800000"/>');
		expect(xml).not.toContain('<a:prstGeom');
	});
});

describe('smartArtElementsToDrawingShapes', () => {
	it('maps shape elements and skips connectors', () => {
		const elements: PptxElement[] = [
			{
				id: 's1',
				type: 'shape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				shapeType: 'ellipse',
				shapeStyle: { fillColor: '#123456', strokeColor: '#654321', strokeWidth: 2 },
				text: 'Hi',
				textStyle: { fontSize: 12, color: '#FFFFFF' },
			} as unknown as PptxElement,
			{ id: 'c1', type: 'connector', x: 0, y: 0, width: 1, height: 1 } as unknown as PptxElement,
		];
		const shapes = smartArtElementsToDrawingShapes(elements);
		expect(shapes).toHaveLength(1);
		expect(shapes[0]).toStrictEqual({
			id: 's1',
			shapeType: 'ellipse',
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			rotation: undefined,
			skewX: undefined,
			skewY: undefined,
			fillColor: '#123456',
			strokeColor: '#654321',
			strokeWidth: 2,
			text: 'Hi',
			fontSize: 12,
			fontColor: '#FFFFFF',
		});
	});

	it('returns an empty array for missing or empty input', () => {
		expect(smartArtElementsToDrawingShapes(undefined)).toStrictEqual([]);
		expect(smartArtElementsToDrawingShapes([])).toStrictEqual([]);
	});
});
