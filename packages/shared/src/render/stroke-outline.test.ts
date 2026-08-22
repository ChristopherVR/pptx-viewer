import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildStrokeOutline,
	outlinePathData,
	strokeOutlineViewBox,
	suppressesCssBorder,
} from './stroke-outline';

const STOPS = [
	{ color: '#F0FDFE', position: 0 },
	{ color: '#BFBFBF', position: 100 },
];

function shape(shapeStyle: ShapeStyle, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'ppt/slides/slide4.xml-shape-3',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeType: 'rect',
		shapeStyle,
		...overrides,
	} as PptxElement;
}

const gradientStroke: ShapeStyle = {
	strokeFillMode: 'gradient',
	strokeWidth: 3,
	strokeColor: '#D8DEDF',
	strokeGradientStops: STOPS,
	strokeGradientAngle: 45,
	strokeGradientType: 'linear',
};

describe('outlinePathData', () => {
	it('unwraps a path() clip-path', () => {
		expect(outlinePathData("path('M 0 0 L 10 10 Z')", 200, 100)).toBe('M 0 0 L 10 10 Z');
	});

	it('converts a percentage polygon() into pixel path data', () => {
		expect(outlinePathData('polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)', 200, 100)).toBe(
			'M 40 0 L 200 0 L 160 100 L 0 100 Z',
		);
	});

	it('falls back to the element rectangle for inset() or no clip', () => {
		const rect = 'M 0 0 L 200 0 L 200 100 L 0 100 Z';
		expect(outlinePathData(undefined, 200, 100)).toBe(rect);
		expect(outlinePathData('inset(0 round 18px)', 200, 100)).toBe(rect);
	});

	it('returns undefined for a degenerate box', () => {
		expect(outlinePathData("path('M 0 0 Z')", 0, 100)).toBeUndefined();
		expect(outlinePathData("path('M 0 0 Z')", 200, Number.NaN)).toBeUndefined();
	});
});

