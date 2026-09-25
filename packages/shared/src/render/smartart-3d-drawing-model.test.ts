import type { PptxSmartArtData, PptxSmartArtDrawingShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSmartArt3DDrawingModel } from './smartart-3d-drawing-model';

function shape(overrides: Partial<PptxSmartArtDrawingShape> = {}): PptxSmartArtDrawingShape {
	return {
		id: 's1',
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		fillColor: '#336699',
		...overrides,
	};
}

function dataWith(shapes: PptxSmartArtDrawingShape[]): PptxSmartArtData {
	return {
		nodes: [],
		style: 'flat',
		drawingShapes: shapes,
	};
}

describe('buildSmartArt3DDrawingModel', () => {
	it('returns undefined when there are no drawing shapes', () => {
		expect(buildSmartArt3DDrawingModel(dataWith([]))).toBeUndefined();
		expect(buildSmartArt3DDrawingModel({ nodes: [], style: 'flat' })).toBeUndefined();
	});

	it('builds one flat, zero-depth mesh per shape with the resolved fill', () => {
		const model = buildSmartArt3DDrawingModel(dataWith([shape()]));
		expect(model).toBeDefined();
		expect(model?.styleCategory).toBe('flat');
		expect(model?.meshes).toHaveLength(1);
		const mesh = model!.meshes[0];
		expect(mesh.flat).toBeTruthy();
		expect(mesh.depth).toBe(0);
		expect(mesh.fill).toBe('#336699');
		expect(mesh.fillNone).toBeFalsy();
	});

	it('centres a single rect shape at the world origin', () => {
		const model = buildSmartArt3DDrawingModel(
			dataWith([shape({ x: 0, y: 0, width: 100, height: 50 })]),
		);
		const mesh = model!.meshes[0];
		// A single shape's viewBox is exactly its own bounds, so its centre
		// lands on the world origin (worldX = x - w/2, worldY = h/2 - y).
		expect(mesh.position.x).toBeCloseTo(0, 6);
		expect(mesh.position.y).toBeCloseTo(0, 6);
	});

	it('produces a 4-corner rect outline (plus closing point) for an un-rounded rect', () => {
		const model = buildSmartArt3DDrawingModel(dataWith([shape()]));
		const mesh = model!.meshes[0];
		expect(mesh.outline.length).toBeGreaterThanOrEqual(5);
		// Outline is mesh-local (centred on the mesh's own origin): half-extents
		// should match the shape's own half width/height.
		const xs = mesh.outline.map((p) => p.x);
		const ys = mesh.outline.map((p) => p.y);
		expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 5);
		expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(50, 5);
	});

	it('marks a:noFill shapes as fillNone with no fill colour', () => {
		const model = buildSmartArt3DDrawingModel(
			dataWith([shape({ fillNone: true, fillColor: undefined })]),
		);
		const mesh = model!.meshes[0];
		expect(mesh.fillNone).toBeTruthy();
	});

	it('carries a text block with pre-wrapped lines when the shape has text', () => {
		const model = buildSmartArt3DDrawingModel(
			dataWith([shape({ text: 'Hello world', fontSize: 12, fontColor: '#ffffff' })]),
		);
		const mesh = model!.meshes[0];
		expect(mesh.textBlock).toBeDefined();
		expect(mesh.textBlock?.lines.length).toBeGreaterThan(0);
		expect(mesh.textBlock?.lines[0].text).toContain('Hello');
		expect(mesh.textBlock?.color).toBe('#ffffff');
	});

	it("paints a translucent fill's opacity, or a gradient's mean stop opacity", () => {
		const solid = buildSmartArt3DDrawingModel(dataWith([shape({ fillOpacity: 0.5 })]));
		expect(solid!.meshes[0].opacity).toBe(0.5);
		const gradient = buildSmartArt3DDrawingModel(
			dataWith([
				shape({
					fillGradientStops: [
						{ color: '#336699', position: 0, opacity: 0.5 },
						{ color: '#224466', position: 100, opacity: 0.5 },
					],
					fillGradientType: 'linear',
					fillGradientAngle: 90,
				}),
			]),
		);
		expect(gradient!.meshes[0].opacity).toBeCloseTo(0.5, 6);
		expect(buildSmartArt3DDrawingModel(dataWith([shape()]))!.meshes[0].opacity).toBe(1);
	});

	it("extrudes a scene style's label by its text3d depth", () => {
		const model = buildSmartArt3DDrawingModel(
			dataWith([
				shape({
					text: 'Alpha',
					shape3d: { extrusionHeight: 152250 },
					text3d: { extrusionHeight: 28000 },
				}),
			]),
		);
		expect(model?.styleCategory).toBe('scene');
		expect(model!.meshes[0].textBlock?.extrusion).toBeCloseTo(28000 / 9525, 6);
	});

	it('omits the text block when the shape has no text', () => {
		const model = buildSmartArt3DDrawingModel(dataWith([shape()]));
		expect(model!.meshes[0].textBlock).toBeUndefined();
	});

	it('separates two stacked shapes along z by paint order', () => {
		const model = buildSmartArt3DDrawingModel(
			dataWith([shape({ id: 'a' }), shape({ id: 'b', y: 60, fillColor: '#ff0000' })]),
		);
		const [meshA, meshB] = model!.meshes;
		expect(meshB.position.z).toBeGreaterThan(meshA.position.z);
	});

	it('keeps a rotated shape square (rotation baked into the outline, not left axis-aligned)', () => {
		const model = buildSmartArt3DDrawingModel(dataWith([shape({ rotation: 45 })]));
		const mesh = model!.meshes[0];
		// A 45-degree rotated square's bounding box grows by sqrt(2) on each
		// axis relative to the un-rotated outline (still centred on the origin).
		const xs = mesh.outline.map((p) => p.x);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
	});

	it('reports the whole-diagram bounds as the union of all shapes', () => {
		const model = buildSmartArt3DDrawingModel(
			dataWith([
				shape({ x: 0, y: 0, width: 100, height: 50 }),
				shape({ id: 's2', x: 200, y: 0, width: 50, height: 50 }),
			]),
		);
		expect(model?.bounds.width).toBeCloseTo(250, 5);
		expect(model?.bounds.height).toBeCloseTo(50, 5);
	});
});
