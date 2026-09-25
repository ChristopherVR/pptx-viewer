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

	// The 52 entrance/exit ids PowerPoint really has (COM: AddEffect for every
	// MsoAnimEffect, then a presetID-k deck read back through EffectType).
	const COM_ENTR_EXIT_IDS = [
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
		27, 28, 29, 30, 31, 34, 35, 37, 38, 39, 40, 41, 42, 43, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55,
		56, 58,
	];

	it('offers exactly the 52 COM-verified entrance presets', () => {
		expect(ENTRANCE_PRESETS.map((p) => p.presetId)).toStrictEqual(
			COM_ENTR_EXIT_IDS.map((id) => `entr.${id}`),
		);
		expect(ENTRANCE_PRESETS.every((p) => p.category === 'entrance')).toBeTruthy();
	});

	it('offers exactly the 52 COM-verified exit presets', () => {
		expect(EXIT_PRESETS.map((p) => p.presetId)).toStrictEqual(
			COM_ENTR_EXIT_IDS.map((id) => `exit.${id}`),
		);
		expect(EXIT_PRESETS.every((p) => p.category === 'exit')).toBeTruthy();
	});

	it('has at least 30 emphasis presets', () => {
		// Previously asserted >=60, based on ids 1-64 filled by sequentially
		// GUESSING a label per id with zero verification (Spin Slow/Fast,
		// Wobble, Jiggle, Heartbeat, Rainbow, Bob, etc. were never real
		// PowerPoint emphasis effects). A COM + UI-Automation ground-truth pass
		// enumerated the ENTIRE "Add Emphasis Effect" dialog (all 26 items
		// across its Basic/3D/Subtle/Moderate/Exciting groups) and found the
		// real catalogue tops out at id 41 (33 distinct ids); >=30 reflects
		// that verified reality. See `animation-emphasis-ground-truth.ts` in
		// `pptx-viewer-shared` for the raw evidence.
		expect(EMPHASIS_PRESETS.length).toBeGreaterThanOrEqual(30);
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

	it('labels ids 27+ by the preset PowerPoint really saves there (COM)', () => {
		const label = (presetId: string) => getAnimationPresetInfo(presetId)?.label;
		expect(label('entr.27')).toBe('Color Typewriter');
		expect(label('entr.28')).toBe('Credits');
		expect(label('entr.29')).toBe('Ease In');
		expect(label('entr.31')).toBe('Grow & Turn');
		expect(label('entr.34')).toBe('Light Speed');
		expect(label('entr.35')).toBe('Pinwheel');
		expect(label('entr.38')).toBe('Swish');
		expect(label('entr.39')).toBe('Thin Line');
		expect(label('entr.40')).toBe('Unfold');
		expect(label('entr.41')).toBe('Whip');
		expect(label('entr.42')).toBe('Ascend');
		expect(label('entr.43')).toBe('Center Revolve');
		expect(label('entr.45')).toBe('Faded Swivel');
		expect(label('entr.47')).toBe('Descend');
		expect(label('entr.48')).toBe('Sling');
		expect(label('entr.50')).toBe('Compress');
		expect(label('entr.51')).toBe('Zip');
		expect(label('entr.52')).toBe('Arc Up');
		expect(label('entr.53')).toBe('Faded Zoom');
		expect(label('entr.54')).toBe('Glide');
		expect(label('entr.55')).toBe('Expand');
		expect(label('entr.56')).toBe('Flip');
		expect(label('entr.58')).toBe('Fold');
		expect(label('exit.16')).toBe('Split');
		expect(label('exit.17')).toBe('Collapse');
		expect(label('exit.18')).toBe('Strips');
		expect(label('exit.19')).toBe('Swivel');
		expect(label('exit.55')).toBe('Contract');
		for (const id of [32, 33, 36, 44, 46, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68]) {
			expect(getAnimationPresetInfo(`entr.${id}`), `entr.${id}`).toBeUndefined();
			expect(getAnimationPresetInfo(`exit.${id}`), `exit.${id}`).toBeUndefined();
		}
	});
});
