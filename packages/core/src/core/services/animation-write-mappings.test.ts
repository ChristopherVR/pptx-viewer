import { describe, it, expect } from 'vitest';
import {
	PRESET_TO_OOXML,
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
	timingCurveToAccelDecel,
} from './animation-write-mappings';
import type { OoxmlPresetMapping } from './animation-write-mappings';

// ---------------------------------------------------------------------------
// PRESET_TO_OOXML
// ---------------------------------------------------------------------------
describe('PRESET_TO_OOXML', () => {
	// ---- Entrance effects ----
	describe('entrance effects', () => {
		it('should map "appear" to entr, presetId 1', () => {
			expect(PRESET_TO_OOXML['appear']).toEqual({
				presetClass: 'entr',
				presetId: 1,
				defaultSubtype: 0,
			});
		});

		it('should map "fadeIn" to entr, presetId 10', () => {
			expect(PRESET_TO_OOXML['fadeIn']).toEqual({
				presetClass: 'entr',
				presetId: 10,
				defaultSubtype: 0,
			});
		});

		it('should map "flyIn" to entr, presetId 2 with defaultSubtype 4', () => {
			expect(PRESET_TO_OOXML['flyIn']).toEqual({
				presetClass: 'entr',
				presetId: 2,
				defaultSubtype: 4,
			});
		});

		it('should map "zoomIn" to entr, presetId 23', () => {
			expect(PRESET_TO_OOXML['zoomIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['zoomIn'].presetId).toBe(23);
		});

		it('should map "blindsIn" to entr, presetId 3', () => {
			expect(PRESET_TO_OOXML['blindsIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['blindsIn'].presetId).toBe(3);
		});

		it('should map "boxIn" to entr, presetId 4', () => {
			expect(PRESET_TO_OOXML['boxIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['boxIn'].presetId).toBe(4);
		});

		it('should map "dissolveIn" to entr, presetId 9', () => {
			expect(PRESET_TO_OOXML['dissolveIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['dissolveIn'].presetId).toBe(9);
		});

		it('should map "wipeIn" to entr, presetId 22', () => {
			expect(PRESET_TO_OOXML['wipeIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['wipeIn'].presetId).toBe(22);
		});

		it('should map "bounceIn" to entr, presetId 37', () => {
			expect(PRESET_TO_OOXML['bounceIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['bounceIn'].presetId).toBe(37);
		});

		it('should map "wheelIn" to entr, presetId 21, defaultSubtype 1', () => {
			expect(PRESET_TO_OOXML['wheelIn']).toEqual({
				presetClass: 'entr',
				presetId: 21,
				defaultSubtype: 1,
			});
		});

		it('should map "splitIn" to entr, presetId 31', () => {
			expect(PRESET_TO_OOXML['splitIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['splitIn'].presetId).toBe(31);
		});

		it('should map "floatIn" to entr, presetId 42', () => {
			expect(PRESET_TO_OOXML['floatIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['floatIn'].presetId).toBe(42);
		});

		it('should map "swivel" to entr, presetId 47', () => {
			expect(PRESET_TO_OOXML['swivel'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['swivel'].presetId).toBe(47);
		});
	});

	// ---- Exit effects ----
	describe('exit effects', () => {
		it('should map "disappear" to exit, presetId 1', () => {
			expect(PRESET_TO_OOXML['disappear']).toEqual({
				presetClass: 'exit',
				presetId: 1,
				defaultSubtype: 0,
			});
		});

		it('should map "fadeOut" to exit, presetId 10', () => {
			expect(PRESET_TO_OOXML['fadeOut']).toEqual({
				presetClass: 'exit',
				presetId: 10,
				defaultSubtype: 0,
			});
		});

		it('should map "flyOut" to exit, presetId 2 with defaultSubtype 4', () => {
			expect(PRESET_TO_OOXML['flyOut']).toEqual({
				presetClass: 'exit',
				presetId: 2,
				defaultSubtype: 4,
			});
		});

		it('should map "zoomOut" to exit, presetId 23', () => {
			expect(PRESET_TO_OOXML['zoomOut'].presetClass).toBe('exit');
			expect(PRESET_TO_OOXML['zoomOut'].presetId).toBe(23);
		});

		it('should map "shrinkOut" to exit, presetId 6', () => {
			expect(PRESET_TO_OOXML['shrinkOut'].presetClass).toBe('exit');
			expect(PRESET_TO_OOXML['shrinkOut'].presetId).toBe(6);
		});

		it('should map "dissolveOut" to exit, presetId 9', () => {
			expect(PRESET_TO_OOXML['dissolveOut'].presetClass).toBe('exit');
			expect(PRESET_TO_OOXML['dissolveOut'].presetId).toBe(9);
		});

		it('should map "wipeOut" to exit, presetId 22', () => {
			expect(PRESET_TO_OOXML['wipeOut'].presetClass).toBe('exit');
			expect(PRESET_TO_OOXML['wipeOut'].presetId).toBe(22);
		});

		it('should map "bounceOut" to exit, presetId 37', () => {
			expect(PRESET_TO_OOXML['bounceOut'].presetClass).toBe('exit');
			expect(PRESET_TO_OOXML['bounceOut'].presetId).toBe(37);
		});
	});

	// ---- Emphasis effects ----
	describe('emphasis effects', () => {
		it('should map "spin" to emph, presetId 8', () => {
			expect(PRESET_TO_OOXML['spin']).toEqual({
				presetClass: 'emph',
				presetId: 8,
				defaultSubtype: 0,
			});
		});

		it('should map "pulse" to emph, presetId 26', () => {
			expect(PRESET_TO_OOXML['pulse']).toEqual({
				presetClass: 'emph',
				presetId: 26,
				defaultSubtype: 0,
			});
		});

		it('should map "growShrink" to emph, presetId 6', () => {
			expect(PRESET_TO_OOXML['growShrink'].presetClass).toBe('emph');
			expect(PRESET_TO_OOXML['growShrink'].presetId).toBe(6);
		});

		it('should map "teeter" to emph, presetId 14', () => {
			expect(PRESET_TO_OOXML['teeter'].presetClass).toBe('emph');
			expect(PRESET_TO_OOXML['teeter'].presetId).toBe(14);
		});

		it('should map "transparency" to emph, presetId 9', () => {
			expect(PRESET_TO_OOXML['transparency'].presetClass).toBe('emph');
			expect(PRESET_TO_OOXML['transparency'].presetId).toBe(9);
		});

		it('should map "boldFlash" to emph, presetId 1', () => {
			expect(PRESET_TO_OOXML['boldFlash'].presetClass).toBe('emph');
			expect(PRESET_TO_OOXML['boldFlash'].presetId).toBe(1);
		});

		it('should map "wave" to emph, presetId 2', () => {
			expect(PRESET_TO_OOXML['wave'].presetClass).toBe('emph');
			expect(PRESET_TO_OOXML['wave'].presetId).toBe(2);
		});

		it('should map "bounce" to emph, presetId 26', () => {
			expect(PRESET_TO_OOXML['bounce'].presetClass).toBe('emph');
			expect(PRESET_TO_OOXML['bounce'].presetId).toBe(26);
		});
	});

	// ---- Structural invariants ----
	describe('structural invariants', () => {
		it('should have all entries with valid presetClass', () => {
			const validClasses = new Set(['entr', 'exit', 'emph', 'path']);
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					validClasses.has(mapping.presetClass),
					`${key} has invalid presetClass: ${mapping.presetClass}`,
				).toBe(true);
			}
		});

		it('should have all entries with positive integer presetIds', () => {
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					Number.isInteger(mapping.presetId) && mapping.presetId > 0,
					`${key} has invalid presetId: ${mapping.presetId}`,
				).toBe(true);
			}
		});

		it('should have all entries with defaultSubtype as a number', () => {
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					typeof mapping.defaultSubtype === 'number',
					`${key} has invalid defaultSubtype: ${mapping.defaultSubtype}`,
				).toBe(true);
			}
		});

		it('should have defaultSubtype as non-negative integer for all entries', () => {
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					Number.isInteger(mapping.defaultSubtype) && mapping.defaultSubtype >= 0,
					`${key} has invalid defaultSubtype: ${mapping.defaultSubtype}`,
				).toBe(true);
			}
		});

		it('should contain entrance effects', () => {
			const entranceEffects = Object.values(PRESET_TO_OOXML).filter(
				(m) => m.presetClass === 'entr',
			);
			expect(entranceEffects.length).toBeGreaterThan(0);
		});

		it('should contain exit effects', () => {
			const exitEffects = Object.values(PRESET_TO_OOXML).filter(
				(m) => m.presetClass === 'exit',
			);
			expect(exitEffects.length).toBeGreaterThan(0);
		});

		it('should contain emphasis effects', () => {
			const emphEffects = Object.values(PRESET_TO_OOXML).filter(
				(m) => m.presetClass === 'emph',
			);
			expect(emphEffects.length).toBeGreaterThan(0);
		});
	});
});

// ---------------------------------------------------------------------------
// DIRECTION_TO_SUBTYPE
// ---------------------------------------------------------------------------
describe('DIRECTION_TO_SUBTYPE', () => {
	it('should map "fromBottom" to 4', () => {
		expect(DIRECTION_TO_SUBTYPE['fromBottom']).toBe(4);
	});

	it('should map "fromLeft" to 8', () => {
		expect(DIRECTION_TO_SUBTYPE['fromLeft']).toBe(8);
	});

	it('should map "fromRight" to 2', () => {
		expect(DIRECTION_TO_SUBTYPE['fromRight']).toBe(2);
	});

	it('should map "fromTop" to 1', () => {
		expect(DIRECTION_TO_SUBTYPE['fromTop']).toBe(1);
	});

	it('should map "fromTopLeft" to 9', () => {
		expect(DIRECTION_TO_SUBTYPE['fromTopLeft']).toBe(9);
	});

	it('should map "fromTopRight" to 3', () => {
		expect(DIRECTION_TO_SUBTYPE['fromTopRight']).toBe(3);
	});

	it('should map "fromBottomLeft" to 12', () => {
		expect(DIRECTION_TO_SUBTYPE['fromBottomLeft']).toBe(12);
	});

	it('should map "fromBottomRight" to 6', () => {
		expect(DIRECTION_TO_SUBTYPE['fromBottomRight']).toBe(6);
	});

	it('should have all values as positive integers', () => {
		for (const [key, value] of Object.entries(DIRECTION_TO_SUBTYPE)) {
			expect(
				Number.isInteger(value) && value > 0,
				`${key} has invalid value: ${value}`,
			).toBe(true);
		}
	});

	it('should have no duplicate values', () => {
		const values = Object.values(DIRECTION_TO_SUBTYPE);
		const unique = new Set(values);
		expect(unique.size).toBe(values.length);
	});

	it('should contain exactly 8 direction mappings', () => {
		expect(Object.keys(DIRECTION_TO_SUBTYPE)).toHaveLength(8);
	});
});

// ---------------------------------------------------------------------------
// triggerToNodeType
// ---------------------------------------------------------------------------
describe('triggerToNodeType', () => {
	it('should map "onClick" to "clickEffect"', () => {
		expect(triggerToNodeType('onClick')).toBe('clickEffect');
	});

	it('should map "onShapeClick" to "clickEffect"', () => {
		expect(triggerToNodeType('onShapeClick')).toBe('clickEffect');
	});

	it('should map "onHover" to "mouseOver"', () => {
		expect(triggerToNodeType('onHover')).toBe('mouseOver');
	});

	it('should map "afterPrevious" to "afterEffect"', () => {
		expect(triggerToNodeType('afterPrevious')).toBe('afterEffect');
	});

	it('should map "withPrevious" to "withEffect"', () => {
		expect(triggerToNodeType('withPrevious')).toBe('withEffect');
	});

	it('should map "afterDelay" to "afterEffect"', () => {
		expect(triggerToNodeType('afterDelay')).toBe('afterEffect');
	});
});

// ---------------------------------------------------------------------------
// timingCurveToAccelDecel
// ---------------------------------------------------------------------------
describe('timingCurveToAccelDecel', () => {
	it('should return accel=100000, decel=0 for "ease-in"', () => {
		expect(timingCurveToAccelDecel('ease-in')).toEqual({
			accel: 100000,
			decel: 0,
		});
	});

	it('should return accel=0, decel=100000 for "ease-out"', () => {
		expect(timingCurveToAccelDecel('ease-out')).toEqual({
			accel: 0,
			decel: 100000,
		});
	});

	it('should return accel=50000, decel=50000 for "ease"', () => {
		expect(timingCurveToAccelDecel('ease')).toEqual({
			accel: 50000,
			decel: 50000,
		});
	});

	it('should return accel=0, decel=0 for "linear"', () => {
		expect(timingCurveToAccelDecel('linear')).toEqual({
			accel: 0,
			decel: 0,
		});
	});

	it('should return accel=0, decel=0 for undefined', () => {
		expect(timingCurveToAccelDecel(undefined)).toEqual({
			accel: 0,
			decel: 0,
		});
	});

	it('should default to accel=0, decel=0 for unknown curve', () => {
		expect(timingCurveToAccelDecel('cubic-bezier')).toEqual({
			accel: 0,
			decel: 0,
		});
	});

	it('should return numeric values for all known curves', () => {
		for (const curve of ['ease-in', 'ease-out', 'ease', 'linear']) {
			const result = timingCurveToAccelDecel(curve);
			expect(typeof result.accel).toBe('number');
			expect(typeof result.decel).toBe('number');
		}
	});

	it('should return non-negative values for all curves', () => {
		for (const curve of ['ease-in', 'ease-out', 'ease', 'linear', undefined]) {
			const result = timingCurveToAccelDecel(curve);
			expect(result.accel).toBeGreaterThanOrEqual(0);
			expect(result.decel).toBeGreaterThanOrEqual(0);
		}
	});
});
