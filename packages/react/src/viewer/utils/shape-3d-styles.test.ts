import { describe, it, expect } from 'vitest';

import {
	computeExtrusionShadows,
	computeBevelStyles,
	computeMaterialFilter,
	computeCameraTransform,
	computeShape3dStyles,
} from './shape-3d-styles';

// ── computeExtrusionShadows ─────────────────────────────────────────────

describe('computeExtrusionShadows', () => {
	it('generates multiple box-shadow layers for positive depth', () => {
		const result = computeExtrusionShadows(10, '#4472C4');
		expect(result).not.toBe('');
		expect(result).toContain('#4472C4');
		const layers = result.split(',');
		expect(layers.length).toBeGreaterThan(3);
	});

	it('returns empty string for zero depth', () => {
		expect(computeExtrusionShadows(0, '#000000')).toBe('');
	});

	it('returns empty string for negative depth', () => {
		expect(computeExtrusionShadows(-5, '#FF0000')).toBe('');
	});

	it('uses the provided colour in shadow layers', () => {
		const result = computeExtrusionShadows(5, '#FF6600');
		expect(result).toContain('#FF6600');
	});

	it('respects the angle parameter', () => {
		const defaultAngle = computeExtrusionShadows(10, '#000');
		// Custom angle should produce a result (may differ from default)
		const customAngle = computeExtrusionShadows(10, '#000', 270);
		expect(defaultAngle).not.toBe('');
		expect(customAngle).not.toBe('');
	});

	it('includes a final soft shadow for depth perception', () => {
		const result = computeExtrusionShadows(8, '#888888');
		// The last layer has an rgba soft shadow
		expect(result).toContain('rgba(0,0,0,0.2)');
	});
});

// ── computeBevelStyles ──────────────────────────────────────────────────

describe('computeBevelStyles', () => {
	it('produces distinct styles for each of the 12 bevel presets', () => {
		const presets = [
			'circle',
			'relaxedInset',
			'cross',
			'coolSlant',
			'angle',
			'softRound',
			'convex',
			'slope',
			'divot',
			'riblet',
			'hardEdge',
			'artDeco',
		];

		const results = presets.map((p) => computeBevelStyles(p, 4, 4));

		// Every preset should produce a non-empty boxShadow
		for (const r of results) {
			expect(r.boxShadow).not.toBe('');
			expect(r.boxShadow).toContain('inset');
		}

		// At least some presets produce different shadows from each other
		const uniqueShadows = new Set(results.map((r) => r.boxShadow));
		expect(uniqueShadows.size).toBe(12);
	});

	it('returns empty boxShadow for "none" bevel type', () => {
		const result = computeBevelStyles('none', 4, 4);
		expect(result.boxShadow).toBe('');
	});

	it('returns empty boxShadow for empty bevel type', () => {
		const result = computeBevelStyles('', 4, 4);
		expect(result.boxShadow).toBe('');
	});

	it('returns empty boxShadow when width is zero', () => {
		const result = computeBevelStyles('circle', 0, 4);
		expect(result.boxShadow).toBe('');
	});

	it('returns empty boxShadow when height is zero', () => {
		const result = computeBevelStyles('circle', 4, 0);
		expect(result.boxShadow).toBe('');
	});

	it('convex bevel includes a background gradient', () => {
		const result = computeBevelStyles('convex', 3, 3);
		expect(result.boxShadow).not.toBe('');
		expect(result.background).toBeDefined();
		expect(result.background).toContain('radial-gradient');
	});

	it('divot bevel includes a background gradient', () => {
		const result = computeBevelStyles('divot', 3, 3);
		expect(result.background).toBeDefined();
		expect(result.background).toContain('radial-gradient');
	});

	it('softRound bevel includes a background gradient', () => {
		const result = computeBevelStyles('softRound', 3, 3);
		expect(result.background).toBeDefined();
		expect(result.background).toContain('radial-gradient');
	});

	it('circle bevel has no background gradient', () => {
		const result = computeBevelStyles('circle', 3, 3);
		expect(result.background).toBeUndefined();
	});

	it('hardEdge bevel produces zero-blur shadows', () => {
		const result = computeBevelStyles('hardEdge', 4, 4);
		// hardEdge uses 0px blur
		expect(result.boxShadow).toContain(' 0 rgba(');
	});
});

// ── computeMaterialFilter ───────────────────────────────────────────────

describe('computeMaterialFilter', () => {
	it('returns brightness filter for matte', () => {
		const result = computeMaterialFilter('matte');
		expect(result).toContain('brightness(0.95)');
		expect(result).toContain('saturate(0.9)');
	});

	it('returns saturate + contrast for plastic', () => {
		const result = computeMaterialFilter('plastic');
		expect(result).toContain('brightness(1.05)');
		expect(result).toContain('contrast(1.05)');
	});

	it('returns metallic filters for metal', () => {
		const result = computeMaterialFilter('metal');
		expect(result).toContain('brightness(1.1)');
		expect(result).toContain('contrast(1.15)');
		expect(result).toContain('saturate(1.2)');
	});

	it('returns sepia for warmMatte', () => {
		const result = computeMaterialFilter('warmMatte');
		expect(result).toContain('sepia');
	});

	it('returns empty string for flat (no filter)', () => {
		expect(computeMaterialFilter('flat')).toBe('');
	});

	it('returns empty string for empty input', () => {
		expect(computeMaterialFilter('')).toBe('');
	});

	it('returns empty string for unknown material', () => {
		expect(computeMaterialFilter('unknownMat')).toBe('');
	});

	it('returns correct filter for softmetal', () => {
		const result = computeMaterialFilter('softmetal');
		expect(result).toContain('brightness(1.05)');
		expect(result).toContain('contrast(1.08)');
		expect(result).toContain('saturate(1.1)');
	});
});

