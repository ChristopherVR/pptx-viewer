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

	it('wrapper style has preserve-3d and perspective', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			{ cameraPreset: 'perspectiveFront' },
			'#888',
			200,
			100,
		);
		expect(result.wrapperStyle.transformStyle).toBe('preserve-3d');
		expect(result.wrapperStyle.perspective).toBe('1000px');
		expect(result.wrapperStyle.pointerEvents).toBe('none');
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

	it('applies default 800px perspective when no scene3d', () => {
		const result = build3DExtrusionData({ extrusionHeight: 95250 }, undefined, '#888', 200, 100);
		expect(result.wrapperStyle.perspective).toBe('800px');
	});

	it('selectively shows panels based on camera angle', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 95250 },
			{ cameraPreset: 'perspectiveHeroicExtremeLeftFacing' }, // rotateY = 45
			'#888',
			200,
			100,
		);
		const sides = result.panels.map((p) => p.side);
		expect(sides).toContain('left');
		expect(sides).not.toContain('right');
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
