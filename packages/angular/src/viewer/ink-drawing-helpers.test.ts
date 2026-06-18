import { describe, expect, it } from 'vitest';

import { pointsToSvgPathD, strokeToInkElement } from './ink-drawing-helpers';

// ── pointsToSvgPathD ────────────────────────────────────────────────────────

describe('pointsToSvgPathD', () => {
	it('returns empty string for an empty array', () => {
		expect(pointsToSvgPathD([])).toBe('');
	});

	it('returns only a move command for a single point', () => {
		expect(pointsToSvgPathD([{ x: 0, y: 0 }])).toBe('M 0 0');
	});

	it('builds M + L commands for two points', () => {
		expect(
			pointsToSvgPathD([
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
			]),
		).toBe('M 0 0 L 10 10');
	});

	it('builds M + multiple L commands for three or more points', () => {
		const result = pointsToSvgPathD([
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
			{ x: 5, y: 6 },
		]);
		expect(result).toBe('M 1 2 L 3 4 L 5 6');
	});
});

// ── strokeToInkElement ──────────────────────────────────────────────────────

describe('strokeToInkElement', () => {
	it('returns null when given zero points', () => {
		expect(strokeToInkElement({ points: [], color: '#000', width: 2, tool: 'pen' })).toBeNull();
	});

	it('returns null when given exactly one point', () => {
		expect(
			strokeToInkElement({ points: [{ x: 5, y: 5 }], color: '#000', width: 2, tool: 'pen' }),
		).toBeNull();
	});

	it('creates a pen ink element with opacity 1', () => {
		const result = strokeToInkElement({
			points: [
				{ x: 10, y: 20 },
				{ x: 30, y: 40 },
			],
			color: '#ff0000',
			width: 3,
			tool: 'pen',
		});
		expect(result).not.toBeNull();
		expect(result!.inkTool).toBe('pen');
		expect(result!.inkOpacities).toStrictEqual([1]);
		expect(result!.inkColors).toStrictEqual(['#ff0000']);
		expect(result!.inkWidths).toStrictEqual([3]);
		expect(result!.type).toBe('ink');
	});

	it('creates a highlighter ink element with opacity 0.4', () => {
		const result = strokeToInkElement({
			points: [
				{ x: 10, y: 20 },
				{ x: 30, y: 40 },
			],
			color: '#ffff00',
			width: 8,
			tool: 'highlighter',
		});
		expect(result).not.toBeNull();
		expect(result!.inkTool).toBe('highlighter');
		expect(result!.inkOpacities).toStrictEqual([0.4]);
	});

	it('treats freeform as pen (inkTool = "pen", opacity = 1)', () => {
		const result = strokeToInkElement({
			points: [
				{ x: 0, y: 0 },
				{ x: 50, y: 50 },
			],
			color: '#0000ff',
			width: 2,
			tool: 'freeform',
		});
		expect(result).not.toBeNull();
		expect(result!.inkTool).toBe('pen');
		expect(result!.inkOpacities).toStrictEqual([1]);
	});

	it('computes bounding box and translates points to relative coords', () => {
		// Two points: (100, 200) and (150, 250).
		// Raw bbox (no pad): minX=100, minY=200, maxX=150, maxY=250.
		// With pad=5 (width=5): minX=95, minY=195, maxX=155, maxY=255.
		// bbox width = 60, height = 60.
		// Rel points: (5, 5) and (55, 55).
		const result = strokeToInkElement({
			points: [
				{ x: 100, y: 200 },
				{ x: 150, y: 250 },
			],
			color: '#000',
			width: 5,
			tool: 'pen',
		});
		expect(result).not.toBeNull();
		expect(result!.x).toBe(95);
		expect(result!.y).toBe(195);
		expect(result!.width).toBe(60);
		expect(result!.height).toBe(60);
		expect(result!.inkPaths).toStrictEqual(['M 5 5 L 55 55']);
	});

	it('clamps width/height to at least 1 for degenerate strokes', () => {
		// Two identical points after padding: bbox would be 2*pad × 2*pad (both >= 1).
		const result = strokeToInkElement({
			points: [
				{ x: 10, y: 10 },
				{ x: 10, y: 10 },
			],
			color: '#000',
			width: 0,
			tool: 'pen',
		});
		expect(result).not.toBeNull();
		expect(result!.width).toBeGreaterThanOrEqual(1);
		expect(result!.height).toBeGreaterThanOrEqual(1);
	});

	it('generates a unique id for each element', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		];
		const a = strokeToInkElement({ points: pts, color: '#000', width: 1, tool: 'pen' });
		const b = strokeToInkElement({ points: pts, color: '#000', width: 1, tool: 'pen' });
		expect(a!.id).not.toBe(b!.id);
	});
});
