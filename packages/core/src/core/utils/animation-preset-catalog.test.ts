import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	EMPHASIS_PRESETS,
	MOTION_PATH_PRESETS,
	ALL_ANIMATION_PRESETS,
	getAnimationPresetInfo,
	getPresetsByCategory,
} from './animation-preset-catalog';

describe('animation preset catalog', () => {
	it('has entrance presets', () => {
		expect(ENTRANCE_PRESETS.length).toBeGreaterThan(10);
		expect(ENTRANCE_PRESETS.every((p) => p.category === 'entrance')).toBeTruthy();
	});

	it('has exit presets', () => {
		expect(EXIT_PRESETS.length).toBeGreaterThan(5);
		expect(EXIT_PRESETS.every((p) => p.category === 'exit')).toBeTruthy();
	});

	it('has emphasis presets', () => {
		expect(EMPHASIS_PRESETS.length).toBeGreaterThan(3);
		expect(EMPHASIS_PRESETS.every((p) => p.category === 'emphasis')).toBeTruthy();
	});

	it('has motion path presets', () => {
		expect(MOTION_PATH_PRESETS.length).toBeGreaterThan(3);
		expect(MOTION_PATH_PRESETS.every((p) => p.category === 'motionPath')).toBeTruthy();
	});

	it('aLL_ANIMATION_PRESETS is the union of all categories', () => {
		expect(ALL_ANIMATION_PRESETS).toHaveLength(
			ENTRANCE_PRESETS.length +
				EXIT_PRESETS.length +
				EMPHASIS_PRESETS.length +
				MOTION_PATH_PRESETS.length,
		);
	});

	it('all presets have required fields', () => {
		for (const preset of ALL_ANIMATION_PRESETS) {
			expect(preset.presetId).toBeTruthy();
			expect(preset.label).toBeTruthy();
			expect(preset.category).toBeTruthy();
			expectTypeOf(preset.defaultDurationMs).toBeNumber();
			expectTypeOf(preset.hasDirection).toBeBoolean();
			expectTypeOf(preset.hasTextBuild).toBeBoolean();
		}
	});

	it('no duplicate preset IDs', () => {
		const ids = ALL_ANIMATION_PRESETS.map((p) => p.presetId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('presets with hasDirection=true have directions array', () => {
		const withDirection = ALL_ANIMATION_PRESETS.filter((p) => p.hasDirection);
		for (const preset of withDirection) {
			expect(preset.directions).toBeDefined();
			expect(preset.directions!.length).toBeGreaterThan(0);
		}
	});

	it('presets with hasDirection=false have no directions', () => {
		const withoutDirection = ALL_ANIMATION_PRESETS.filter((p) => !p.hasDirection);
		for (const preset of withoutDirection) {
			expect(preset.directions).toBeUndefined();
		}
	});

	it('appear entrance has 0ms duration', () => {
		const appear = ENTRANCE_PRESETS.find((p) => p.label === 'Appear');
		expect(appear).toBeDefined();
		expect(appear!.defaultDurationMs).toBe(0);
	});

	it('disappear exit has 0ms duration', () => {
		const disappear = EXIT_PRESETS.find((p) => p.label === 'Disappear');
		expect(disappear).toBeDefined();
		expect(disappear!.defaultDurationMs).toBe(0);
	});
});

describe('getAnimationPresetInfo', () => {
	it('finds entrance preset by id', () => {
		const info = getAnimationPresetInfo('entr.1');
		expect(info).toBeDefined();
		expect(info!.label).toBe('Appear');
	});

	it('finds exit preset by id', () => {
		const info = getAnimationPresetInfo('exit.10');
		expect(info).toBeDefined();
		expect(info!.label).toBe('Fade');
	});

	it('returns undefined for unknown id', () => {
		expect(getAnimationPresetInfo('unknown.99')).toBeUndefined();
	});
});

describe('getPresetsByCategory', () => {
	it('returns entrance presets', () => {
		expect(getPresetsByCategory('entrance')).toBe(ENTRANCE_PRESETS);
	});

	it('returns exit presets', () => {
		expect(getPresetsByCategory('exit')).toBe(EXIT_PRESETS);
	});

	it('returns emphasis presets', () => {
		expect(getPresetsByCategory('emphasis')).toBe(EMPHASIS_PRESETS);
	});

	it('returns motion path presets', () => {
		expect(getPresetsByCategory('motionPath')).toBe(MOTION_PATH_PRESETS);
	});
});
