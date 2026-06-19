import type { MaterialPresetType } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	getMaterialCssOverrides,
	getMaterialGradientOverlay,
	getLightAngleFromCamera,
} from './visual-3d-materials';

describe('getMaterialCssOverrides', () => {
	it('returns empty object for undefined material', () => {
		expect(getMaterialCssOverrides(undefined)).toStrictEqual({});
	});

	it('returns empty object for unrecognised material', () => {
		expect(getMaterialCssOverrides('nonexistent' as MaterialPresetType)).toStrictEqual({});
	});

	it('returns soft diffuse filter for matte', () => {
		const result = getMaterialCssOverrides('matte');
		expect(result.filter).toBe('brightness(0.95) saturate(0.9)');
		expect(result.opacity).toBeUndefined();
		expect(result.boxShadow).toBeUndefined();
	});

	it('returns warm sepia-tinted filter for warmMatte', () => {
		expect(getMaterialCssOverrides('warmMatte').filter).toBe(
			'brightness(1.0) saturate(0.85) sepia(0.08)',
		);
	});

	it('returns bright contrast filter and specular highlight for plastic', () => {
		const result = getMaterialCssOverrides('plastic');
		expect(result.filter).toBe('brightness(1.05) contrast(1.05)');
		expect(result.boxShadow).toContain('inset');
	});

	it('returns strong metallic filter and specular for metal', () => {
		const result = getMaterialCssOverrides('metal');
		expect(result.filter).toBe('brightness(1.1) contrast(1.15) saturate(1.2)');
		expect(result.boxShadow).toBeDefined();
	});

	it('returns empty overrides for flat', () => {
		expect(getMaterialCssOverrides('flat')).toStrictEqual({});
	});

	it('returns translucent appearance for clear', () => {
		const result = getMaterialCssOverrides('clear');
		expect(result.opacity).toBe(0.7);
		expect(result.filter).toBe('brightness(1.15)');
	});

	it('does not set mixBlendMode for any preset', () => {
		const presets: MaterialPresetType[] = [
			'matte',
			'warmMatte',
			'plastic',
			'metal',
			'dkEdge',
			'softEdge',
			'flat',
			'softmetal',
			'clear',
			'powder',
			'translucentPowder',
		];
		for (const preset of presets) {
			expect(getMaterialCssOverrides(preset).mixBlendMode).toBeUndefined();
		}
	});

	it('returns multi-layer specular for metal box-shadow', () => {
		const result = getMaterialCssOverrides('metal');
		const insetCount = (result.boxShadow?.match(/inset/gu) ?? []).length;
		expect(insetCount).toBeGreaterThanOrEqual(3);
	});

	it('all non-flat presets have a backgroundImage gradient', () => {
		const presetsWithGradient: MaterialPresetType[] = [
			'matte',
			'warmMatte',
			'plastic',
			'metal',
			'dkEdge',
			'softEdge',
			'softmetal',
			'clear',
			'powder',
			'translucentPowder',
		];
		for (const preset of presetsWithGradient) {
			expect(getMaterialCssOverrides(preset).backgroundImage).toBeDefined();
		}
	});
});

describe('getLightAngleFromCamera', () => {
	it('returns 135 (top-left) for a head-on camera', () => {
		expect(getLightAngleFromCamera(0, 0)).toBe(135);
	});

	it('shifts the highlight angle when the camera yaws', () => {
		expect(getLightAngleFromCamera(0, 30)).not.toBe(135);
	});

	it('normalises into [0, 360)', () => {
		const angle = getLightAngleFromCamera(-90, 90);
		expect(angle).toBeGreaterThanOrEqual(0);
		expect(angle).toBeLessThan(360);
	});
});

describe('getMaterialGradientOverlay', () => {
	it('returns undefined for no material', () => {
		expect(getMaterialGradientOverlay(undefined, 0, 0)).toBeUndefined();
	});

	it('returns undefined for an unmapped material (flat)', () => {
		expect(getMaterialGradientOverlay('flat', 0, 0)).toBeUndefined();
	});

	it('returns a linear gradient for metal at the default angle', () => {
		const result = getMaterialGradientOverlay('metal', 0, 0);
		expect(result).toContain('linear-gradient');
		expect(result).toContain('135deg');
	});

	it('shifts the angle for a rotated camera', () => {
		const result = getMaterialGradientOverlay('metal', 0, -20);
		expect(result).not.toContain('135deg');
	});

	it('returns a radial gradient for softEdge', () => {
		expect(getMaterialGradientOverlay('softEdge', 0, 0)).toContain('radial-gradient');
	});
});
