import { describe, expect, it, vi } from 'vitest';

import { applyChart3DMeshHighlight } from './chart-3d-mesh-highlight';
import type { HighlightableMaterial } from './chart-3d-mesh-highlight';

function fakeMaterial(): HighlightableMaterial {
	return { emissive: { set: vi.fn() }, emissiveIntensity: 0 };
}

describe('applyChart3DMeshHighlight', () => {
	it('highlights only the matching mark and clears the rest', () => {
		const a = fakeMaterial();
		const b = fakeMaterial();
		applyChart3DMeshHighlight(
			[
				{ mark: { seriesIndex: 0, pointIndex: 0 }, material: a },
				{ mark: { seriesIndex: 0, pointIndex: 1 }, material: b },
			],
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		);
		expect(a.emissive.set).toHaveBeenCalledWith('#000000');
		expect(a.emissiveIntensity).toBe(0);
		expect(b.emissive.set).toHaveBeenCalledWith('#3b82f6');
		expect(b.emissiveIntensity).toBeGreaterThan(0);
	});

	it('clears every mark when part is null', () => {
		const a = fakeMaterial();
		applyChart3DMeshHighlight([{ mark: { seriesIndex: 0, pointIndex: 0 }, material: a }], null);
		expect(a.emissive.set).toHaveBeenCalledWith('#000000');
		expect(a.emissiveIntensity).toBe(0);
	});

	it('applies the highlight to EVERY material of a multi-material (picture-fill) mesh', () => {
		const faces = [fakeMaterial(), fakeMaterial(), fakeMaterial()];
		applyChart3DMeshHighlight([{ mark: { seriesIndex: 0, pointIndex: 0 }, material: faces }], {
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 0,
		});
		for (const face of faces) {
			expect(face.emissive.set).toHaveBeenCalledWith('#3b82f6');
			expect(face.emissiveIntensity).toBeGreaterThan(0);
		}
	});

	it('clears EVERY material of a multi-material mesh that does not match the selection', () => {
		const faces = [fakeMaterial(), fakeMaterial()];
		applyChart3DMeshHighlight([{ mark: { seriesIndex: 0, pointIndex: 0 }, material: faces }], {
			role: 'dataPoint',
			seriesIndex: 1,
			pointIndex: 0,
		});
		for (const face of faces) {
			expect(face.emissive.set).toHaveBeenCalledWith('#000000');
			expect(face.emissiveIntensity).toBe(0);
		}
	});
});
