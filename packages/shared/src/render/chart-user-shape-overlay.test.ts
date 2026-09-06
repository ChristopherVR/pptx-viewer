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

	// W2-F: an absSizeAnchor group child's position (not just its size) must
	// land exactly. W5-AE: `buildChartUserShapeOverlay` now always passes core
	// a `chartBox`, so this lands via the flattened leaf's own corrected
	// `from` (folded in by core) rather than the separate `absGroupOffsetEmu`
	// fallback field; the expected pixel position is unchanged either way.
	it('projects an absSizeAnchor grpSp child at its exact offset position', () => {
		const shapes: UserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'abs',
				from: { x: 0.25, y: 0.25 },
				ext: { cx: 952500, cy: 952500 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 952500, cy: 952500 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 100, cy: 100 },
				},
				children: [
					{
						kind: 'sp',
						// Offset a quarter of the child space in from the group's origin.
						off: { x: 25, y: 25 },
						ext: { cx: 50, cy: 50 },
						fill: '#FF00FF',
					},
				],
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 400);
		const polygon = prims.find((p) => p.kind === 'polygon') as SvgPolygon;
		expect(polygon).toBeDefined();
		// Anchor origin px: (0.25*400, 0.25*400) = (100, 100).
		// Group offset EMU: (25/100)*952500 = 238125 -> /9525 = 25px in each axis.
		// Child size EMU: (50/100)*952500 = 476250 -> /9525 = 50px.
		expect(polygon.points).toBe('125,125 175,125 175,175 125,175');
	});

	// W5-AE COM ground truth (see `chart-user-shapes-parser.test.ts`'s matching
	// unit test for the full derivation): a chart area that is NOT square
	// (840x420px, 2:1) makes a top-level relSizeAnchor group's real box 2:1
	// too, even though its own fraction span (0.1,0.1)-(0.6,0.6) is square.
	// `buildChartUserShapeOverlay` must pass that real chart box through to
	// core so an off-centre rotated child lands where real PowerPoint puts
	// it, not where the isotropic (1:1) fallback would.
	it("passes the chart's own (non-square) pixel box through so a rotated relSizeAnchor group's off-centre child lands at its real, COM-verified position", () => {
		const shapes: UserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.6, y: 0.6 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
					rotation: 20,
				},
				children: [
					{
						kind: 'sp',
						off: { x: 0, y: 0 },
						ext: { cx: 500000, cy: 1000000 },
						fill: '#FFCC00',
					},
				],
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 840, 420);
		const polygon = prims.find((p) => p.kind === 'polygon') as SvgPolygon;
		expect(polygon).toBeDefined();
		const [topLeft] = polygon.points.split(' ');
		const [x, y] = topLeft!.split(',').map(Number);
		// COM: rotated Left=67.74921pt/Top=4.565906pt on a 630x315pt (840x420px)
		// chart; px = pt * 840/630.
		expect(x).toBeCloseTo(67.74921 * (840 / 630), 0);
		expect(y).toBeCloseTo(4.565906 * (840 / 630), 0);
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

	it('emits a rotate transform about the box centre for a rotated sp', () => {
		const shapes: UserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 0.5, y: 0.5 },
				fill: '#FF0000',
				rotation: 30,
				paragraphs: [{ text: 'Tilted' }],
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 300);
		const polygon = prims.find((p) => p.kind === 'polygon') as SvgPolygon;
		// box: (0,0)-(200,150), centre (100,75).
		expect(polygon.transform).toBe('rotate(30 100 75)');
		const text = prims.find((p) => p.kind === 'text') as SvgText;
		expect(text.transform).toBe('rotate(30 100 75)');
	});

	it('emits a translate/scale/translate flip transform, applied before rotate', () => {
		const shapes: UserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 0.5, y: 0.5 },
				fill: '#FF0000',
				flipH: true,
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 300);
		const polygon = prims.find((p) => p.kind === 'polygon') as SvgPolygon;
		expect(polygon.transform).toBe('translate(100 75) scale(-1 1) translate(-100 -75)');
	});

	it('applies no transform to an unrotated, unflipped shape', () => {
		const shapes: UserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.5, y: 0.5 }, fill: '#FF0000' },
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 300);
		const polygon = prims.find((p) => p.kind === 'polygon') as SvgPolygon;
		expect(polygon.transform).toBeUndefined();
	});

	it('composes a rotated groups own spin onto a connector line', () => {
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
					rotation: 20,
				},
				children: [
					{
						kind: 'cxnSp',
						off: { x: 0, y: 0 },
						ext: { cx: 1000000, cy: 1000000 },
						stroke: '#000000',
					},
				],
			},
		];
		const prims = buildChartUserShapeOverlay(shapes, 400, 300);
		const line = prims.find((p) => p.kind === 'line') as SvgLine;
		expect(line.transform).toBe('rotate(20 200 150)');
	});
});