describe('buildStrokeOutline', () => {
	it('builds a paint server and an outline path for a gradient outline', () => {
		const outline = buildStrokeOutline(shape(gradientStroke));
		expect(outline).toBeDefined();
		expect(outline!.paint!.kind).toBe('linear');
		expect(outline!.paint!.id).toBe('pptx-stroke-ppt_slides_slide4_xml-shape-3');
		expect(outline!.strokeWidth).toBe(3);
		expect(outline!.d).toContain('M ');
	});

	it('namespaces the stroke paint server apart from the fill one', () => {
		// A shape can carry BOTH a gradient fill and a gradient outline; sharing
		// one id would make the second reference resolve to the first server.
		const outline = buildStrokeOutline(
			shape({
				...gradientStroke,
				fillMode: 'gradient',
				fillGradientStops: STOPS,
			}),
		);
		expect(outline!.paint!.id).toContain('-stroke-');
	});

	it('follows the shape geometry rather than the bounding box', () => {
		// An ellipse is painted with `border-radius` by the bindings, but the
		// overlay has to trace the real outline or the gradient border would be a
		// rectangle around it.
		const outline = buildStrokeOutline(
			shape(gradientStroke, { shapeType: 'ellipse' } as Partial<PptxElement>),
		);
		expect(outline!.d).toContain('A ');
	});

	it('carries the dash, cap and join through to SVG attributes', () => {
		const outline = buildStrokeOutline(
			shape({ ...gradientStroke, strokeDash: 'dash', lineCap: 'rnd', lineJoin: 'bevel' }),
		);
		expect(outline!.dashArray).toBeTruthy();
		expect(outline!.lineCap).toBe('round');
		expect(outline!.lineJoin).toBe('bevel');
	});

	it('is undefined for an inset solid outline or zero width', () => {
		// `algn: 'in'` is the one case a `border-box` CSS border is already
		// correct: the line sits entirely inside the shape's path, which is
		// exactly what `box-sizing: border-box` draws.
		expect(
			buildStrokeOutline(shape({ strokeColor: '#000', strokeWidth: 2, lineAlignment: 'in' })),
		).toBeUndefined();
		expect(buildStrokeOutline(shape({ ...gradientStroke, strokeWidth: 0 }))).toBeUndefined();
	});

	it('falls back to a flat centred stroke when the gradient itself fails to resolve', () => {
		// The gradient has no stops to build a paint server from, but the shape is
		// still at the default `ctr` alignment, so the overlay still fires with
		// the flat `strokeColor` instead of the (unresolvable) gradient.
		const outline = buildStrokeOutline(shape({ ...gradientStroke, strokeGradientStops: [] }));
		expect(outline).toBeDefined();
		expect(outline!.paint).toBeUndefined();
		expect(outline!.stroke).toBe(gradientStroke.strokeColor);
	});

	it('centres a default-aligned solid outline instead of leaving it to the border-box border', () => {
		// An omitted `a:ln/@algn` means `ctr` (PowerPoint's default): the line
		// straddles the path half in / half out, which a `border-box` CSS border
		// cannot express (it can only sit flush with the box edge).
		const outline = buildStrokeOutline(shape({ strokeColor: '#123456', strokeWidth: 4 }));
		expect(outline).toBeDefined();
		expect(outline!.paint).toBeUndefined();
		expect(outline!.stroke).toBe('#123456');
		expect(outline!.strokeWidth).toBe(4);
		expect(outline!.d).toContain('M ');
	});

	it('an explicit ctr alignment behaves exactly like the omitted default', () => {
		const omitted = buildStrokeOutline(shape({ strokeColor: '#123456', strokeWidth: 4 }));
		const explicit = buildStrokeOutline(
			shape({ strokeColor: '#123456', strokeWidth: 4, lineAlignment: 'ctr' }),
		);
		expect(explicit).toStrictEqual(omitted);
	});

	it('never centres a width-only, fill-less line: PowerPoint paints no outline for it', () => {
		// `<a:ln w="12700"><a:miter .../></a:ln>` with no fill child and no
		// `<p:style>/<a:lnRef>` leaves the line's colour unspecified. Core parses
		// it as `strokeWidth > 0` with `strokeColor`/`strokeFillMode` both
		// `undefined` (see `hasStrokePaint`); a renderer must treat that as "no
		// line" rather than inventing one from `DEFAULT_STROKE_COLOR`. This is the
		// real-world media deck's picture frame: three photos each carry exactly
		// this markup and PowerPoint renders them frameless.
		expect(buildStrokeOutline(shape({ strokeWidth: 4 }))).toBeUndefined();
		expect(suppressesCssBorder(shape({ strokeWidth: 4 }))).toBeFalsy();
	});

	it('tells the binding when to drop its CSS border', () => {
		expect(suppressesCssBorder(shape(gradientStroke))).toBeTruthy();
		expect(
			suppressesCssBorder(shape({ strokeColor: '#000', strokeWidth: 2, lineAlignment: 'in' })),
		).toBeFalsy();
		expect(suppressesCssBorder(shape({ strokeColor: '#000', strokeWidth: 2 }))).toBeTruthy();
	});

	it('never centres a connector even at the default alignment', () => {
		// Connectors are painted entirely by the dedicated connector renderer
		// (arrows, hit-target, compound strands), never by this overlay.
		expect(
			buildStrokeOutline(
				shape({ strokeColor: '#000', strokeWidth: 2 }, {
					type: 'connector',
				} as Partial<PptxElement>),
			),
		).toBeUndefined();
	});

	it('never centres a custom-geometry shape typed "line", where the CSS lineEdge fallback beats a full-rectangle overlay', () => {
		// `shapeType: 'line'` combined with `pathData` is the one case
		// `getStrokeOnlyPresetPaths` deliberately declines (custom geometry
		// already renders through the `pathData` branch), so the evaluator-backed
		// centred overlay must decline it too rather than falling back to a
		// bounding-box rectangle.
		expect(
			buildStrokeOutline(
				shape({ strokeColor: '#000', strokeWidth: 2 }, {
					shapeType: 'line',
					pathData: 'M 0 0 L 200 100',
				} as Partial<PptxElement>),
			),
		).toBeUndefined();
	});
});

