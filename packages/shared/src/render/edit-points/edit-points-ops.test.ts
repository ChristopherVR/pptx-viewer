import { describe, expect, it } from 'vitest';

import { cubicPointAt } from './edit-points-bezier';
import { bendEditSegment, moveEditHandle, moveEditNode } from './edit-points-drag-ops';
import { segmentAsCubic } from './edit-points-geometry-utils';
import {
	addEditPoint,
	closeEditPath,
	deleteEditPoint,
	deleteEditSegment,
	openEditPathAtNode,
	setEditNodeType,
	setEditSegmentKind,
} from './edit-points-structure-ops';
import type { EditGeometry } from './edit-points-types';

/** A closed 100x100 square, corners clockwise from the top-left. */
function square(): EditGeometry {
	return {
		subpaths: [
			{
				nodes: [
					{ x: 0, y: 0, type: 'corner' },
					{ x: 100, y: 0, type: 'corner' },
					{ x: 100, y: 100, type: 'corner' },
					{ x: 0, y: 100, type: 'corner' },
				],
				segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'line' }],
				closed: true,
			},
		],
	};
}

describe('drag operations', () => {
	it('moves a vertex without touching the input geometry', () => {
		const start = square();
		const moved = moveEditNode(start, { subpath: 0, node: 1 }, { x: 150, y: -20 });
		expect(moved.subpaths[0].nodes[1]).toMatchObject({ x: 150, y: -20 });
		expect(start.subpaths[0].nodes[1]).toMatchObject({ x: 100, y: 0 });
	});

	it('carries a vertex handles along with it', () => {
		const curved = setEditSegmentKind(square(), { subpath: 0, segment: 0 }, 'curve')!;
		const before = curved.subpaths[0].segments[0];
		const moved = moveEditNode(curved, { subpath: 0, node: 0 }, { x: 10, y: 5 });
		const after = moved.subpaths[0].segments[0];
		expect(before.kind === 'curve' && after.kind === 'curve').toBeTruthy();
		if (before.kind === 'curve' && after.kind === 'curve') {
			expect(after.c1).toStrictEqual({ x: before.c1.x + 10, y: before.c1.y + 5 });
			expect(after.c2).toStrictEqual(before.c2);
		}
	});

	it('bends a straight segment so the grabbed point follows the pointer', () => {
		const bent = bendEditSegment(square(), { subpath: 0, segment: 0 }, 0.5, { x: 50, y: -40 });
		const seg = bent.subpaths[0].segments[0];
		expect(seg.kind).toBe('curve');
		const at = cubicPointAt(segmentAsCubic(bent.subpaths[0], 0), 0.5);
		expect(at.x).toBeCloseTo(50, 6);
		expect(at.y).toBeCloseTo(-40, 6);
	});

	it('keeps a smooth vertex collinear and symmetric when one handle moves', () => {
		const smooth = setEditNodeType(square(), { subpath: 0, node: 1 }, 'smooth')!;
		const moved = moveEditHandle(
			smooth,
			{ subpath: 0, segment: 1, which: 'c1' },
			{ x: 100, y: 60 },
		);
		const sub = moved.subpaths[0];
		const inSeg = sub.segments[0];
		const outSeg = sub.segments[1];
		expect(inSeg.kind === 'curve' && outSeg.kind === 'curve').toBeTruthy();
		if (inSeg.kind === 'curve' && outSeg.kind === 'curve') {
			expect(outSeg.c1).toStrictEqual({ x: 100, y: 60 });
			expect(inSeg.c2.x).toBeCloseTo(100, 6);
			expect(inSeg.c2.y).toBeCloseTo(-60, 6);
		}
	});

	it('keeps a straight vertex collinear but lets the handle lengths differ', () => {
		const straight = setEditNodeType(square(), { subpath: 0, node: 1 }, 'straight')!;
		const inBefore = straight.subpaths[0].segments[0];
		const moved = moveEditHandle(
			straight,
			{ subpath: 0, segment: 1, which: 'c1' },
			{ x: 160, y: 0 },
		);
		const inSeg = moved.subpaths[0].segments[0];
		if (inBefore.kind !== 'curve' || inSeg.kind !== 'curve') {
			throw new Error('expected curves');
		}
		const lenBefore = Math.hypot(inBefore.c2.x - 100, inBefore.c2.y);
		expect(Math.hypot(inSeg.c2.x - 100, inSeg.c2.y)).toBeCloseTo(lenBefore, 6);
		expect(inSeg.c2.y).toBeCloseTo(0, 6);
		expect(inSeg.c2.x).toBeLessThan(100);
	});
});

