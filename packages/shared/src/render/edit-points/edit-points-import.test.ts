import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveEditPointsAvailability } from './edit-points-availability';
import { editGeometryFromElement, isEditPointsCandidate } from './edit-points-import';

function shape(extra: Partial<ShapePptxElement>): ShapePptxElement {
	return { id: 's1', type: 'shape', x: 10, y: 20, width: 200, height: 100, ...extra };
}

describe('editGeometryFromElement', () => {
	it('converts a rectangle preset to four corners joined by lines', () => {
		const geometry = editGeometryFromElement(shape({ shapeType: 'rect' }));
		expect(geometry?.subpaths).toHaveLength(1);
		const sub = geometry!.subpaths[0];
		expect(sub.closed).toBeTruthy();
		expect(sub.nodes.map((n) => [n.x, n.y])).toStrictEqual([
			[0, 0],
			[200, 0],
			[200, 100],
			[0, 100],
		]);
		expect(sub.segments.every((s) => s.kind === 'line')).toBeTruthy();
		expect(sub.nodes.every((n) => n.type === 'corner')).toBeTruthy();
	});

	it('converts an ellipse to smooth points joined by cubic curves', () => {
		const geometry = editGeometryFromElement(shape({ shapeType: 'ellipse' }));
		const sub = geometry!.subpaths[0];
		expect(sub.closed).toBeTruthy();
		expect(sub.segments.length).toBeGreaterThanOrEqual(4);
		expect(sub.segments.every((s) => s.kind === 'curve')).toBeTruthy();
		expect(sub.nodes.every((n) => n.type === 'smooth')).toBeTruthy();
		for (const node of sub.nodes) {
			// Every vertex sits on the ellipse inscribed in the 200x100 box.
			const nx = (node.x - 100) / 100;
			const ny = (node.y - 50) / 50;
			expect(nx * nx + ny * ny).toBeCloseTo(1, 3);
		}
	});

	it('reads structured custom geometry in its own path space, arcs included', () => {
		const geometry = editGeometryFromElement(
			shape({
				shapeType: 'custom',
				customGeometryPaths: [
					{
						width: 1000,
						height: 1000,
						segments: [
							{ type: 'moveTo', pt: { x: 0, y: 500 } },
							{ type: 'arcTo', wR: 500, hR: 500, stAng: 10800000, swAng: 10800000 },
							{ type: 'lineTo', pt: { x: 500, y: 1000 } },
							{ type: 'close' },
						],
					},
				],
			}),
		);
		const sub = geometry!.subpaths[0];
		// Start (0,500) scaled to the 200x100 box is (0,50); the half-circle arc
		// ends at (1000,500) -> (200,50).
		expect(sub.nodes[0]).toMatchObject({ x: 0, y: 50 });
		const arcEnd = sub.nodes.find((n) => Math.abs(n.x - 200) < 1e-6);
		expect(arcEnd?.y).toBeCloseTo(50, 6);
		expect(sub.closed).toBeTruthy();
	});

	it('falls back to the aggregate SVG pathData', () => {
		const geometry = editGeometryFromElement(
			shape({
				shapeType: 'custom',
				pathData: 'M 0 0 L 100 0 L 50 50 Z',
				pathWidth: 100,
				pathHeight: 50,
			}),
		);
		expect(geometry!.subpaths[0].nodes.map((n) => [n.x, n.y])).toStrictEqual([
			[0, 0],
			[200, 0],
			[100, 100],
		]);
	});

	it('keeps open presets open', () => {
		const geometry = editGeometryFromElement(shape({ shapeType: 'line' }));
		expect(geometry!.subpaths[0].closed).toBeFalsy();
		expect(geometry!.subpaths[0].nodes).toHaveLength(2);
	});
});

describe('edit Points availability', () => {
	it('offers shapes and refuses everything else', () => {
		expect(isEditPointsCandidate(shape({ shapeType: 'star5' }))).toBeTruthy();
		const picture = { id: 'p', type: 'picture', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(isEditPointsCandidate(picture)).toBeFalsy();
		expect(resolveEditPointsAvailability(picture)).toBe('unsupported');
		expect(resolveEditPointsAvailability(null)).toBe('unsupported');
	});

	it('greys the command out for a noEditPoints lock', () => {
		expect(resolveEditPointsAvailability(shape({ shapeType: 'rect' }))).toBe('available');
		expect(
			resolveEditPointsAvailability(shape({ shapeType: 'rect', locks: { noEditPoints: true } })),
		).toBe('locked');
	});
});