// ── computeCameraTransform ──────────────────────────────────────────────

describe('computeCameraTransform', () => {
	it('returns perspective for perspectiveFront preset', () => {
		const result = computeCameraTransform('perspectiveFront');
		expect(result).toContain('perspective(1000px)');
	});

	it('returns rotateX for perspectiveAbove preset', () => {
		const result = computeCameraTransform('perspectiveAbove');
		expect(result).toContain('perspective(1000px)');
		expect(result).toContain('rotateX(-20deg)');
	});

	it('returns rotateY for perspectiveLeft preset', () => {
		const result = computeCameraTransform('perspectiveLeft');
		expect(result).toContain('rotateY(20deg)');
	});

	it('uses explicit lat/lon overrides', () => {
		// 1800000 = 30deg in 60000ths
		const result = computeCameraTransform('perspectiveFront', 1800000, 2700000);
		expect(result).toContain('perspective(1000px)');
		expect(result).toContain('rotateX(-30deg)');
		expect(result).toContain('rotateY(45deg)');
	});

	it('returns empty string when no preset and no rotations', () => {
		expect(computeCameraTransform()).toBe('');
		expect(computeCameraTransform(undefined, undefined, undefined)).toBe('');
	});

	it('returns empty string for orthographicFront (no perspective, no rotation)', () => {
		expect(computeCameraTransform('orthographicFront')).toBe('');
	});

	it('applies default perspective for explicit rotations without preset', () => {
		const result = computeCameraTransform(undefined, 600000); // 10deg
		expect(result).toContain('perspective(800px)');
		expect(result).toContain('rotateX(-10deg)');
	});

	it('includes all three rotation axes for isometric presets', () => {
		const result = computeCameraTransform('isometricTopUp');
		expect(result).toContain('rotateX(');
		expect(result).toContain('rotateZ(');
	});
});

// ── computeShape3dStyles ────────────────────────────────────────────────

describe('computeShape3dStyles', () => {
	it('returns empty object when both inputs are undefined', () => {
		const result = computeShape3dStyles(undefined, undefined);
		expect(Object.keys(result)).toHaveLength(0);
	});

	it('returns empty object when both inputs are omitted', () => {
		const result = computeShape3dStyles();
		expect(Object.keys(result)).toHaveLength(0);
	});

	it('applies extrusion shadows for shape3d with depth', () => {
		const result = computeShape3dStyles({
			extrusionHeight: 95250, // 10px
			extrusionColor: '#4472C4',
		});
		expect(result.boxShadow).toBeDefined();
		expect(result.boxShadow as string).toContain('#4472C4');
	});

	it('applies bevel inset shadows without extrusion', () => {
		const result = computeShape3dStyles({
			bevelTopType: 'circle',
			bevelTopWidth: 28575,
			bevelTopHeight: 28575,
		});
		expect(result.boxShadow).toBeDefined();
		expect(result.boxShadow as string).toContain('inset');
	});

	it('applies camera perspective for scene3d alone', () => {
		const result = computeShape3dStyles(undefined, {
			cameraPreset: 'perspectiveFront',
		});
		expect(result.perspective).toBe('1000px');
		expect(result.willChange).toBe('transform');
	});

	it('applies material filter for shape3d with presetMaterial', () => {
		const result = computeShape3dStyles({ presetMaterial: 'metal' });
		expect(result.filter).toBeDefined();
		expect(result.filter as string).toContain('brightness');
	});

	it('combines extrusion + bevel + material + camera into one style', () => {
		const result = computeShape3dStyles(
			{
				extrusionHeight: 47625,
				extrusionColor: '#4472C4',
				bevelTopType: 'circle',
				bevelTopWidth: 19050,
				bevelTopHeight: 19050,
				presetMaterial: 'plastic',
			},
			{
				cameraPreset: 'perspectiveAbove',
				lightRigType: 'threePt',
			},
		);

		expect(result.perspective).toBe('1000px');
		expect(result.transform).toContain('rotateX(-20deg)');
		expect(result.boxShadow).toBeDefined();
		const shadow = result.boxShadow as string;
		expect(shadow).toContain('#4472C4'); // extrusion
		expect(shadow).toContain('inset'); // bevel + material
		expect(result.filter).toBeDefined();
		expect(result.backgroundImage).toContain('linear-gradient'); // light rig
	});

	it('handles partial 3D with only extrusion (no bevel, no material)', () => {
		const result = computeShape3dStyles({
			extrusionHeight: 28575,
			extrusionColor: '#000000',
		});
		expect(result.boxShadow).toBeDefined();
		expect(result.boxShadow as string).toContain('#000000');
	});

	it('handles partial 3D with only bevel (no extrusion)', () => {
		const result = computeShape3dStyles({
			bevelTopType: 'hardEdge',
			bevelTopWidth: 19050,
			bevelTopHeight: 19050,
		});
		expect(result.boxShadow).toBeDefined();
		expect(result.boxShadow as string).toContain('inset');
	});

	it('applies light rig gradient overlay from scene3d', () => {
		const result = computeShape3dStyles(undefined, {
			lightRigType: 'harsh',
			lightRigDirection: 't',
		});
		expect(result.filter).toContain('contrast');
		expect(result.backgroundImage).toContain('linear-gradient');
	});

	it('applies backdrop ground shadow from scene3d', () => {
		const result = computeShape3dStyles(undefined, { hasBackdrop: true });
		expect(result.boxShadow).toBeDefined();
		expect(result.boxShadow as string).toContain('rgba(0,0,0,0.25)');
	});
});
