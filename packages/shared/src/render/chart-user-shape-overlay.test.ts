import type { PptxChartData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildChartUserShapeOverlay } from './chart-user-shape-overlay';
import type { SvgLine, SvgPolygon, SvgText } from './chart-view-model';

type UserShape = NonNullable<PptxChartData['userShapes']>[number];

describe('buildChartUserShapeOverlay', () => {
	it('returns no primitives when there are no shapes', () => {
		expect(buildChartUserShapeOverlay(undefined, 400, 300)).toStrictEqual([]);
		expect(buildChartUserShapeOverlay([], 400, 300)).toStrictEqual([]);
	});

	it('projects a relSizeAnchor sp into a filled polygon plus text', () => {
		const shapes: UserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.2 },
				to: { x: 0.6, y: 0.5 },
				fill: '#FF0000',
				stroke: '#00FF00',
				strokeWidth: 2,
				paragraphs: [{ text: 'Peak', align: 'ctr', bold: true }],
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 300);
		const polygon = prims.find((p) => p.kind === 'polygon') as SvgPolygon;
		expect(polygon).toBeDefined();
		expect(polygon.fill).toBe('#FF0000');
		expect(polygon.stroke).toBe('#00FF00');
		// from (0.1*400, 0.2*300) = (40, 60); to (0.6*400, 0.5*300) = (240, 150)
		expect(polygon.points).toBe('40,60 240,60 240,150 40,150');

		const text = prims.find((p) => p.kind === 'text') as SvgText;
		expect(text).toBeDefined();
		expect(text.text).toBe('Peak');
		expect(text.textAnchor).toBe('middle');
		expect(text.fontWeight).toBe('bold');
	});

	// W5-I: a `grpSp` entry (grouped annotation shapes with their own nested
	// transform) must be flattened via core's `flattenChartUserShapes` before
	// projecting; before this switch the renderer had no `from`/`to`/`ext` to
	// read off a `grpSp` entry directly and would have rendered nothing.
	it('flattens a grpSp entry and projects its children at their transformed positions', () => {
		const shapes: UserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
				},
				children: [
					{
						kind: 'sp',
						off: { x: 0, y: 0 },
						ext: { cx: 500000, cy: 1000000 },
						fill: '#FF0000',
					},
					{
						kind: 'sp',
						off: { x: 500000, y: 0 },
						ext: { cx: 500000, cy: 1000000 },
						fill: '#00FF00',
					},
				],
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 300);
		const polygons = prims.filter((p) => p.kind === 'polygon') as SvgPolygon[];
		expect(polygons).toHaveLength(2);
		// Left half: from (0,0) to (0.5,1) of the 400x300 area.
		expect(polygons[0].points).toBe('0,0 200,0 200,300 0,300');
		expect(polygons[0].fill).toBe('#FF0000');
		// Right half: from (0.5,0) to (1,1).
		expect(polygons[1].points).toBe('200,0 400,0 400,300 200,300');
		expect(polygons[1].fill).toBe('#00FF00');
	});

	it('projects an absSizeAnchor connector into a diagonal line', () => {
		const shapes: UserShape[] = [
			{
				kind: 'cxnSp',
				anchor: 'abs',
				from: { x: 0.5, y: 0.5 },
				ext: { cx: 952500, cy: 476250 },
				stroke: '#0000FF',
				strokeWidth: 1.5,
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 200, 100);
		expect(prims).toHaveLength(1);
		const line = prims[0] as SvgLine;
		expect(line.kind).toBe('line');
		// from (0.5*200, 0.5*100) = (100, 50); ext px = 952500/9525=100, 476250/9525=50
		expect(line.x1).toBe(100);
		expect(line.y1).toBe(50);
		expect(line.x2).toBe(200);
		expect(line.y2).toBe(100);
		expect(line.stroke).toBe('#0000FF');
	});
});