describe('structural operations', () => {
	it('adds a point on a segment without changing the outline', () => {
		const result = addEditPoint(square(), { subpath: 0, segment: 1 }, 0.25)!;
		const sub = result.geometry.subpaths[0];
		expect(sub.nodes).toHaveLength(5);
		expect(sub.segments).toHaveLength(5);
		expect(sub.nodes[2]).toMatchObject({ x: 100, y: 25 });
		expect(result.node).toStrictEqual({ subpath: 0, node: 2 });
	});

	it('splits a curve into two curves that trace the same path', () => {
		const curved = bendEditSegment(square(), { subpath: 0, segment: 0 }, 0.5, { x: 50, y: -40 });
		const before = segmentAsCubic(curved.subpaths[0], 0);
		const { geometry } = addEditPoint(curved, { subpath: 0, segment: 0 }, 0.5)!;
		expect(geometry.subpaths[0].nodes[1].x).toBeCloseTo(cubicPointAt(before, 0.5).x, 6);
		expect(geometry.subpaths[0].nodes[1].type).toBe('smooth');
		const firstHalf = segmentAsCubic(geometry.subpaths[0], 0);
		expect(cubicPointAt(firstHalf, 0.5).y).toBeCloseTo(cubicPointAt(before, 0.25).y, 6);
	});

	it('deletes a vertex, joining its neighbours', () => {
		const next = deleteEditPoint(square(), { subpath: 0, node: 0 })!;
		const sub = next.subpaths[0];
		expect(sub.nodes.map((n) => [n.x, n.y])).toStrictEqual([
			[100, 0],
			[100, 100],
			[0, 100],
		]);
		expect(sub.segments).toHaveLength(3);
		expect(sub.closed).toBeTruthy();
	});

	it('refuses to delete the last drawable vertex', () => {
		const line: EditGeometry = {
			subpaths: [
				{
					nodes: [
						{ x: 0, y: 0, type: 'corner' },
						{ x: 10, y: 0, type: 'corner' },
					],
					segments: [{ kind: 'line' }],
					closed: false,
				},
			],
		};
		expect(deleteEditPoint(line, { subpath: 0, node: 0 })).toBeUndefined();
	});

	it('opens a closed path at a vertex and closes it again', () => {
		const opened = openEditPathAtNode(square(), { subpath: 0, node: 2 })!;
		const sub = opened.subpaths[0];
		expect(sub.closed).toBeFalsy();
		expect(sub.nodes).toHaveLength(5);
		expect(sub.nodes[0]).toMatchObject({ x: 100, y: 100 });
		expect(sub.nodes[4]).toMatchObject({ x: 100, y: 100 });
		expect(sub.segments).toHaveLength(4);
		const closed = closeEditPath(opened, 0)!;
		expect(closed.subpaths[0].closed).toBeTruthy();
		expect(closed.subpaths[0].nodes).toHaveLength(4);
		expect(closeEditPath(closed, 0)).toBeUndefined();
	});

	it('deleting a segment of a closed path opens it there', () => {
		const next = deleteEditSegment(square(), { subpath: 0, segment: 3 })!;
		const sub = next.subpaths[0];
		expect(sub.closed).toBeFalsy();
		expect(sub.nodes.map((n) => [n.x, n.y])).toStrictEqual([
			[0, 0],
			[100, 0],
			[100, 100],
			[0, 100],
		]);
		expect(sub.segments).toHaveLength(3);
	});

	it('deleting a middle segment of an open path splits it', () => {
		const open = deleteEditSegment(square(), { subpath: 0, segment: 3 })!;
		const split = deleteEditSegment(open, { subpath: 0, segment: 1 })!;
		expect(split.subpaths).toHaveLength(2);
		expect(split.subpaths[0].nodes).toHaveLength(2);
		expect(split.subpaths[1].nodes).toHaveLength(2);
	});

	it('makes a vertex smooth by aligning its handles along its neighbours', () => {
		const next = setEditNodeType(square(), { subpath: 0, node: 1 }, 'smooth')!;
		const sub = next.subpaths[0];
		expect(sub.nodes[1].type).toBe('smooth');
		const inSeg = sub.segments[0];
		const outSeg = sub.segments[1];
		if (inSeg.kind !== 'curve' || outSeg.kind !== 'curve') {
			throw new Error('expected curves');
		}
		// Neighbours (0,0) and (100,100): the tangent runs along the diagonal.
		const ax = inSeg.c2.x - 100;
		const ay = Number(inSeg.c2.y);
		const bx = outSeg.c1.x - 100;
		const by = Number(outSeg.c1.y);
		expect(ax * by - ay * bx).toBeCloseTo(0, 6);
		expect(Math.hypot(ax, ay)).toBeCloseTo(Math.hypot(bx, by), 6);
	});

	it('switches a segment between straight and curved', () => {
		const curved = setEditSegmentKind(square(), { subpath: 0, segment: 0 }, 'curve')!;
		expect(curved.subpaths[0].segments[0].kind).toBe('curve');
		expect(setEditSegmentKind(curved, { subpath: 0, segment: 0 }, 'curve')).toBeUndefined();
		const straight = setEditSegmentKind(curved, { subpath: 0, segment: 0 }, 'line')!;
		expect(straight.subpaths[0].segments[0].kind).toBe('line');
	});
});
