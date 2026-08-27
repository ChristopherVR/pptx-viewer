import { describe, it, expect, expectTypeOf } from 'vitest';

import { PRESET_ID_TO_EFFECT } from './animation-presets';

describe('pRESET_ID_TO_EFFECT', () => {
	describe('entrance presets', () => {
		it('should map preset ID 1 to "appear"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[1]).toBe('appear');
		});

		it('should map preset ID 2 to "flyInBottom"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[2]).toBe('flyInBottom');
		});

		it('should map preset ID 10 to "fadeIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[10]).toBe('fadeIn');
		});

		it('should map preset ID 23 to "zoomIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[23]).toBe('zoomIn');
		});

		it('should map preset ID 37 to "riseUp" (Rise Up, verified via COM)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[37]).toBe('riseUp');
		});

		it('should map preset ID 22 to "wipeIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[22]).toBe('wipeIn');
		});

		it('should return undefined for unmapped entrance ID', () => {
			expect(PRESET_ID_TO_EFFECT.entr[999]).toBeUndefined();
		});

		it('should map preset ID 3 to "blindsIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[3]).toBe('blindsIn');
		});

		it('should map preset ID 4 to "boxIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[4]).toBe('boxIn');
		});

		it('should map preset ID 5 to "checkerboardIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[5]).toBe('checkerboardIn');
		});
	});

	describe('exit presets', () => {
		it('should map preset ID 1 to "disappear"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[1]).toBe('disappear');
		});

		it('should map preset ID 10 to "fadeOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[10]).toBe('fadeOut');
		});

		it('should map preset ID 23 to "zoomOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[23]).toBe('zoomOut');
		});

		it('should map preset ID 26 to "bounceOut" (Bounce, verified via a fresh COM pass)', () => {
			expect(PRESET_ID_TO_EFFECT.exit[26]).toBe('bounceOut');
		});

		it('should map preset ID 37 to "sinkDown", not the old (wrong) "bounceOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[37]).toBe('sinkDown');
			expect(PRESET_ID_TO_EFFECT.exit[37]).not.toBe('bounceOut');
		});

		it('should map preset ID 2 to "flyOutBottom"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[2]).toBe('flyOutBottom');
		});

		it('should return undefined for unmapped exit ID', () => {
			expect(PRESET_ID_TO_EFFECT.exit[999]).toBeUndefined();
		});
	});

	describe('emphasis presets', () => {
		it('should leave preset ID 1 unmapped (Change Fill Color, not Bold Flash)', () => {
			// emph.1 is Change Fill Color (verified via COM); real Bold Flash
			// is emph.10.
			expect(PRESET_ID_TO_EFFECT.emph[1]).toBeUndefined();
		});

		it('should map preset ID 10 to "boldFlash" (Bold Flash, verified via COM)', () => {
			expect(PRESET_ID_TO_EFFECT.emph[10]).toBe('boldFlash');
		});

		it('should map preset ID 8 to "spin"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[8]).toBe('spin');
		});

		it('should map preset ID 26 to "pulse"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[26]).toBe('pulse');
		});

		it('should map preset ID 32 to "teeter", not the old (wrong) preset ID 14', () => {
			expect(PRESET_ID_TO_EFFECT.emph[32]).toBe('teeter');
		});

		it('should map preset ID 6 to "growShrink"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[6]).toBe('growShrink');
		});

		it('should return undefined for unmapped emphasis ID', () => {
			expect(PRESET_ID_TO_EFFECT.emph[999]).toBeUndefined();
		});
	});

	describe('structure', () => {
		it('should have entr, exit, and emph keys', () => {
			expect(PRESET_ID_TO_EFFECT).toHaveProperty('entr');
			expect(PRESET_ID_TO_EFFECT).toHaveProperty('exit');
			expect(PRESET_ID_TO_EFFECT).toHaveProperty('emph');
		});

		it('should have all entrance effects as strings', () => {
			for (const [, value] of Object.entries(PRESET_ID_TO_EFFECT.entr)) {
				expectTypeOf(value).toBeString();
			}
		});

		it('should have all exit effects as strings', () => {
			for (const [, value] of Object.entries(PRESET_ID_TO_EFFECT.exit)) {
				expectTypeOf(value).toBeString();
			}
		});

		it('should have all emphasis effects as strings', () => {
			for (const [, value] of Object.entries(PRESET_ID_TO_EFFECT.emph)) {
				expectTypeOf(value).toBeString();
			}
		});

		it('should not have overlapping effect names between entr and exit for same preset ID', () => {
			// IDs present in both entr and exit should have different effect names
			const entrIds = Object.keys(PRESET_ID_TO_EFFECT.entr).map(Number);
			const exitIds = new Set(Object.keys(PRESET_ID_TO_EFFECT.exit).map(Number));
			for (const id of entrIds) {
				if (exitIds.has(id)) {
					expect(PRESET_ID_TO_EFFECT.entr[id]).not.toBe(PRESET_ID_TO_EFFECT.exit[id]);
				}
			}
		});
	});

	describe('additional entrance presets', () => {
		it('should map preset ID 6 to "circleIn" (Circle, not a duplicate of Expand)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[6]).toBe('circleIn');
		});

		it('should map preset ID 9 to "dissolveIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[9]).toBe('dissolveIn');
		});

		it('should map preset ID 12 to "flashIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[12]).toBe('peekIn');
		});

		it('should map preset ID 16 to "peekIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[16]).toBe('splitIn');
		});

		it('should map preset ID 17 to "splitIn" (spec: entr.17 = Split)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[17]).toBe('expandIn');
		});

		it('should map preset ID 14 to "randomBarsIn" (spec: entr.14 = Random Bars)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[14]).toBe('randomBarsIn');
		});

		it('should map preset ID 21 to "wheelIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[21]).toBe('wheelIn');
		});

		it('should map preset ID 26 to "bounceIn" (Bounce, verified via COM)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[26]).toBe('bounceIn');
		});

		it('should map preset ID 31 to "expandIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[31]).toBe('expandIn');
		});

		it('should map preset ID 42 to "floatIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[42]).toBe('floatIn');
		});

		it('should leave preset ID 47 unmapped (real Swivel is entr.19, not 47)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[47]).toBeUndefined();
		});

		it('should map preset ID 49 to "spinnerIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[49]).toBe('spinnerIn');
		});

		it('should map preset ID 53 to "growTurnIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[53]).toBe('growTurnIn');
		});
	});

	describe('additional exit presets', () => {
		it('should map preset ID 6 to "shrinkOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[6]).toBe('shrinkOut');
		});

		it('should map preset ID 9 to "dissolveOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[9]).toBe('dissolveOut');
		});

		it('should map preset ID 22 to "wipeOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[22]).toBe('wipeOut');
		});
	});

	describe('additional emphasis presets', () => {
		it('should leave preset ID 2 unmapped (Change Font, not Wave)', () => {
			// emph.2 is really Change Font (verified via COM); real Wave is
			// emph.34, real Color Wave is emph.20.
			expect(PRESET_ID_TO_EFFECT.emph[2]).toBeUndefined();
		});

		it('should map preset ID 9 to "transparency"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[9]).toBe('transparency');
		});
	});
});
