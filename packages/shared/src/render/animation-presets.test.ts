import { describe, it, expect, expectTypeOf } from 'vitest';

import { EMPH_FILTER_PRESETS, PRESET_ID_TO_EFFECT } from './animation-presets';

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
			// A fresh COM pass shows `msoAnimEffectBounce` with `Effect.Exit =
			// True` re-emits presetID 26 (the SAME id as its entrance form),
			// not 37 (see the sinkDown test below for the real exit.37).
			expect(PRESET_ID_TO_EFFECT.exit[26]).toBe('bounceOut');
		});

		it('should map preset ID 37 to "sinkDown", not the old (wrong) "bounceOut"', () => {
			// This table previously had exit[37] = 'bounceOut', which a fresh
			// COM pass shows is wrong: `msoAnimEffectRiseUp` with
			// `Effect.Exit = True` re-emits presetID 37 (matching its
			// entrance form, entr.37), not Bounce (real Bounce exit is
			// exit.26, see above). The two were swapped, mirroring the
			// already-fixed entr.26/37 mix-up.
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
			// emph.1 is Change Fill Color (verified via COM: it emits a
			// `p:animClr` node targeting fill); it must stay unmapped here so
			// the colour-animation dynamic-keyframe path renders it instead of
			// a wrong static "boldFlash" effect. Real Bold Flash is emph.10.
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
			// A fresh COM pass shows `msoAnimEffectTeeter` serializes as
			// emph.32, not 14 (real emph.14 is Blast, which has no dedicated
			// keyframe and is correctly left unmapped, see below).
			expect(PRESET_ID_TO_EFFECT.emph[32]).toBe('teeter');
			expect(PRESET_ID_TO_EFFECT.emph[14]).toBeUndefined();
		});

		it('should map preset ID 20 to "colorWave" and 34 to "wave" (verified via COM)', () => {
			// Both dedicated keyframes already existed (a hue-rotate pulse for
			// Color Wave, a vertical bob for Wave) but neither preset id was
			// ever wired up in this table, even though `animation-write-mappings.ts`
			// and the UI catalog already carried the COM-verified ids.
			expect(PRESET_ID_TO_EFFECT.emph[20]).toBe('colorWave');
			expect(PRESET_ID_TO_EFFECT.emph[34]).toBe('wave');
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

		it('should map preset ID 12 to "peekIn" (Peek In)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[12]).toBe('peekIn');
		});

		it('should map preset ID 16 to "splitIn" (Split)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[16]).toBe('splitIn');
		});

		it('should map preset ID 17 to "expandIn" (Stretch, closest existing keyframe)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[17]).toBe('expandIn');
		});

		it('should map preset ID 14 to "randomBarsIn" (spec: entr.14 = Random Bars)', () => {
			expect(PRESET_ID_TO_EFFECT.entr[14]).toBe('randomBarsIn');
		});

		it('should map preset ID 21 to "wheelIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[21]).toBe('wheelIn');
		});

		it('should map preset ID 19 to "swivel" (Swivel, verified via COM)', () => {
			// entr.19 was already COM-verified as Swivel in the authoring
			// reverse lookup and the UI catalog (see the entr.47 test below),
			// and the `swivel` keyframe already existed for its initial-style
			// resolution, but this id was never wired up in the playback
			// table itself.
			expect(PRESET_ID_TO_EFFECT.entr[19]).toBe('swivel');
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
			// entr.47 is really "Descend" per COM, not Swivel (real Swivel is
			// entr.19); no dedicated keyframe covers Descend, so it correctly
			// falls back to the neutral entrance animation.
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
			// emph.2 is really Change Font (a font-family swap, verified via
			// COM), not Wave (real Wave is emph.34) or Color Wave (real Color
			// Wave is emph.20). No dynamic keyframe covers a font-family swap,
			// so it correctly falls back to the neutral emphasis animation.
			expect(PRESET_ID_TO_EFFECT.emph[2]).toBeUndefined();
		});

		it('should map preset ID 9 to "transparency"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[9]).toBe('transparency');
		});

		it('should leave preset ID 7 unmapped (Change Line Color, not Blink)', () => {
			// emph.7 is Change Line Color; it must stay unmapped here so the
			// colour-animation (`p:animClr`) dynamic-keyframe path in
			// `animation-timeline-helpers.ts` renders it instead of a wrong
			// static "flash"/blink effect.
			expect(PRESET_ID_TO_EFFECT.emph[7]).toBeUndefined();
		});
	});

	describe('eMPH_FILTER_PRESETS', () => {
		it('no longer mislabels Change Font Color/Size/Style (3/4/5) as desaturate/darken/lighten', () => {
			// emph.3/4/5 are Change Font Color/Size/Style, not filter-based
			// colour effects; they must not appear in this table.
			expect(EMPH_FILTER_PRESETS[3]).toBeUndefined();
			expect(EMPH_FILTER_PRESETS[4]).toBeUndefined();
			expect(EMPH_FILTER_PRESETS[5]).toBeUndefined();
		});

		it('does not collide with statically-mapped emphasis preset ids', () => {
			for (const id of Object.keys(EMPH_FILTER_PRESETS).map(Number)) {
				expect(PRESET_ID_TO_EFFECT.emph[id]).toBeUndefined();
			}
		});
	});
});
