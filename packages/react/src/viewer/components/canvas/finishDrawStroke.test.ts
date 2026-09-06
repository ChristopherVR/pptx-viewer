/**
 * `finishDrawStroke` was split out of `useDrawingOverlay`'s
 * `handleDrawPointerUp` purely to keep that file under this repo's 300-LOC
 * guideline; these tests pin the exact behaviour that extraction must not
 * change (bounding box, freeform vs ink branch, pressure/tilt authoring).
 */
import type { InkPptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { finishDrawStroke } from './finishDrawStroke';

describe('finishDrawStroke', () => {
	it('returns null for a too-short stroke (a plain tap)', () => {
		expect(
			finishDrawStroke({
				tool: 'pen',
				points: [{ x: 5, y: 5 }],
				pressures: [0.5],
				tiltX: [0],
				tiltY: [0],
				color: '#000',
				width: 3,
			}),
		).toBeNull();
	});

	it('builds a padded-bbox ink element for a pen stroke', () => {
		const result = finishDrawStroke({
			tool: 'pen',
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
			],
			pressures: [0.5, 0.5],
			tiltX: [0, 0],
			tiltY: [0, 0],
			color: '#123456',
			width: 2,
		});
		expect(result?.kind).toBe('ink');
		const ink = result?.element as InkPptxElement;
		expect(ink.x).toBe(-2);
		expect(ink.y).toBe(-2);
		expect(ink.width).toBe(14);
		expect(ink.height).toBe(4);
		expect(ink.inkPaths).toStrictEqual(['M 2 2 L 12 2']);
		expect(ink.inkColors).toStrictEqual(['#123456']);
		// No genuine pressure/tilt variation: neither channel is authored.
		expect(ink.inkPointPressures).toBeUndefined();
		expect(ink.inkPointTiltX).toBeUndefined();
	});

	it('tags a highlighter stroke with the highlighter tool and 0.4 opacity', () => {
		const result = finishDrawStroke({
			tool: 'highlighter',
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
			],
			pressures: [],
			tiltX: [],
			tiltY: [],
			color: '#ffff00',
			width: 5,
		});
		const ink = result?.element as InkPptxElement;
		expect(ink.inkTool).toBe('highlighter');
		expect(ink.inkOpacities).toStrictEqual([0.4]);
	});

	it('authors inkPointPressures/inkPointTiltX/Y only when the data genuinely varies/leans', () => {
		const result = finishDrawStroke({
			tool: 'pen',
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
			],
			pressures: [0.1, 0.9],
			tiltX: [0, 30],
			tiltY: [0, -15],
			color: '#000',
			width: 2,
		});
		const ink = result?.element as InkPptxElement;
		expect(ink.inkPointPressures).toStrictEqual([[0.1, 0.9]]);
		expect(ink.inkPointTiltX).toStrictEqual([[0, 30]]);
		expect(ink.inkPointTiltY).toStrictEqual([[0, -15]]);
	});

	it('builds a closed custom-geometry shape for the freeform tool', () => {
		const result = finishDrawStroke({
			tool: 'freeform',
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
			],
			pressures: [],
			tiltX: [],
			tiltY: [],
			color: '#00ff00',
			width: 1,
		});
		expect(result?.kind).toBe('freeform');
		const shape = result?.element as ShapePptxElement;
		expect(shape.shapeType).toBe('custom');
		expect(shape.shapeStyle?.strokeColor).toBe('#00ff00');
		const segments = shape.customGeometryPaths?.[0].segments ?? [];
		expect(segments.at(0)?.type).toBe('moveTo');
		expect(segments.at(-1)?.type).toBe('close');
	});
});
