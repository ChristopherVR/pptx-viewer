import { describe, it, expect, expectTypeOf } from 'vitest';

import { SHADOW_EFFECT_CONFIGS } from './fill-stroke-effect-configs';

const VALID_FIELD_TYPES = new Set(['color', 'range', 'number', 'select', 'checkbox']);

describe('sHADOW_EFFECT_CONFIGS', () => {
	it('is a non-empty array', () => {
		expect(SHADOW_EFFECT_CONFIGS.length).toBeGreaterThan(0);
	});

	it('contains a Shadow config', () => {
		expect(SHADOW_EFFECT_CONFIGS.some((c) => c.label === 'Shadow')).toBeTruthy();
	});

	it('contains an Inner Shadow config', () => {
		expect(SHADOW_EFFECT_CONFIGS.some((c) => c.label === 'Inner Shadow')).toBeTruthy();
	});

	describe('each config has required structure', () => {
		for (const cfg of SHADOW_EFFECT_CONFIGS) {
			describe(`config: ${cfg.label}`, () => {
				it('has a non-empty label', () => {
					expect(cfg.label).toBeTruthy();
					expectTypeOf(cfg.label).toBeString();
				});

				it('isOn is a function', () => {
					expectTypeOf(cfg.isOn).toBeFunction();
				});

				it('onEnable is a function', () => {
					expectTypeOf(cfg.onEnable).toBeFunction();
				});

				it('onDisable is a function', () => {
					expectTypeOf(cfg.onDisable).toBeFunction();
				});

				it('isOn returns a boolean when called with undefined', () => {
					const result = cfg.isOn(undefined);
					expectTypeOf(result).toBeBoolean();
				});

				it('onEnable returns an object when called with undefined', () => {
					const result = cfg.onEnable(undefined);
					expectTypeOf(result).toBeObject();
					expect(result).not.toBeNull();
				});

				it('onDisable returns an object when called with undefined', () => {
					const result = cfg.onDisable(undefined);
					expectTypeOf(result).toBeObject();
					expect(result).not.toBeNull();
				});

				it('fields is a non-empty array', () => {
					expect(Array.isArray(cfg.fields)).toBeTruthy();
					expect(cfg.fields.length).toBeGreaterThan(0);
				});

				describe('fields', () => {
					for (const field of cfg.fields) {
						describe(`field: ${field.key} (${field.label})`, () => {
							it('has a non-empty key', () => {
								expect(field.key).toBeTruthy();
								expectTypeOf(field.key).toBeString();
							});

							it('has a non-empty label', () => {
								expect(field.label).toBeTruthy();
								expectTypeOf(field.label).toBeString();
							});

							it('has a valid type', () => {
								expect(VALID_FIELD_TYPES.has(field.type)).toBeTruthy();
							});

							it('read is a function', () => {
								expectTypeOf(field.read).toBeFunction();
							});

							it('write is a function', () => {
								expectTypeOf(field.write).toBeFunction();
							});

							it('read returns a value when called with undefined', () => {
								const result = field.read(undefined);
								expect(result).toBeDefined();
							});
						});
					}
				});

				it('has no duplicate field keys', () => {
					const keys = cfg.fields.map((f) => f.key);
					expect(new Set(keys).size).toBe(keys.length);
				});
			});
		}
	});

	// Shadow-specific field checks
	describe('shadow config fields', () => {
		const shadowCfg = SHADOW_EFFECT_CONFIGS.find((c) => c.label === 'Shadow')!;

		it('has a color field', () => {
			expect(shadowCfg.fields.some((f) => f.type === 'color')).toBeTruthy();
		});

		it('has a range field for opacity', () => {
			const opacityField = shadowCfg.fields.find((f) => f.key === 'so');
			expect(opacityField).toBeDefined();
			expect(opacityField!.type).toBe('range');
			expect(opacityField!.min).toBe(0);
			expect(opacityField!.max).toBe(100);
		});

		it('has a checkbox field for rotation', () => {
			const rotField = shadowCfg.fields.find((f) => f.key === 'sr');
			expect(rotField).toBeDefined();
			expect(rotField!.type).toBe('checkbox');
		});

		it('isOn returns false when style is undefined', () => {
			expect(shadowCfg.isOn(undefined)).toBeFalsy();
		});

		it('onDisable sets shadowColor to transparent', () => {
			const result = shadowCfg.onDisable(undefined);
			expect(result).toHaveProperty('shadowColor', 'transparent');
		});
	});

	// Inner Shadow-specific field checks
	describe('inner Shadow config fields', () => {
		const innerCfg = SHADOW_EFFECT_CONFIGS.find((c) => c.label === 'Inner Shadow')!;

		it('has a color field', () => {
			expect(innerCfg.fields.some((f) => f.type === 'color')).toBeTruthy();
		});

		it('isOn returns false when style is undefined', () => {
			expect(innerCfg.isOn(undefined)).toBeFalsy();
		});

		it('onDisable sets innerShadowColor to transparent', () => {
			const result = innerCfg.onDisable(undefined);
			expect(result).toHaveProperty('innerShadowColor', 'transparent');
		});

		it('onEnable sets default values for inner shadow', () => {
			const result = innerCfg.onEnable(undefined);
			expect(result).toHaveProperty('innerShadowColor');
			expect(result).toHaveProperty('innerShadowOpacity');
			expect(result).toHaveProperty('innerShadowBlur');
		});
	});
});
