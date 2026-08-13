import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Connectors must follow the shape they are attached to.
 *
 * `SlideCanvasComponent.onPointerUp` discarded its drag state with no model
 * write, so nothing ever recomputed a connector's endpoints: dragging a box
 * left the arrow hanging in mid-air until the deck was reloaded. These tests
 * pin the new non-history `rerouteConnectors` write, plus the sibling
 * `applyShapeAdjustment` write the amber diamond commits through.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';

// ---------------------------------------------------------------------------
// Fixtures: two boxes joined right-edge -> left-edge by a bound connector.
// ---------------------------------------------------------------------------

function boxShape(id: string, x: number, y: number): PptxElement {
	return { type: 'shape', id, name: id, x, y, width: 100, height: 50 } as PptxElement;
}

/** Connector from `a`'s right-centre (site 1) to `b`'s left-centre (site 3). */
function boundConnector(): PptxElement {
	return {
		type: 'connector',
		id: 'c',
		name: 'c',
		x: 100,
		y: 25,
		width: 200,
		height: 1,
		shapeStyle: {
			connectorStartConnection: { shapeId: 'a', connectionSiteIndex: 1 },
			connectorEndConnection: { shapeId: 'b', connectionSiteIndex: 3 },
		},
	} as unknown as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements } as PptxSlide;
}

function service(elements: PptxElement[]): EditorStateService {
	const svc = new EditorStateService();
	svc.setSlides([slide(elements)]);
	return svc;
}

const connectorOf = (svc: EditorStateService) =>
	svc.slides()[0].elements.find((e) => e.id === 'c')!;

// ---------------------------------------------------------------------------
// rerouteConnectors
// ---------------------------------------------------------------------------

describe('rerouteConnectors', () => {
	it('re-anchors a bound connector after its shape is dragged away', () => {
		const svc = service([boxShape('a', 0, 0), boxShape('b', 300, 0), boundConnector()]);

		// Drag box A down 200px, exactly as a live gesture does.
		svc.beginTransform('Move');
		svc.applyTransform(0, 'a', { x: 0, y: 200, width: 100, height: 50 });
		// Before the reroute the connector is still pinned to the old geometry.
		expect(connectorOf(svc)).toMatchObject({ x: 100, y: 25, width: 200, height: 1 });

		svc.rerouteConnectors(0, ['a']);

		// start = a.right-centre = (100, 225); end = b.left-centre = (300, 25).
		expect(connectorOf(svc)).toMatchObject({ x: 100, y: 25, width: 200, height: 200 });
	});

	it('recomputes the flip flags so the arrowhead keeps pointing the right way', () => {
		const svc = service([boxShape('a', 0, 0), boxShape('b', 300, 0), boundConnector()]);
		svc.applyTransform(0, 'a', { x: 600, y: 0, width: 100, height: 50 });
		svc.rerouteConnectors(0, ['a']);
		// A is now to the RIGHT of B, so the connector must draw from its far corner.
		expect(connectorOf(svc)).toMatchObject({ flipHorizontal: true });
	});

	it('leaves the deck untouched when nothing bound moved', () => {
		const svc = service([boxShape('a', 0, 0), boxShape('b', 300, 0), boundConnector()]);
		const before = svc.slides();
		svc.rerouteConnectors(0, []);
		svc.rerouteConnectors(0, ['nobody']);
		expect(svc.slides()).toBe(before);
	});

	it('records no undo step of its own (the gesture already snapshotted)', () => {
		const svc = service([boxShape('a', 0, 0), boxShape('b', 300, 0), boundConnector()]);
		svc.beginTransform('Move');
		svc.applyTransform(0, 'a', { x: 0, y: 200, width: 100, height: 50 });
		svc.rerouteConnectors(0, ['a']);

		// ONE undo returns both the shape and the connector to their start.
		svc.undo();
		expect(svc.slides()[0].elements.find((e) => e.id === 'a')).toMatchObject({ y: 0 });
		expect(connectorOf(svc)).toMatchObject({ x: 100, y: 25, width: 200, height: 1 });
	});

	it('is a no-op for an out-of-range slide index', () => {
		const svc = service([boxShape('a', 0, 0), boundConnector()]);
		const before = svc.slides();
		svc.rerouteConnectors(9, ['a']);
		expect(svc.slides()).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// applyShapeAdjustment
// ---------------------------------------------------------------------------

describe('applyShapeAdjustment', () => {
	function roundRect(): PptxElement {
		return {
			type: 'shape',
			id: 'rr',
			name: 'rr',
			x: 0,
			y: 0,
			width: 200,
			height: 120,
			shapeType: 'roundRect',
		} as PptxElement;
	}

	it('writes the dragged guide onto shapeAdjustments', () => {
		const svc = service([roundRect()]);
		svc.applyShapeAdjustment(0, 'rr', 'adj', 32000);
		const el = svc.slides()[0].elements[0] as PptxElement & {
			shapeAdjustments?: Record<string, number>;
		};
		expect(el.shapeAdjustments?.adj).toBe(32000);
	});

	it('merges rather than replacing, so other guides survive', () => {
		const base = roundRect() as PptxElement & { shapeAdjustments?: Record<string, number> };
		base.shapeAdjustments = { adj: 1000, adj2: 4200 };
		const svc = service([base]);
		svc.applyShapeAdjustment(0, 'rr', 'adj', 25000);
		const el = svc.slides()[0].elements[0] as PptxElement & {
			shapeAdjustments?: Record<string, number>;
		};
		expect(el.shapeAdjustments).toStrictEqual({ adj: 25000, adj2: 4200 });
	});

	it('is a no-op for an unknown element', () => {
		const svc = service([roundRect()]);
		const before = svc.slides();
		svc.applyShapeAdjustment(0, 'nobody', 'adj', 25000);
		expect(svc.slides()).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// Component wiring: the gesture end has to reach the editor at all.
// ---------------------------------------------------------------------------

describe('canvas -> editor wiring', () => {
	it('emits a gesture end from the canvas the parent can reroute on', () => {
		const canvas = readFileSync(join(__dirname, 'slide-canvas.component.ts'), 'utf8');
		expect(canvas).toContain('readonly transformEnd = output<{ ids: readonly string[] }>()');
		expect(canvas).toContain('this.transformEnd.emit({ ids: [drag.id] })');
	});

	it('binds that end to the reroute, and the adjust drag to the adjustment write', () => {
		const viewer = readFileSync(join(__dirname, 'power-point-viewer.component.ts'), 'utf8');
		expect(viewer).toContain(
			'(transformEnd)="editor.rerouteConnectors(activeSlideIndex(), $event.ids)"',
		);
		expect(viewer).toContain('editor.applyShapeAdjustment(');
	});
});
