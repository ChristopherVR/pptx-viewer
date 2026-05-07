import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	EMPHASIS_PRESETS,
	MOTION_PATH_PRESETS,
	ALL_ANIMATION_PRESETS,
	getAnimationPresetInfo,
	getPresetsByCategory,
	getNativeAnimationPresetMetadata,
} from './animation-preset-catalog';

describe('animation preset catalog', () => {
	// The catalog targets the full PowerPoint preset library; the prior catalog
	// shipped ~21 entrance / ~8 exit / ~7 emphasis / ~8 motion-path entries.
	// Each class should now be at least 4× larger to cover canonical PPT presets.

	it('has at least 60 entrance presets', () => {
		expect(ENTRANCE_PRESETS.length).toBeGreaterThanOrEqual(60);
		expect(ENTRANCE_PRESETS.every((p) => p.category === 'entrance')).toBeTruthy();
	});

	it('has at least 60 exit presets', () => {
		expect(EXIT_PRESETS.length).toBeGreaterThanOrEqual(60);
		expect(EXIT_PRESETS.every((p) => p.category === 'exit')).toBeTruthy();
	});

	it('has at least 60 emphasis presets', () => {
		expect(EMPHASIS_PRESETS.length).toBeGreaterThanOrEqual(60);
		expect(EMPHASIS_PRESETS.every((p) => p.category === 'emphasis')).toBeTruthy();
	});

	it('has at least 50 motion path presets', () => {
		expect(MOTION_PATH_PRESETS.length).toBeGreaterThanOrEqual(50);
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

describe('getNativeAnimationPresetMetadata', () => {
	it('resolves entrance presetId 1 to Appear', () => {
		const info = getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId: 1 });
		expect(info).toBeDefined();
		expect(info!.label).toBe('Appear');
		expect(info!.presetId).toBe('entr.1');
	});

	it('resolves entrance presetId 10 to Fade', () => {
		const info = getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId: 10 });
		expect(info).toBeDefined();
		expect(info!.label).toBe('Fade');
	});

	it('resolves exit presetId 10 to Fade (exit)', () => {
		const info = getNativeAnimationPresetMetadata({ presetClass: 'exit', presetId: 10 });
		expect(info).toBeDefined();
		expect(info!.label).toBe('Fade');
		expect(info!.category).toBe('exit');
	});

	it('resolves emphasis presetId 8 to Spin', () => {
		const info = getNativeAnimationPresetMetadata({ presetClass: 'emph', presetId: 8 });
		expect(info).toBeDefined();
		expect(info!.label).toBe('Spin');
	});

	it('returns undefined for unknown presetId', () => {
		expect(
			getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId: 9999 }),
		).toBeUndefined();
	});

	it('returns undefined for path-class lookup (uses string keys, not integers)', () => {
		expect(getNativeAnimationPresetMetadata({ presetClass: 'path', presetId: 1 })).toBeUndefined();
	});
});

describe('catalog round-trip integrity', () => {
	// Every entr/exit/emph entry encodes its OOXML id as `<class>.<id>` —
	// parsing the suffix and routing through getNativeAnimationPresetMetadata
	// must return the same entry, so editors that re-emit a parsed presetID
	// reliably see the typed name.
	it('round-trips every entrance preset via getNativeAnimationPresetMetadata', () => {
		for (const preset of ENTRANCE_PRESETS) {
			const idPart = preset.presetId.slice('entr.'.length);
			const id = Number.parseInt(idPart, 10);
			expect(Number.isNaN(id), `${preset.presetId} should have integer suffix`).toBeFalsy();
			const info = getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId: id });
			expect(info, `${preset.presetId} should be resolvable`).toBeDefined();
			expect(info!.presetId).toBe(preset.presetId);
		}
	});

	it('round-trips every exit preset via getNativeAnimationPresetMetadata', () => {
		for (const preset of EXIT_PRESETS) {
			const idPart = preset.presetId.slice('exit.'.length);
			const id = Number.parseInt(idPart, 10);
			expect(Number.isNaN(id)).toBeFalsy();
			const info = getNativeAnimationPresetMetadata({ presetClass: 'exit', presetId: id });
			expect(info, `${preset.presetId} should be resolvable`).toBeDefined();
			expect(info!.presetId).toBe(preset.presetId);
		}
	});

	it('round-trips every emphasis preset via getNativeAnimationPresetMetadata', () => {
		for (const preset of EMPHASIS_PRESETS) {
			const idPart = preset.presetId.slice('emph.'.length);
			const id = Number.parseInt(idPart, 10);
			expect(Number.isNaN(id)).toBeFalsy();
			const info = getNativeAnimationPresetMetadata({ presetClass: 'emph', presetId: id });
			expect(info, `${preset.presetId} should be resolvable`).toBeDefined();
			expect(info!.presetId).toBe(preset.presetId);
		}
	});

	it('catalog has at least 4× the previous total of typed presets', () => {
		// Pre-expansion: ~21 entrance + ~8 exit + ~7 emphasis = 36 typed presets.
		const totalTyped = ENTRANCE_PRESETS.length + EXIT_PRESETS.length + EMPHASIS_PRESETS.length;
		expect(totalTyped).toBeGreaterThanOrEqual(36 * 4);
	});
});
