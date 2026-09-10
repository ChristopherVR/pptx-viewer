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

	// FOV only feeds the SECONDARY two-axis skew term (see
	// `visual-3d-camera-parametric.ts`'s `projectCorner` doc comment): a pure
	// single-axis override is FOV-INDEPENDENT by design (matches the
	// COM-measured pure-scale behaviour regardless of lens), so this must use
	// a combined (lat AND lon) override to actually exercise the FOV coupling.
	it('prefers an explicit @fov over the preset perspectiveRefPx hint for a combined override', () => {
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
		// Different FOV sources should change the projected homography's
		// magnitude (both are matrix3d, but not byte-identical).
		expect(withPresetFov.matrix3d).not.toBe(withExplicitFov.matrix3d);
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
