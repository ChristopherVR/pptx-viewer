import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	PRESET_TO_OOXML,
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
	timingCurveToAccelDecel,
	OOXML_TO_PRESET_ENTR,
	OOXML_TO_PRESET_EXIT,
	OOXML_TO_PRESET_EMPH,
	ooxmlToPresetName,
} from './animation-write-mappings';

// ---------------------------------------------------------------------------
// PRESET_TO_OOXML
// ---------------------------------------------------------------------------
describe('pRESET_TO_OOXML', () => {
	// ---- Entrance effects ----
	describe('entrance effects', () => {
		it('should map "appear" to entr, presetId 1', () => {
			expect(PRESET_TO_OOXML['appear']).toStrictEqual({
				presetClass: 'entr',
				presetId: 1,
				defaultSubtype: 0,
			});
		});

		it('should map "fadeIn" to entr, presetId 10', () => {
			expect(PRESET_TO_OOXML['fadeIn']).toStrictEqual({
				presetClass: 'entr',
				presetId: 10,
				defaultSubtype: 0,
			});
		});

		it('should map "flyIn" to entr, presetId 2 with defaultSubtype 4', () => {
			expect(PRESET_TO_OOXML['flyIn']).toStrictEqual({
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
			expect(PRESET_TO_OOXML['wheelIn']).toStrictEqual({
				presetClass: 'entr',
				presetId: 21,
				defaultSubtype: 1,
			});
		});

		it('should map "splitIn" to entr, presetId 17 (spec: entr.17 = Split)', () => {
			expect(PRESET_TO_OOXML['splitIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['splitIn'].presetId).toBe(17);
		});

		it('should map "randomBarsIn" to entr, presetId 14 (spec: entr.14 = Random Bars)', () => {
			expect(PRESET_TO_OOXML['randomBarsIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['randomBarsIn'].presetId).toBe(14);
		});

		it('should map "expandIn" to entr, presetId 31 (spec: entr.31 = Expand)', () => {
			expect(PRESET_TO_OOXML['expandIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['expandIn'].presetId).toBe(31);
		});

		it('should map "circleIn" to entr, presetId 6 (spec: entr.6 = Circle)', () => {
			expect(PRESET_TO_OOXML['circleIn'].presetClass).toBe('entr');
			expect(PRESET_TO_OOXML['circleIn'].presetId).toBe(6);
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
			expect(PRESET_TO_OOXML['disappear']).toStrictEqual({
				presetClass: 'exit',
				presetId: 1,
				defaultSubtype: 0,
			});
		});

		it('should map "fadeOut" to exit, presetId 10', () => {
			expect(PRESET_TO_OOXML['fadeOut']).toStrictEqual({
				presetClass: 'exit',
				presetId: 10,
				defaultSubtype: 0,
			});
		});

		it('should map "flyOut" to exit, presetId 2 with defaultSubtype 4', () => {
			expect(PRESET_TO_OOXML['flyOut']).toStrictEqual({
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
			expect(PRESET_TO_OOXML['spin']).toStrictEqual({
				presetClass: 'emph',
				presetId: 8,
				defaultSubtype: 0,
			});
		});

		it('should map "pulse" to emph, presetId 26', () => {
			expect(PRESET_TO_OOXML['pulse']).toStrictEqual({
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
				).toBeTruthy();
			}
		});

		it('should have all entries with positive integer presetIds', () => {
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					Number.isInteger(mapping.presetId) && mapping.presetId > 0,
					`${key} has invalid presetId: ${mapping.presetId}`,
				).toBeTruthy();
			}
		});

		it('should have all entries with defaultSubtype as a number', () => {
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					typeof mapping.defaultSubtype === 'number',
					`${key} has invalid defaultSubtype: ${mapping.defaultSubtype}`,
				).toBeTruthy();
			}
		});

		it('should have defaultSubtype as non-negative integer for all entries', () => {
			for (const [key, mapping] of Object.entries(PRESET_TO_OOXML)) {
				expect(
					Number.isInteger(mapping.defaultSubtype) && mapping.defaultSubtype >= 0,
					`${key} has invalid defaultSubtype: ${mapping.defaultSubtype}`,
				).toBeTruthy();
			}
		});

		it('should contain entrance effects', () => {
			const entranceEffects = Object.values(PRESET_TO_OOXML).filter(
				(m) => m.presetClass === 'entr',
			);
			expect(entranceEffects.length).toBeGreaterThan(0);
		});

		it('should contain exit effects', () => {
			const exitEffects = Object.values(PRESET_TO_OOXML).filter((m) => m.presetClass === 'exit');
			expect(exitEffects.length).toBeGreaterThan(0);
		});

		it('should contain emphasis effects', () => {
			const emphEffects = Object.values(PRESET_TO_OOXML).filter((m) => m.presetClass === 'emph');
			expect(emphEffects.length).toBeGreaterThan(0);
		});

		it('should expand the catalog at least 4× over the prior 37 entries', () => {
			expect(Object.keys(PRESET_TO_OOXML).length).toBeGreaterThanOrEqual(37 * 4);
		});

		it('should cover the full PowerPoint preset library (>=60 per class)', () => {
			const entr = Object.values(PRESET_TO_OOXML).filter((m) => m.presetClass === 'entr');
			const exit = Object.values(PRESET_TO_OOXML).filter((m) => m.presetClass === 'exit');
			const emph = Object.values(PRESET_TO_OOXML).filter((m) => m.presetClass === 'emph');
			expect(entr.length).toBeGreaterThanOrEqual(60);
			expect(exit.length).toBeGreaterThanOrEqual(60);
			expect(emph.length).toBeGreaterThanOrEqual(60);
		});
	});
});

// ---------------------------------------------------------------------------
// Reverse lookup (parse -> typed name)
// ---------------------------------------------------------------------------
describe('oOXML_TO_PRESET reverse lookups', () => {
	it('oOXML_TO_PRESET_ENTR maps id 1 back to "appear"', () => {
		expect(OOXML_TO_PRESET_ENTR[1]).toBe('appear');
	});

	it('oOXML_TO_PRESET_ENTR maps id 10 back to "fadeIn"', () => {
		expect(OOXML_TO_PRESET_ENTR[10]).toBe('fadeIn');
	});

	it('oOXML_TO_PRESET_ENTR maps id 17 back to "splitIn" (spec: entr.17 = Split)', () => {
		expect(OOXML_TO_PRESET_ENTR[17]).toBe('splitIn');
	});

	it('oOXML_TO_PRESET_ENTR maps id 14 back to "randomBarsIn" (spec: entr.14 = Random Bars)', () => {
		expect(OOXML_TO_PRESET_ENTR[14]).toBe('randomBarsIn');
	});

	it('oOXML_TO_PRESET_ENTR maps id 31 back to "expandIn" and id 6 back to "circleIn"', () => {
		expect(OOXML_TO_PRESET_ENTR[31]).toBe('expandIn');
		expect(OOXML_TO_PRESET_ENTR[6]).toBe('circleIn');
	});

	// Issue #99 / #81 regression: the catalog labels entr.17 = Split, and the
	// writer + reverse lookup must agree so an imported Split entrance is not
	// re-emitted (or rendered) as Random Bars. Round-trip the whole chain:
	// catalog id 17 -> Split -> writer splitIn -> id 17 -> reverse -> splitIn.
	it('round-trips entr.17 Split through writer + reverse without swapping to Random Bars', () => {
		const split = PRESET_TO_OOXML['splitIn'];
		expect(split.presetClass).toBe('entr');
		expect(split.presetId).toBe(17);
		const recovered = ooxmlToPresetName({ presetClass: 'entr', presetId: split.presetId });
		expect(recovered).toBe('splitIn');
		expect(recovered).not.toBe('randomBarsIn');
	});

	it('oOXML_TO_PRESET_EXIT maps id 1 back to "disappear"', () => {
		expect(OOXML_TO_PRESET_EXIT[1]).toBe('disappear');
	});

	it('oOXML_TO_PRESET_EMPH disambiguates aliased ids to canonical names', () => {
		// id 1 has aliases boldFlash + flash; canonical is boldFlash.
		expect(OOXML_TO_PRESET_EMPH[1]).toBe('boldFlash');
		// id 2 has aliases wave + colorWave; canonical is colorWave.
		expect(OOXML_TO_PRESET_EMPH[2]).toBe('colorWave');
		// id 26 has aliases pulse + bounce; canonical is pulse.
		expect(OOXML_TO_PRESET_EMPH[26]).toBe('pulse');
	});

	it('ooxmlToPresetName resolves all four classes', () => {
		expect(ooxmlToPresetName({ presetClass: 'entr', presetId: 1 })).toBe('appear');
		expect(ooxmlToPresetName({ presetClass: 'exit', presetId: 1 })).toBe('disappear');
		expect(ooxmlToPresetName({ presetClass: 'emph', presetId: 8 })).toBe('spin');
		// path class always returns undefined — the integer ID is informational.
		expect(ooxmlToPresetName({ presetClass: 'path', presetId: 1 })).toBeUndefined();
	});

	it('ooxmlToPresetName returns undefined for unknown presetIds', () => {
		expect(ooxmlToPresetName({ presetClass: 'entr', presetId: 9999 })).toBeUndefined();
	});
});

describe('preset name round-trip via PRESET_TO_OOXML + ooxmlToPresetName', () => {
	// For every typed name in PRESET_TO_OOXML, parsing the (presetClass, presetId)
	// back through the reverse lookup must yield SOME canonical name in
	// PRESET_TO_OOXML that re-emits the same numeric (presetClass, presetId)
	// pair. Aliased ids resolve to their canonical sibling, but the resulting
	// pair must match the original.
	it('round-trip preserves (presetClass, presetId) for every typed mapping', () => {
		for (const [name, mapping] of Object.entries(PRESET_TO_OOXML)) {
			const recovered = ooxmlToPresetName({
				presetClass: mapping.presetClass,
				presetId: mapping.presetId,
			});
			expect(recovered, `${name} -> reverse should not be undefined`).toBeDefined();
			const reverseMapping = PRESET_TO_OOXML[recovered!];
			expect(reverseMapping, `recovered name ${recovered} should exist`).toBeDefined();
			expect(reverseMapping.presetClass).toBe(mapping.presetClass);
			expect(reverseMapping.presetId).toBe(mapping.presetId);
		}
	});
});

// ---------------------------------------------------------------------------
// DIRECTION_TO_SUBTYPE
// ---------------------------------------------------------------------------
describe('dIRECTION_TO_SUBTYPE', () => {
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
			).toBeTruthy();
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
		expect(timingCurveToAccelDecel('ease-in')).toStrictEqual({
			accel: 100000,
			decel: 0,
		});
	});

	it('should return accel=0, decel=100000 for "ease-out"', () => {
		expect(timingCurveToAccelDecel('ease-out')).toStrictEqual({
			accel: 0,
			decel: 100000,
		});
	});

	it('should return accel=50000, decel=50000 for "ease"', () => {
		expect(timingCurveToAccelDecel('ease')).toStrictEqual({
			accel: 50000,
			decel: 50000,
		});
	});

	it('should return accel=0, decel=0 for "linear"', () => {
		expect(timingCurveToAccelDecel('linear')).toStrictEqual({
			accel: 0,
			decel: 0,
		});
	});

	it('should return accel=0, decel=0 for undefined', () => {
		expect(timingCurveToAccelDecel(undefined)).toStrictEqual({
			accel: 0,
			decel: 0,
		});
	});

	it('should default to accel=0, decel=0 for unknown curve', () => {
		expect(timingCurveToAccelDecel('cubic-bezier')).toStrictEqual({
			accel: 0,
			decel: 0,
		});
	});

	it('should return numeric values for all known curves', () => {
		for (const curve of ['ease-in', 'ease-out', 'ease', 'linear']) {
			const result = timingCurveToAccelDecel(curve);
			expectTypeOf(result.accel).toBeNumber();
			expectTypeOf(result.decel).toBeNumber();
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
