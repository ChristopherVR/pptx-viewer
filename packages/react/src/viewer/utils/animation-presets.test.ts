import { describe, it, expect } from 'vitest';
import { PRESET_ID_TO_EFFECT } from './animation-presets';

describe('PRESET_ID_TO_EFFECT', () => {
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

		it('should map preset ID 37 to "bounceIn"', () => {
			expect(PRESET_ID_TO_EFFECT.entr[37]).toBe('bounceIn');
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

		it('should map preset ID 37 to "bounceOut"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[37]).toBe('bounceOut');
		});

		it('should map preset ID 2 to "flyOutBottom"', () => {
			expect(PRESET_ID_TO_EFFECT.exit[2]).toBe('flyOutBottom');
		});

		it('should return undefined for unmapped exit ID', () => {
			expect(PRESET_ID_TO_EFFECT.exit[999]).toBeUndefined();
		});
	});

	describe('emphasis presets', () => {
		it('should map preset ID 1 to "boldFlash"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[1]).toBe('boldFlash');
		});

		it('should map preset ID 8 to "spin"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[8]).toBe('spin');
		});

		it('should map preset ID 26 to "pulse"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[26]).toBe('pulse');
		});

		it('should map preset ID 14 to "teeter"', () => {
			expect(PRESET_ID_TO_EFFECT.emph[14]).toBe('teeter');
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
				expect(typeof value).toBe('string');
			}
		});

		it('should have all exit effects as strings', () => {
			for (const [, value] of Object.entries(PRESET_ID_TO_EFFECT.exit)) {
				expect(typeof value).toBe('string');
			}
		});
	});
});
