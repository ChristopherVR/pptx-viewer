import { describe, expect, it } from 'vitest';

import { resolveExplicitOverrideCameraTransform } from './visual-3d-camera-override';

describe('resolveExplicitOverrideCameraTransform', () => {
	it('builds a matrix3d with transformOrigin 0 0 for an explicit rotation', () => {
		const result = resolveExplicitOverrideCameraTransform(
			{ cameraRotX: 1800000, cameraRotY: 2700000 },
			undefined,
			undefined,
			0,
			0,
		);
		expect(result.matrix3d).toBeDefined();
		expect(result.matrix3d).toContain('matrix3d(');
		expect(result.transformOrigin).toBe('0 0');
	});

	it('uses the override angle (negated X) for the rotateX/rotateY panel hint, not the preset default', () => {
		const result = resolveExplicitOverrideCameraTransform(
			{ cameraRotX: 1800000, cameraRotY: 2700000 },
			undefined,
			undefined,
			/* panelHintRotateX */ 999,
			/* panelHintRotateY */ -999,
		);
		expect(result.rotateX).toBe(-30);
		expect(result.rotateY).toBe(45);
	});

	it('falls back to the panel hint on an axis the override leaves untouched', () => {
		const result = resolveExplicitOverrideCameraTransform(
			{ cameraRotX: 1800000 },
			undefined,
			undefined,
			999,
			-999,
		);
		expect(result.rotateX).toBe(-30);
		expect(result.rotateY).toBe(-999);
	});

	// The 27-point lat x lon x rev COM grid (see `visual-3d-camera-
	// parametric.ts`'s `projectCorner` doc comment) found the override
	// projection purely ORTHOGRAPHIC, even for a combined (lat AND lon)
	// pose: no fov/zoom dependency at all. `@fov` vs the preset's
	// `perspectiveRefPx` hint therefore now produce the IDENTICAL matrix3d
	// for the same rotation (this replaced an earlier, pre-27-point-grid
	// assumption that a combined override's skew scaled with fov).
	it('is unaffected by @fov vs the preset perspectiveRefPx hint for a combined override (COM-confirmed orthographic)', () => {
		const withPresetFov = resolveExplicitOverrideCameraTransform(
			{ cameraRotX: 600000, cameraRotY: 600000 },
			{ perspectiveRefPx: 400 },
			{ width: 300, height: 300 },
			0,
			0,
		);
		const withExplicitFov = resolveExplicitOverrideCameraTransform(
			{ cameraRotX: 600000, cameraRotY: 600000, cameraFieldOfView: 30 * 60000 },
			{ perspectiveRefPx: 400 },
			{ width: 300, height: 300 },
			0,
			0,
		);
		expect(withPresetFov.matrix3d).toBe(withExplicitFov.matrix3d);
	});

	it('resolves panelSides from the computed homography', () => {
		const result = resolveExplicitOverrideCameraTransform(
			{ cameraRotX: 1800000, cameraRotY: 2700000 },
			undefined,
			undefined,
			0,
			0,
		);
		expect(result.panelSides).toBeDefined();
	});
});
