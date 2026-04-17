import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

import type { EffectToggleCfg } from './fill-stroke-effect-configs';
import { VISUAL_EFFECT_CONFIGS } from './fill-stroke-visual-configs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findConfig(label: string): EffectToggleCfg {
	const cfg = VISUAL_EFFECT_CONFIGS.find((c) => c.label === label);
	if (!cfg) {
		throw new Error(`Config not found: ${label}`);
	}
	return cfg;
}

// ---------------------------------------------------------------------------
// VISUAL_EFFECT_CONFIGS structure
// ---------------------------------------------------------------------------

describe('vISUAL_EFFECT_CONFIGS structure', () => {
	it('exports a non-empty array', () => {
		expect(Array.isArray(VISUAL_EFFECT_CONFIGS)).toBeTruthy();
		expect(VISUAL_EFFECT_CONFIGS.length).toBeGreaterThan(0);
	});

	it('contains 5 effect configs', () => {
		expect(VISUAL_EFFECT_CONFIGS).toHaveLength(5);
	});

	it('has unique labels', () => {
		const labels = VISUAL_EFFECT_CONFIGS.map((c) => c.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('every config has label, isOn, onEnable, onDisable, fields', () => {
		for (const cfg of VISUAL_EFFECT_CONFIGS) {
			expectTypeOf(cfg.label).toBeString();
			expect(cfg.label.length).toBeGreaterThan(0);
			expectTypeOf(cfg.isOn).toBeFunction();
			expectTypeOf(cfg.onEnable).toBeFunction();
			expectTypeOf(cfg.onDisable).toBeFunction();
			expect(Array.isArray(cfg.fields)).toBeTruthy();
			expect(cfg.fields.length).toBeGreaterThan(0);
		}
	});

	it('every field has unique key within its config', () => {
		for (const cfg of VISUAL_EFFECT_CONFIGS) {
			const keys = cfg.fields.map((f) => f.key);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it('every field has a valid type', () => {
		const validTypes = new Set(['color', 'range', 'number', 'select', 'checkbox']);
		for (const cfg of VISUAL_EFFECT_CONFIGS) {
			for (const field of cfg.fields) {
				expect(validTypes.has(field.type)).toBeTruthy();
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Glow
// ---------------------------------------------------------------------------

describe('glow effect config', () => {
	const cfg = findConfig('Glow');

	it('isOn returns false for undefined style', () => {
		expect(cfg.isOn(undefined)).toBeFalsy();
	});

	it('isOn returns false when glowColor is transparent', () => {
		expect(cfg.isOn({ glowColor: 'transparent' } as ShapeStyle)).toBeFalsy();
	});

	it('isOn returns true when glowColor is set to a real color', () => {
		expect(cfg.isOn({ glowColor: '#ffff00' } as ShapeStyle)).toBeTruthy();
	});

	it('onEnable provides default glow values', () => {
		const result = cfg.onEnable(undefined);
		expect(result.glowColor).toBeDefined();
		expect(result.glowColor).not.toBe('transparent');
		expect(result.glowRadius).toBeGreaterThan(0);
	});

	it('onDisable sets glowColor to transparent', () => {
		const result = cfg.onDisable();
		expect(result.glowColor).toBe('transparent');
		expect(result.glowRadius).toBe(0);
	});

	it('glow color field reads default when style is undefined', () => {
		const colorField = cfg.fields.find((f) => f.key === 'gc')!;
		expect(colorField.read(undefined)).toBe('#ffff00');
	});

	it('glow radius field writes clamped value', () => {
		const radiusField = cfg.fields.find((f) => f.key === 'gr')!;
		const result = radiusField.write(50);
		expect(result).toStrictEqual({ glowRadius: 50 });
	});

	it('glow radius field clamps above max', () => {
		const radiusField = cfg.fields.find((f) => f.key === 'gr')!;
		const result = radiusField.write(200);
		expect(result).toStrictEqual({ glowRadius: 96 });
	});

	it('glow opacity field reads percentage', () => {
		const opacityField = cfg.fields.find((f) => f.key === 'go')!;
		expect(opacityField.read({ glowOpacity: 0.5 } as ShapeStyle)).toBe(50);
	});
});

// ---------------------------------------------------------------------------
// Soft Edge
// ---------------------------------------------------------------------------

describe('soft Edge effect config', () => {
	const cfg = findConfig('Soft Edge');

	it('isOn returns false when softEdgeRadius is 0', () => {
		expect(cfg.isOn({ softEdgeRadius: 0 } as ShapeStyle)).toBeFalsy();
	});

	it('isOn returns true when softEdgeRadius > 0', () => {
		expect(cfg.isOn({ softEdgeRadius: 6 } as ShapeStyle)).toBeTruthy();
	});

	it('onEnable sets softEdgeRadius to 6', () => {
		expect(cfg.onEnable(undefined)).toStrictEqual({ softEdgeRadius: 6 });
	});

	it('onDisable sets softEdgeRadius to 0', () => {
		expect(cfg.onDisable()).toStrictEqual({ softEdgeRadius: 0 });
	});

	it('radius field clamps above max', () => {
		const field = cfg.fields.find((f) => f.key === 'se')!;
		expect(field.write(200)).toStrictEqual({ softEdgeRadius: 96 });
	});
});

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------

describe('reflection effect config', () => {
	const cfg = findConfig('Reflection');

	it('isOn returns false for undefined style', () => {
		expect(cfg.isOn(undefined)).toBeFalsy();
	});

	it('isOn returns true when reflectionBlurRadius > 0', () => {
		expect(cfg.isOn({ reflectionBlurRadius: 3 } as ShapeStyle)).toBeTruthy();
	});

	it('isOn returns true when reflectionStartOpacity > 0', () => {
		expect(cfg.isOn({ reflectionStartOpacity: 50 } as ShapeStyle)).toBeTruthy();
	});

	it('onEnable provides default reflection values', () => {
		const result = cfg.onEnable(undefined);
		expect(result.reflectionBlurRadius).toBe(3);
		expect(result.reflectionStartOpacity).toBe(50);
	});

	it('onDisable zeroes all reflection properties', () => {
		const result = cfg.onDisable();
		expect(result.reflectionBlurRadius).toBe(0);
		expect(result.reflectionStartOpacity).toBe(0);
		expect(result.reflectionEndOpacity).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Blur
// ---------------------------------------------------------------------------

describe('blur effect config', () => {
	const cfg = findConfig('Blur');

	it('isOn returns false for undefined style', () => {
		expect(cfg.isOn(undefined)).toBeFalsy();
	});

	it('isOn returns false when blurRadius is 0', () => {
		expect(cfg.isOn({ blurRadius: 0 } as ShapeStyle)).toBeFalsy();
	});

	it('isOn returns true when blurRadius > 0', () => {
		expect(cfg.isOn({ blurRadius: 4 } as ShapeStyle)).toBeTruthy();
	});

	it('onEnable sets blurRadius to 4', () => {
		expect(cfg.onEnable(undefined)).toStrictEqual({ blurRadius: 4 });
	});

	it('onDisable sets blurRadius to 0', () => {
		expect(cfg.onDisable()).toStrictEqual({ blurRadius: 0 });
	});

	it('blur field clamps above max', () => {
		const field = cfg.fields.find((f) => f.key === 'bl')!;
		expect(field.write(100)).toStrictEqual({ blurRadius: 50 });
	});
});

// ---------------------------------------------------------------------------
// Bevel / 3D
// ---------------------------------------------------------------------------

describe('bevel / 3D effect config', () => {
	const cfg = findConfig('Bevel / 3D');

	it('isOn returns false for undefined style', () => {
		expect(cfg.isOn(undefined)).toBeFalsy();
	});

	it('isOn returns false when bevelTopType is none', () => {
		expect(cfg.isOn({ shape3d: { bevelTopType: 'none' } } as ShapeStyle)).toBeFalsy();
	});

	it('isOn returns true when bevelTopType is circle', () => {
		expect(cfg.isOn({ shape3d: { bevelTopType: 'circle' } } as ShapeStyle)).toBeTruthy();
	});

	it('onEnable provides default bevel values', () => {
		const result = cfg.onEnable(undefined);
		expect(result.shape3d).toBeDefined();
		expect(result.shape3d?.bevelTopType).toBe('circle');
		expect(result.shape3d?.bevelTopWidth).toBe(76200);
		expect(result.shape3d?.bevelTopHeight).toBe(76200);
	});

	it('onDisable clears bevel values', () => {
		const result = cfg.onDisable({ shape3d: { bevelTopType: 'circle' } } as ShapeStyle);
		expect(result.shape3d?.bevelTopType).toBeUndefined();
	});

	it('bevel width field clamps above max', () => {
		const field = cfg.fields.find((f) => f.key === 'bw')!;
		const result = field.write(999999);
		// write returns a function or partial
		if (typeof result === 'function') {
			const partial = result(undefined);
			expect(partial.shape3d?.bevelTopWidth).toBe(500000);
		} else {
			expect(result.shape3d?.bevelTopWidth).toBe(500000);
		}
	});
});
