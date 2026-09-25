/**
 * Basic Venn parity: PowerPoint caches the Venn circles as `accent1` at
 * `a:alpha 50000` (solid for flat styles, every gradient stop for bevel
 * styles), so the 2D projection, the label colour and the 3D mesh all have to
 * carry that alpha.
 */
import type { PptxSmartArtData, PptxSmartArtDrawingShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSmartArt3DDrawingModel } from './smartart-3d-drawing-model';
import { computeDrawingViewBox, projectDrawingShapes } from './smartart-drawing';
import {
	drawingShapeFillOpacity,
	drawingShapeLabelColor,
	drawingShapeMeshOpacity,
} from './smartart-drawing-label-color';

const ACCENT1 = '#156082';

function circle(over: Partial<PptxSmartArtDrawingShape> = {}): PptxSmartArtDrawingShape {
	return {
		id: 'c1',
		shapeType: 'ellipse',
		x: 0,
		y: 0,
		width: 218,
		height: 218,
		fillColor: ACCENT1,
		fillOpacity: 0.5,
		text: 'Alpha',
		...over,
	};
}

function project(shapes: PptxSmartArtDrawingShape[]) {
	return projectDrawingShapes('el', shapes, computeDrawingViewBox(shapes), [ACCENT1], 'flat');
}

describe('drawing shape fill opacity', () => {
	it('projects a solid fill alpha as fillOpacity', () => {
		const [rendered] = project([circle()]);
		expect(rendered!.fill).toBe(ACCENT1);
		expect(rendered!.fillOpacity).toBe(0.5);
	});

	it('omits fillOpacity for opaque, unfilled and gradient shapes', () => {
		const [opaque, none, gradient] = project([
			circle({ fillOpacity: undefined }),
			circle({ fillNone: true }),
			circle({ fillGradientStops: [{ color: ACCENT1, position: 0, opacity: 0.5 }] }),
		]);
		expect(opaque!.fillOpacity).toBeUndefined();
		expect(none!.fillOpacity).toBeUndefined();
		expect(gradient!.fillOpacity).toBeUndefined();
		expect(drawingShapeFillOpacity(circle({ fillOpacity: 1 }))).toBeUndefined();
	});

	it('reads the label against the blended fill, so a 50% Venn circle gets dark text', () => {
		const venn = circle();
		expect(drawingShapeLabelColor(venn, [venn], 0, ACCENT1)).toBe('#1a1a1a');
		const opaque = circle({ fillOpacity: undefined });
		expect(drawingShapeLabelColor(opaque, [opaque], 0, ACCENT1)).toBe('#ffffff');
		const bevel = circle({
			fillOpacity: undefined,
			fillGradientStops: [
				{ color: ACCENT1, position: 0, opacity: 0.5 },
				{ color: ACCENT1, position: 100, opacity: 0.5 },
			],
		});
		expect(drawingShapeLabelColor(bevel, [bevel], 0, 'url(#g)')).toBe('#1a1a1a');
	});

	it('gives the 3D mesh the solid alpha, or a gradient uniform stop alpha', () => {
		expect(drawingShapeMeshOpacity(circle())).toBe(0.5);
		expect(drawingShapeMeshOpacity(circle({ fillOpacity: undefined }))).toBe(1);
		const uniform = circle({
			fillOpacity: undefined,
			fillGradientStops: [
				{ color: ACCENT1, position: 0, opacity: 0.5 },
				{ color: ACCENT1, position: 100, opacity: 0.5 },
			],
		});
		expect(drawingShapeMeshOpacity(uniform)).toBe(0.5);
		const varying = circle({
			fillOpacity: undefined,
			fillGradientStops: [
				{ color: ACCENT1, position: 0, opacity: 0.2 },
				{ color: ACCENT1, position: 100 },
			],
		});
		expect(drawingShapeMeshOpacity(varying)).toBe(1);
	});

	it('builds semi-transparent flat meshes for the Venn circles', () => {
		const data: PptxSmartArtData = {
			nodes: [],
			style: 'flat',
			drawingShapes: [circle(), circle({ id: 'c2', x: 100 })],
		};
		const model = buildSmartArt3DDrawingModel(data)!;
		expect(model.meshes.map((mesh) => mesh.opacity)).toStrictEqual([0.5, 0.5]);
	});
});
