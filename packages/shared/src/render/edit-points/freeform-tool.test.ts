import type { ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { buildFreeformToolElement, simplifyFreeformVertices } from './freeform-tool-geometry';
import type { FreeformToolKind } from './freeform-tool-geometry';
import { FreeformToolSession } from './freeform-tool-session';

function session(tool: FreeformToolKind) {
	const committed: ShapePptxElement[] = [];
	const onCancel = vi.fn();
	const s = new FreeformToolSession({ tool, onCommit: (e) => committed.push(e), onCancel });
	return { s, committed, onCancel };
}

function click(s: FreeformToolSession, x: number, y: number): void {
	s.pointerDown({ x, y });
	s.pointerUp();
}

describe('freeform: Shape tool', () => {
	it('closes and fills the shape when the start point is clicked', () => {
		const { s, committed } = session('freeformShape');
		click(s, 100, 100);
		click(s, 200, 100);
		click(s, 150, 180);
		click(s, 102, 101);
		expect(committed).toHaveLength(1);
		const shape = committed[0];
		expect(shape).toMatchObject({
			type: 'shape',
			shapeType: 'custom',
			x: 100,
			y: 100,
			width: 100,
			height: 80,
		});
		expect(shape.customGeometryPaths?.[0].segments.map((seg) => seg.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'lineTo',
			'close',
		]);
		expect(shape.shapeStyle?.fillColor).not.toBe('transparent');
		expect(s.isEnded).toBeTruthy();
	});

	it('finishes an open line on double-click without doubling the last point', () => {
		const { s, committed } = session('freeformShape');
		click(s, 10, 10);
		click(s, 60, 10);
		click(s, 60, 60);
		click(s, 60, 60);
		s.doubleClick();
		const shape = committed[0];
		expect(shape.customGeometryPaths?.[0].segments.map((seg) => seg.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'lineTo',
		]);
		expect(shape.shapeStyle?.fillColor).toBe('transparent');
	});

	it('records a drag as a simplified freehand run', () => {
		const { s, committed } = session('freeformShape');
		s.pointerDown({ x: 0, y: 0 });
		for (let x = 1; x <= 100; x++) {
			s.pointerMove({ x, y: 0.2 * Math.sin(x) });
		}
		s.pointerUp();
		click(s, 100, 50);
		s.keyDown('Enter');
		const segments = committed[0].customGeometryPaths?.[0].segments ?? [];
		// A near-straight 100-sample drag collapses to one edge, plus the click.
		expect(segments.length).toBeLessThanOrEqual(4);
	});

	it('cancels when fewer than two points were placed', () => {
		const { s, committed, onCancel } = session('freeformShape');
		click(s, 10, 10);
		s.keyDown('Escape');
		expect(committed).toHaveLength(0);
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('backspace removes the last point', () => {
		const { s } = session('freeformShape');
		click(s, 10, 10);
		click(s, 20, 20);
		expect(s.keyDown('Backspace')).toBeTruthy();
		expect(s.points).toHaveLength(1);
	});

	it('previews the rubber band to the pointer and arms the close target', () => {
		const { s } = session('freeformShape');
		click(s, 0, 0);
		click(s, 100, 0);
		click(s, 100, 100);
		s.pointerMove({ x: 50, y: 50 });
		expect(s.view().previewD).toContain('L 50 50');
		expect(s.view().start?.armed).toBeFalsy();
		s.pointerMove({ x: 2, y: 2 });
		expect(s.view().start?.armed).toBeTruthy();
	});
});

describe('curve tool', () => {
	it('draws smooth cubic spans through every clicked point', () => {
		const { s, committed } = session('curve');
		click(s, 0, 0);
		click(s, 100, 50);
		click(s, 200, 0);
		s.doubleClick();
		const segments = committed[0].customGeometryPaths?.[0].segments ?? [];
		expect(segments.map((seg) => seg.type)).toStrictEqual(['moveTo', 'cubicBezTo', 'cubicBezTo']);
		// The curve passes through the middle click (it is a vertex).
		const mid = segments[1];
		expect(mid.type === 'cubicBezTo' && mid.pts[2]).toStrictEqual({ x: 100 * 9525, y: 50 * 9525 });
	});

	it('closes into a smooth loop when the start is clicked', () => {
		const { s, committed } = session('curve');
		click(s, 0, 50);
		click(s, 50, 0);
		click(s, 100, 50);
		click(s, 50, 100);
		click(s, 1, 50);
		const types = committed[0].customGeometryPaths?.[0].segments.map((seg) => seg.type);
		expect(types).toStrictEqual([
			'moveTo',
			'cubicBezTo',
			'cubicBezTo',
			'cubicBezTo',
			'cubicBezTo',
			'close',
		]);
	});
});

describe('freeform geometry helpers', () => {
	it('keeps every clicked corner when simplifying freehand runs', () => {
		const out = simplifyFreeformVertices([
			{ x: 0, y: 0 },
			{ x: 5, y: 0.1, freehand: true },
			{ x: 10, y: 0, freehand: true },
			{ x: 10, y: 10 },
		]);
		expect(out).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		]);
	});

	it('returns nothing for a single point', () => {
		expect(buildFreeformToolElement('curve', [{ x: 1, y: 1 }], false)).toBeUndefined();
	});
});