describe('buildStrokeOutline stroke-only ("open") presets', () => {
	/** The media deck's horizontal rule: `prst="line"`, 1 EMU tall, 1.5pt black. */
	function line(overrides: Partial<PptxElement> = {}, style: ShapeStyle = {}): PptxElement {
		return shape({ strokeColor: '#000000', strokeWidth: 2, ...style }, {
			shapeType: 'line',
			width: 400,
			height: 0,
			...overrides,
		} as Partial<PptxElement>);
	}

	it('strokes the evaluated geometry instead of leaving a CSS border to box it', () => {
		const outline = buildStrokeOutline(line());
		expect(outline).toBeDefined();
		// Painted as a flat colour: there is no paint server to define.
		expect(outline!.paint).toBeUndefined();
		expect(outline!.stroke).toBe('#000000');
		expect(outline!.d).toBe('M 0 0 L 400 1');
		expect(outline!.strokeWidth).toBe(2);
	});

	it('drops the CSS border so the box is not outlined as well', () => {
		expect(suppressesCssBorder(line())).toBeTruthy();
	});

	it('strokes an arc, which is the same defect on a curve', () => {
		const outline = buildStrokeOutline(
			line({
				shapeType: 'arc',
				width: 200,
				height: 120,
				shapeAdjustments: { adj1: 0, adj2: 10800000 },
			} as Partial<PptxElement>),
		);
		expect(outline!.d).toContain('A ');
		expect(outline!.paint).toBeUndefined();
	});

	it('strokes the whole elbow of an open connector preset', () => {
		const outline = buildStrokeOutline(
			line({ shapeType: 'bentConnector3', width: 200, height: 120 }),
		);
		expect(outline!.d).toBe('M 0 0 L 100 0 L 100 120 L 200 120');
	});

	it('leaves closed presets to the CSS border only when the line is explicitly inset', () => {
		for (const shapeType of ['rect', 'ellipse', 'roundRect', 'triangle']) {
			const inset = line({ shapeType, width: 200, height: 120 }, { lineAlignment: 'in' });
			expect(buildStrokeOutline(inset)).toBeUndefined();
			expect(suppressesCssBorder(inset)).toBeFalsy();
		}
	});

	it('centres a closed preset at the default (omitted) alignment instead', () => {
		for (const shapeType of ['rect', 'ellipse', 'roundRect', 'triangle']) {
			const centered = line({ shapeType, width: 200, height: 120 });
			const outline = buildStrokeOutline(centered);
			expect(outline).toBeDefined();
			expect(outline!.paint).toBeUndefined();
			expect(suppressesCssBorder(centered)).toBeTruthy();
		}
	});

	it('defaults a width-less open preset to a 2px line rather than nothing', () => {
		const outline = buildStrokeOutline(line({}, { strokeColor: '#123456' }));
		expect(outline!.strokeWidth).toBe(2);
		expect(outline!.stroke).toBe('#123456');
	});

	it('honours stroke opacity, dash, cap and join', () => {
		const outline = buildStrokeOutline(
			line({}, { strokeColor: '#000000', strokeWidth: 3, strokeOpacity: 0.5, strokeDash: 'dash' }),
		);
		expect(outline!.stroke).toBe('rgba(0, 0, 0, 0.5)');
		expect(outline!.dashArray).toBeTruthy();
	});

	it('paints one strand for a single line and several for a compound one', () => {
		expect(buildStrokeOutline(line())!.strands).toStrictEqual([{ strokeWidth: 2, offset: 0 }]);
		const compound = buildStrokeOutline(line({}, { strokeWidth: 4, compoundLine: 'dbl' }))!;
		expect(compound.strands).toHaveLength(2);
		expect(compound.strands[0].offset).not.toBe(compound.strands[1].offset);
	});

	it('takes the overlay viewBox from the PAINTED box, not the authored extent', () => {
		// A 1-EMU rule is padded to MIN_ELEMENT_SIZE; a viewBox of the authored
		// extent would be stretched 12x vertically and tilt the rule into a diagonal.
		expect(strokeOutlineViewBox(line())).toBe('0 0 400 12');
		expect(strokeOutlineViewBox(line({ width: 200, height: 120 }))).toBe('0 0 200 120');
	});

	it('ignores custom geometry and non-shape elements', () => {
		expect(buildStrokeOutline(line({ pathData: 'M 0 0 L 5 5' }))).toBeUndefined();
		expect(buildStrokeOutline(line({ type: 'image' }))).toBeUndefined();
	});
});

describe('buildStrokeOutline pattern outlines', () => {
	const patternStroke: ShapeStyle = {
		strokeFillMode: 'pattern',
		strokeWidth: 4,
		strokeColor: '#112233',
		strokePatternPreset: 'dkDnDiag',
		strokePatternBackgroundColor: '#445566',
	};

	it('strokes with a <pattern> paint server, not the bare foreground', () => {
		// A CSS border cannot be hatched, so the pattern used to vanish entirely
		// and the outline painted as a flat `strokeColor`.
		const outline = buildStrokeOutline(shape(patternStroke));
		expect(outline).toBeDefined();
		expect(outline!.paint!.kind).toBe('pattern');
		expect(outline!.paint!.id).toContain('-strokepat-');
	});

	it('carries a tile size and a data-URI tile', () => {
		const paint = buildStrokeOutline(shape(patternStroke))!.paint;
		if (paint?.kind !== 'pattern') {
			throw new Error('expected a pattern paint');
		}
		expect(paint.width).toBeGreaterThan(0);
		expect(paint.height).toBeGreaterThan(0);
		expect(paint.href.startsWith('data:image/svg+xml,')).toBeTruthy();
		// Both pattern colours reach the tile.
		expect(decodeURIComponent(paint.href)).toContain('#112233');
		expect(decodeURIComponent(paint.href)).toContain('#445566');
	});

	it('drops the CSS border for a pattern outline too', () => {
		expect(suppressesCssBorder(shape(patternStroke))).toBeTruthy();
	});

	it('falls back to a flat centred stroke for a preset it cannot draw', () => {
		// The pattern itself fails to resolve, but the shape is still at the
		// default `ctr` alignment, so the overlay still fires - now with the flat
		// `strokeColor` rather than the (unresolvable) pattern paint.
		const outline = buildStrokeOutline(
			shape({ ...patternStroke, strokePatternPreset: 'notARealPreset' }),
		);
		expect(outline).toBeDefined();
		expect(outline!.paint).toBeUndefined();
		expect(outline!.stroke).toBe('#112233');
	});

	it('prefers a gradient outline when a style somehow carries both', () => {
		const outline = buildStrokeOutline(
			shape({ ...gradientStroke, strokePatternPreset: 'dkDnDiag' }),
		);
		expect(outline!.paint!.kind).toBe('linear');
	});
});
