import { describe, expect, it } from 'vitest';

import {
	FREEFORM_CLOSE_TOLERANCE_FACTOR,
	FREEFORM_CLOSE_TOLERANCE_MIN_PX,
	buildFreeformShapeElement,
	buildFreeformStrokeGeometry,
	freeformCloseTolerance,
	isFreeformStrokeClosed,
} from './freeform-stroke-geometry';

/**
 * The Freeform tool must produce an OPEN path unless the gesture ends back on
 * its start point, as PowerPoint's Freeform/Scribble does. Unconditionally
 * closing gave every squiggle a spurious straight edge from its last point
 * back to its first.
 */

/** A hand-drawn arc that trails off well away from where it started. */
const OPEN_SQUIGGLE = [
	{ x: 10, y: 10 },
	{ x: 30, y: 5 },
	{ x: 50, y: 20 },
	{ x: 70, y: 40 },
];

/** A square whose last point lands a couple of pixels from the first. */
const NEARLY_CLOSED_SQUARE = [
	{ x: 10, y: 10 },
	{ x: 30, y: 10 },
	{ x: 30, y: 30 },
	{ x: 10, y: 30 },
	{ x: 12, y: 11 },
];

const segmentTypes = (points: { x: number; y: number }[], width: number) =>
	buildFreeformStrokeGeometry(points, width)?.path.segments.map((s) => s.type);

describe('freeformCloseTolerance', () => {
	it('scales with the stroke width, never below the pixel floor', () => {
		expect(freeformCloseTolerance(10)).toBe(10 * FREEFORM_CLOSE_TOLERANCE_FACTOR);
		expect(freeformCloseTolerance(0.5)).toBe(FREEFORM_CLOSE_TOLERANCE_MIN_PX);
	});
});

describe('isFreeformStrokeClosed', () => {
	it('never treats a two-point stroke as closed, even when both ends coincide', () => {
		expect(
			isFreeformStrokeClosed(
				[
					{ x: 0, y: 0 },
					{ x: 0, y: 0 },
				],
				100,
			),
		).toBeFalsy();
	});

	it('compares the straight-line distance between the two ends to the tolerance', () => {
		expect(isFreeformStrokeClosed(NEARLY_CLOSED_SQUARE, 3)).toBeTruthy();
		expect(isFreeformStrokeClosed(NEARLY_CLOSED_SQUARE, 2)).toBeFalsy();
	});
});

describe('buildFreeformStrokeGeometry', () => {
	it('rejects a too-short stroke (a plain tap)', () => {
		expect(buildFreeformStrokeGeometry([{ x: 5, y: 5 }], 2)).toBeNull();
		expect(buildFreeformStrokeGeometry([], 2)).toBeNull();
	});

	it('leaves an open squiggle open: no closing edge back to the start', () => {
		expect(segmentTypes(OPEN_SQUIGGLE, 2)).toStrictEqual(['moveTo', 'lineTo', 'lineTo', 'lineTo']);
		expect(buildFreeformStrokeGeometry(OPEN_SQUIGGLE, 2)?.closed).toBeFalsy();
	});

	it('closes a stroke that ends within the tolerance of its start', () => {
		expect(segmentTypes(NEARLY_CLOSED_SQUARE, 2)?.at(-1)).toBe('close');
		expect(buildFreeformStrokeGeometry(NEARLY_CLOSED_SQUARE, 2)?.closed).toBeTruthy();
	});

	it('honours an explicit closeTolerance override', () => {
		expect(segmentTypes(OPEN_SQUIGGLE, 2)?.at(-1)).toBe('lineTo');
		expect(
			buildFreeformStrokeGeometry(OPEN_SQUIGGLE, 2, { closeTolerance: 1000 })?.closed,
		).toBeTruthy();
	});

	it('pads the box by the stroke width and emits 100x coordinates relative to it', () => {
		const geometry = buildFreeformStrokeGeometry(NEARLY_CLOSED_SQUARE, 4);
		expect(geometry?.x).toBe(6);
		expect(geometry?.y).toBe(6);
		expect(geometry?.width).toBe(28);
		expect(geometry?.height).toBe(28);
		expect(geometry?.path.width).toBe(2800);
		expect(geometry?.path.height).toBe(2800);
		const first = geometry?.path.segments[0];
		expect(first?.type === 'moveTo' ? first.pt : null).toStrictEqual({ x: 400, y: 400 });
	});
});

describe('buildFreeformShapeElement', () => {
	it('returns null for a tap', () => {
		expect(buildFreeformShapeElement([{ x: 1, y: 1 }], { color: '#000', width: 2 })).toBeNull();
	});

	it('commits an unfilled custom shape outlined in the pen colour', () => {
		const shape = buildFreeformShapeElement(OPEN_SQUIGGLE, {
			color: '#00ff00',
			width: 5,
			id: 'shape-1',
		});
		expect(shape?.id).toBe('shape-1');
		expect(shape?.type).toBe('shape');
		expect(shape?.shapeType).toBe('custom');
		expect(shape?.shapeStyle).toStrictEqual({
			fillColor: 'transparent',
			strokeColor: '#00ff00',
			strokeWidth: 5,
		});
		expect(shape?.customGeometryPaths).toHaveLength(1);
		expect(shape?.customGeometryPaths?.[0].segments.at(-1)?.type).toBe('lineTo');
	});

	it('mints a shape-prefixed id when none is given', () => {
		const shape = buildFreeformShapeElement(OPEN_SQUIGGLE, { color: '#000', width: 1 });
		expect(shape?.id.startsWith('shape-')).toBeTruthy();
	});
});
