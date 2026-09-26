import { describe, expect, it } from 'vitest';

import { resolveSmartArt3DLightModel, shadeSmartArt3DNormal } from './smartart-3d-lighting';
import type { SolidTriangles } from './smartart-3d-solid-geometry';
import {
	isSmartArt3DGlassMaterial,
	isSmartArt3DTranslucentMesh,
	orientSmartArt3DTriangles,
	smartArt3DGlassLightModel,
	smartArt3DSurfaceAlpha,
	smartArt3DVertexAlphas,
} from './smartart-3d-translucency';
import type { SmartArt3DMesh } from './smartart-3d-types';

describe('smartArt3DSurfaceAlpha', () => {
	it('keeps the fill alpha for every non-glass material', () => {
		expect(smartArt3DSurfaceAlpha('plastic', 0.5, 1)).toBe(0.5);
		expect(smartArt3DSurfaceAlpha('matte', 0.5, 0)).toBe(0.5);
		expect(smartArt3DSurfaceAlpha(undefined, 1, 0.3)).toBe(1);
	});

	it('paints a face-on clear surface at a fifth of its alpha (Cartoon, gt/sa-078)', () => {
		expect(smartArt3DSurfaceAlpha('clear', 0.5, 1)).toBeCloseTo(0.1, 6);
	});

	it('grows denser as a clear surface turns edge-on, clamped to 1', () => {
		const face = smartArt3DSurfaceAlpha('clear', 0.5, 1);
		const tilted = smartArt3DSurfaceAlpha('clear', 0.5, 0.5);
		const edge = smartArt3DSurfaceAlpha('clear', 0.5, 0);
		expect(tilted).toBeGreaterThan(face);
		expect(edge).toBeGreaterThan(tilted);
		expect(edge).toBeLessThanOrEqual(1);
		expect(smartArt3DSurfaceAlpha('clear', 1, 0)).toBe(1);
	});
});

describe('smartArt3DVertexAlphas', () => {
	it('measures each vertex normal against the view axis', () => {
		const alphas = smartArt3DVertexAlphas([0, 0, 0, 1, 0, 0], [0, 0, 1, 0, 1, 0], 'clear', 0.5);
		expect(alphas[0]).toBeCloseTo(0.1, 6);
		expect(alphas[1]).toBeCloseTo(1, 6);
	});

	it('uses the direction to a perspective eye when given', () => {
		// A +x normal seen from an eye on the +x axis is face-on.
		const alphas = smartArt3DVertexAlphas([0, 0, 0], [1, 0, 0], 'clear', 0.5, {
			x: 100,
			y: 0,
			z: 0,
		});
		expect(alphas[0]).toBeCloseTo(0.1, 6);
	});
});

describe('orientSmartArt3DTriangles', () => {
	it('flips a triangle wound against its normal and leaves an agreeing one alone', () => {
		const tri: SolidTriangles = {
			positions: [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
			normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
		};
		orientSmartArt3DTriangles(tri);
		expect(tri.positions).toStrictEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]);
	});
});

describe('glass materials', () => {
	it('only clear is a glass', () => {
		expect(isSmartArt3DGlassMaterial('clear')).toBeTruthy();
		expect(isSmartArt3DGlassMaterial('metal')).toBeFalsy();
		expect(isSmartArt3DGlassMaterial(undefined)).toBeFalsy();
	});

	it('paints a glass unlit by the key light (a bevel band keeps the fill)', () => {
		const lit = resolveSmartArt3DLightModel(
			{ rig: 'contrasting', direction: 't', revDeg: 0 },
			'clear',
		);
		const glass = smartArt3DGlassLightModel(lit);
		const band = { x: 0, y: 0.8, z: 0.6 };
		expect(shadeSmartArt3DNormal(band, lit).mul).toBeGreaterThan(1.2);
		expect(shadeSmartArt3DNormal(band, glass).mul).toBeCloseTo(1, 6);
		expect(glass.tint).toStrictEqual(lit.tint);
	});

	it('flags a mesh translucent by its alpha or a glass material', () => {
		const base = { fillNone: false, opacity: 1 } as SmartArt3DMesh;
		expect(isSmartArt3DTranslucentMesh(base)).toBeFalsy();
		expect(isSmartArt3DTranslucentMesh({ ...base, opacity: 0.5 })).toBeTruthy();
		expect(
			isSmartArt3DTranslucentMesh({
				...base,
				solid: { extrusion: 0, contourWidth: 0, material: 'clear' },
			}),
		).toBeTruthy();
		expect(isSmartArt3DTranslucentMesh({ ...base, fillNone: true, opacity: 0.5 })).toBeFalsy();
	});
});
