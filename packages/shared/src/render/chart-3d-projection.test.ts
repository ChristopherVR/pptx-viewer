import { describe, expect, it } from 'vitest';

import { resolveChart3DProjection } from './chart-3d-projection';

describe('resolveChart3DProjection', () => {
	it('defaults bar3D to oblique (rAngAx=1) with PowerPoint defaults rotX=15, rotY=20', () => {
		const p = resolveChart3DProjection('bar3D', undefined);
		expect(p.mode).toBe('oblique');
		expect(p.rotXDeg).toBe(15);
		expect(p.rotYDeg).toBe(20);
	});

	it('matches the flat 2D fallback depth vector direction for bar3D defaults', () => {
		const p = resolveChart3DProjection('bar3D', undefined);
		if (p.mode !== 'oblique') {
			throw new Error('expected oblique');
		}
		// rotY=20 -> positive horizontal shear (recedes toward screen right);
		// rotX=15 -> negative vertical shear (recedes upward), matching
		// chart-3d-depth.ts#computeDepthVector's dx>0, dy<0 for the same inputs.
		expect(p.shearX).toBeGreaterThan(0);
		expect(p.shearY).toBeLessThan(0);
	});

	it('honours an explicit rAngAx=0 override on a bar3D chart', () => {
		const p = resolveChart3DProjection('bar3D', { rAngAx: false });
		expect(p.mode).toBe('perspective');
	});

	it('defaults line3D/area3D/surface to perspective (rAngAx=0) with rotX=15, rotY=20', () => {
		for (const chartType of ['line3D', 'area3D', 'surface']) {
			const p = resolveChart3DProjection(chartType, undefined);
			expect(p.mode).toBe('perspective');
			expect(p.rotXDeg).toBe(15);
			expect(p.rotYDeg).toBe(20);
		}
	});

	it('defaults pie3D to perspective with its own rotX=30, rotY=0 tilt', () => {
		const p = resolveChart3DProjection('pie3D', undefined);
		expect(p.mode).toBe('perspective');
		expect(p.rotXDeg).toBe(30);
		expect(p.rotYDeg).toBe(0);
	});

	it('resolves the perspective FOV from c:view3D/c:perspective, absent defaults to 30deg', () => {
		const base = resolveChart3DProjection('line3D', undefined);
		const wide = resolveChart3DProjection('line3D', { rAngAx: false, perspective: 120 });
		const narrow = resolveChart3DProjection('line3D', { rAngAx: false, perspective: 0 });
		if (
			base.mode !== 'perspective' ||
			wide.mode !== 'perspective' ||
			narrow.mode !== 'perspective'
		) {
			throw new Error('expected perspective');
		}
		expect(narrow.fovDeg).toBeLessThan(base.fovDeg);
		expect(base.fovDeg).toBeLessThan(wide.fovDeg);
	});

	it('reads the deck-measured chart1.xml/chart10.xml/chart16.xml view3D values as-is', () => {
		// chart1.xml (3d-column-clustered): rotX=15 rotY=20 depthPercent=100 rAngAx=1
		const bar = resolveChart3DProjection('bar3D', {
			rotX: 15,
			rotY: 20,
			depthPercent: 100,
			rAngAx: true,
		});
		expect(bar.mode).toBe('oblique');
		// chart10.xml (3d-line): rotX=15 rotY=20 rAngAx=0
		const line = resolveChart3DProjection('line3D', { rotX: 15, rotY: 20, rAngAx: false });
		expect(line.mode).toBe('perspective');
		if (line.mode === 'perspective') {
			expect(line.rotXDeg).toBe(15);
			expect(line.rotYDeg).toBe(20);
		}
		// chart16.xml (3d-surface): rotX=15 rotY=20 rAngAx=0
		const surface = resolveChart3DProjection('surface', { rotX: 15, rotY: 20, rAngAx: false });
		expect(surface.mode).toBe('perspective');
	});
});
