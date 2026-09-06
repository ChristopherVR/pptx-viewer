import { describe, it, expect } from 'vitest';

import { build3DExtrusionData } from './visual-3d-extrusion';

describe('build3DExtrusionData', () => {
	it('returns hasExtrusion: false when no shape3d', () => {
		const result = build3DExtrusionData(undefined, undefined, '#000', 100, 100);
		expect(result.hasExtrusion).toBeFalsy();
		expect(result.panels).toHaveLength(0);
	});

	it('returns hasExtrusion: false when extrusionHeight is zero', () => {
		expect(
			build3DExtrusionData({ extrusionHeight: 0 }, undefined, '#000', 100, 100).hasExtrusion,
		).toBeFalsy();
	});

	it('returns hasExtrusion: true with panels for valid extrusion', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250, extrusionColor: '#4472C4' },
			{ cameraPreset: 'perspectiveFront' },
			'#4472C4',
			200,
			150,
		);
		expect(result.hasExtrusion).toBeTruthy();
		expect(result.panels.length).toBeGreaterThan(0);
		expect(result.panels.length).toBeLessThanOrEqual(4);
	});

	it('wrapper style has preserve-3d, no separate perspective for a homography-driven preset', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			{ cameraPreset: 'perspectiveFront' },
			'#888',
			200,
			100,
		);
		expect(result.wrapperStyle.transformStyle).toBe('preserve-3d');
		// `perspectiveFront` is a COM-measured homography-driven preset (see
		// `visual-3d-camera-homography`): the wrapper skips a generic
		// `perspective` distance (which would compound a second, unrelated
		// projection on top of the matrix3d) and instead pins transform-origin
		// to match the front face's.
		expect(result.wrapperStyle.perspective).toBeUndefined();
		expect(result.wrapperStyle.transformOrigin).toBe('0 0');
		expect(result.wrapperStyle.pointerEvents).toBe('none');
	});

	it('wrapper style falls back to a generic re-projected perspective with no scene3d at all', () => {
		const result = build3DExtrusionData({ extrusionHeight: 95250 }, undefined, '#888', 200, 100);
		// No camera preset at all: falls back to the generic default distance
		// re-projected onto this element's 200x100 size (see
		// `getDefaultPerspectivePx`): 200/2 / tan(atan(150/800)) = 533.33 ~ 533.
		expect(result.wrapperStyle.perspective).toBe('533px');
	});

	it('front face style has translateZ', () => {
		const result = build3DExtrusionData({ extrusionHeight: 95250 }, undefined, '#888', 200, 100);
		expect(String(result.frontFaceStyle.transform)).toContain('translateZ(');
		expect(result.frontFaceStyle.backfaceVisibility).toBe('hidden');
	});

	it('generates side panels for all four sides with no rotation', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			{ cameraPreset: 'perspectiveFront' },
			'#888',
			200,
			100,
		);
		const sides = result.panels.map((p) => p.side);
		expect(sides).toContain('bottom');
		expect(sides).toContain('top');
		expect(sides).toContain('left');
		expect(sides).toContain('right');
	});

	// Re-ground-truthed 2026-09 (`Slide.Export`, an extruded 2in square,
	// front/side faces in distinct colours, edge-band ink analysis; see
	// `PANEL_DEPTH_SKEW_MAP`'s doc comment): PowerPoint shows only the BOTTOM
	// panel for `perspectiveHeroicLeftFacing` and only the TOP panel for
	// `isometricOffAxis1Left`. An earlier, coarser measurement pass (a "count
	// green pixels in the band beyond the front bbox" classifier) over-counted
	// a second RIGHT panel for both that the edge-fit method - which confirms
	// each side independently against its own analytic front-edge corners -
	// does not find.
	it('shows only the COM-verified bottom panel for perspectiveHeroicLeftFacing', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 457200 },
			{ cameraPreset: 'perspectiveHeroicLeftFacing' },
			'#FF0000',
			200,
			200,
		);
		const sides = result.panels.map((p) => p.side).sort();
		expect(sides).toStrictEqual(['bottom']);
	});

	it('shows only the COM-verified top panel for isometricOffAxis1Left', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 457200 },
			{ cameraPreset: 'isometricOffAxis1Left' },
			'#FF0000',
			200,
			200,
		);
		const sides = result.panels.map((p) => p.side).sort();
		expect(sides).toStrictEqual(['top']);
	});

	it('bottom panel has correct width and depth', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			{ cameraPreset: 'perspectiveFront' },
			'#888',
			200,
			100,
		);
		const bottom = result.panels.find((p) => p.side === 'bottom');
		expect(bottom?.style.width).toBe(200);
		expect(bottom?.style.height).toBe(10);
	});

	it('caps extrusion depth at 80px', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 9525 * 200 },
			undefined,
			'#888',
			200,
			100,
		);
		const bottom = result.panels.find((p) => p.side === 'bottom');
		expect(bottom?.style.height).toBe(80);
	});

	it('applies the default custom-rotation perspective (re-projected onto element size) when no scene3d', () => {
		const result = build3DExtrusionData({ extrusionHeight: 95250 }, undefined, '#888', 200, 100);
		// The 800px reference default (at the 300px reference size) re-projected
		// onto this 200x100 element: 100 / tan(atan(150/800)) = 533.33, rounds to 533.
		expect(result.wrapperStyle.perspective).toBe('533px');
	});

	it('selectively shows panels based on camera angle', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			// COM-measured 2026-09 (see `visual-3d-panel-sides`'s
			// `PERSPECTIVE_MEASURED_EXCEPTIONS` doc comment): this preset shows
			// ONLY the left panel, never top/bottom/right.
			{ cameraPreset: 'perspectiveHeroicExtremeRightFacing' },
			'#888',
			200,
			100,
		);
		const sides = result.panels.map((p) => p.side);
		expect(sides).toContain('left');
		expect(sides).not.toContain('right');
		expect(sides).not.toContain('top');
		expect(sides).not.toContain('bottom');
	});

	// COM-measured 2026-09 (full 44-preset extrusion-panel campaign, see
	// `visual-3d-panel-sides`'s `PERSPECTIVE_MEASURED_EXCEPTIONS` doc
	// comment): `perspectiveHeroicExtremeLeftFacing` showed literally ZERO
	// panel pixels on every side despite its mirror twin
	// (`RightFacing`) showing a strong left panel; a face-on-equivalent
	// "no signal" result falls back to the deliberate all-4-panels
	// depth-perception default rather than rendering no depth at all.
	it('falls back to all 4 panels for a measured "no panel" exception (perspectiveHeroicExtremeLeftFacing)', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			{ cameraPreset: 'perspectiveHeroicExtremeLeftFacing' },
			'#888',
			200,
			100,
		);
		const sides = result.panels.map((p) => p.side).sort();
		expect(sides).toStrictEqual(['bottom', 'left', 'right', 'top']);
	});

	it('includes material overlay for metal material', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250, presetMaterial: 'metal' },
			undefined,
			'#888',
			200,
			100,
		);
		expect(result.materialOverlay).toContain('linear-gradient');
		expect(result.materialOverlay).toContain('rgba(255,255,255,0.3)');
	});

	it('returns no material overlay for flat material', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250, presetMaterial: 'flat' },
			undefined,
			'#888',
			200,
			100,
		);
		expect(result.materialOverlay).toBeUndefined();
	});

	it('applies camera-aware material gradient overlay angle', () => {
		const front = build3DExtrusionData(
			{ extrusionHeight: 95250, presetMaterial: 'metal' },
			{ cameraPreset: 'perspectiveFront' },
			'#888',
			200,
			100,
		);
		expect(front.materialOverlay).toContain('135deg');

		const right = build3DExtrusionData(
			{ extrusionHeight: 95250, presetMaterial: 'metal' },
			{ cameraPreset: 'perspectiveRight' },
			'#888',
			200,
			100,
		);
		expect(right.materialOverlay).not.toContain('135deg');
	});
});
