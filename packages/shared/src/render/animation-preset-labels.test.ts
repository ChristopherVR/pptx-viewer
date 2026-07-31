/**
 * The point of this suite: prove that every animation preset the UI can reach
 * resolves to a real dictionary entry, so nothing falls through to
 * `keyToLabel`, which invents a plausible-looking wrong label instead of
 * failing loudly.
 *
 * "Reachable" means all three of:
 *  - every `PptxAnimationPreset` token (the ribbon galleries apply them and a
 *    loaded deck's parsed animations carry them into timeline rows);
 *  - every entry in core's OOXML preset catalogue (the Vue "Add animation >
 *    Effect" picker lists the entrance/emphasis/exit families verbatim);
 *  - every motion-path preset in the authoring catalogue.
 */
import { ALL_ANIMATION_PRESETS } from 'pptx-viewer-core';
import type { PptxAnimationPreset, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { keyToLabel, translationsEn } from '../i18n';
import {
	ANIMATION_PRESET_VALUES,
	animationCatalogPresetLabelKey,
	animationCatalogPresetSlug,
	animationEffectLabel,
	animationEffectLabelKey,
	animationPresetLabelKey,
	isAnimationCatalogPresetId,
} from './animation-preset-labels';
import { MOTION_PATH_PRESETS, motionPathPresetLabelKey } from './motion-path-presets';

const dictionary = translationsEn as Record<string, string | undefined>;

/** Resolve a key the way a host does: dictionary first, then the guessing fallback. */
function translate(key: string): string {
	return dictionary[key] ?? keyToLabel(key);
}

function anim(patch: Partial<PptxElementAnimation>): PptxElementAnimation {
	return { elementId: 'el-1', ...patch };
}

describe('animationCatalogPresetSlug', () => {
	it('folds a dotted catalogue id into one key segment', () => {
		expect(animationCatalogPresetSlug('entr.1')).toBe('entr1');
		expect(animationCatalogPresetSlug('path.line.upLeft')).toBe('pathLineUpLeft');
		expect(animationCatalogPresetSlug('path.custom')).toBe('pathCustom');
	});

	it('never collides across the whole catalogue', () => {
		const slugs = ALL_ANIMATION_PRESETS.map((preset) =>
			animationCatalogPresetSlug(preset.presetId),
		);
		expect(new Set(slugs).size).toBe(ALL_ANIMATION_PRESETS.length);
	});
});

describe('vocabulary discrimination', () => {
	it('tells a catalogue id from an editor preset by its dot', () => {
		expect(isAnimationCatalogPresetId('entr.1')).toBeTruthy();
		expect(isAnimationCatalogPresetId('fadeIn')).toBeFalsy();
	});

	it('routes each vocabulary to its own key namespace', () => {
		expect(animationEffectLabelKey(anim({ entrance: 'fadeIn' }))).toBe(
			'pptx.animation.preset.fadeIn',
		);
		expect(animationEffectLabelKey(anim({ emphasis: 'entr.1' as PptxAnimationPreset }))).toBe(
			'pptx.animation.catalogPreset.entr1',
		);
	});

	it('falls back to a named key for an entry with no preset', () => {
		expect(animationEffectLabelKey(anim({}))).toBe('pptx.animation.animation');
		expect(animationEffectLabelKey(anim({ entrance: 'none' }))).toBe('pptx.animation.animation');
		expect(animationEffectLabelKey(anim({ motionPath: 'M 0 0 L 1 1' }))).toBe(
			'pptx.animation.motionPath.label',
		);
	});
});

describe('animationEffectLabel', () => {
	it('names the effect rather than printing its wire token', () => {
		expect(animationEffectLabel(anim({ entrance: 'fadeIn' }), translate)).toBe('Fade In');
		expect(animationEffectLabel(anim({ exit: 'shrinkOut' }), translate)).toBe('Shrink Out');
	});

	it('calls a path-only entry a motion path, not "custom"', () => {
		expect(animationEffectLabel(anim({ motionPath: 'M 0 0 L 1 1' }), translate)).toBe(
			'Motion Path',
		);
	});

	it('falls back to the generic word only when there is nothing to name', () => {
		expect(animationEffectLabel(anim({}), translate)).toBe('Animation');
	});
});

describe('dictionary coverage', () => {
	it('names every editor preset token', () => {
		const unnamed = ANIMATION_PRESET_VALUES.filter(
			(preset) => dictionary[animationPresetLabelKey(preset)] === undefined,
		);
		expect(unnamed).toStrictEqual([]);
	});

	it('names every OOXML catalogue preset', () => {
		const unnamed = ALL_ANIMATION_PRESETS.filter(
			(preset) => dictionary[animationCatalogPresetLabelKey(preset.presetId)] === undefined,
		).map((preset) => preset.presetId);
		expect(unnamed).toStrictEqual([]);
	});

	it('names every motion-path preset', () => {
		const unnamed = MOTION_PATH_PRESETS.filter(
			(preset) => dictionary[motionPathPresetLabelKey(preset.id)] === undefined,
		).map((preset) => preset.id);
		expect(unnamed).toStrictEqual([]);
	});

	it('covers the catalogue with distinct, non-guessed English', () => {
		// A guessed label is what `keyToLabel` would produce from the key itself
		// ("Entr1"), so any preset whose rendered text equals that guess is
		// missing from the dictionary no matter what the lookup above says.
		const guessed = ALL_ANIMATION_PRESETS.filter((preset) => {
			const key = animationCatalogPresetLabelKey(preset.presetId);
			return translate(key) === keyToLabel(key);
		}).map((preset) => preset.presetId);
		expect(guessed).toStrictEqual([]);
	});
});
