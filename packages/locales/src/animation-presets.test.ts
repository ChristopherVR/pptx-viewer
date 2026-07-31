/**
 * Animation preset names must be real, translated names in EVERY shipped
 * locale.
 *
 * `locales.test.ts` already proves the four dictionaries agree on their key
 * sets. This suite is the preset-specific half, and it exists because a preset
 * name is where a dictionary gap does the most damage: the demos' missing-key
 * handler (`keyToLabel`) turns an absent key into a plausible-looking guess
 * ("Entr1", "Path Loop Pretzel") rather than an error, so the gap ships as a
 * confidently wrong label instead of a failure.
 *
 * "Reachable by the UI" is all three vocabularies at once: the editor
 * `PptxAnimationPreset` tokens the ribbon galleries apply and timelines print,
 * the whole OOXML preset catalogue the Vue effect picker lists, and the
 * motion-path authoring catalogue.
 *
 * Relative imports (not the package specifiers) because this package has no
 * dependency on `pptx-viewer-shared`/`pptx-viewer-core`; it is a leaf that only
 * the demos consume, and `locales.test.ts` reaches into shared the same way.
 */
import { describe, expect, it } from 'vitest';

import { translationsDe, translationsEs, translationsFr } from '.';
import { ALL_ANIMATION_PRESETS } from '../../core/src/core/utils/animation-preset-catalog';
import { translationsEn } from '../../shared/src/i18n';
import {
	ANIMATION_PRESET_VALUES,
	animationCatalogPresetLabelKey,
	animationPresetLabelKey,
} from '../../shared/src/render/animation-preset-labels';
import {
	MOTION_PATH_PRESETS,
	motionPathPresetLabelKey,
} from '../../shared/src/render/motion-path-presets';

/** Every i18n key an animation preset can be rendered through. */
const PRESET_KEYS: readonly string[] = [
	...ANIMATION_PRESET_VALUES.map((preset) => animationPresetLabelKey(preset)),
	...ALL_ANIMATION_PRESETS.map((preset) => animationCatalogPresetLabelKey(preset.presetId)),
	...MOTION_PATH_PRESETS.map((preset) => motionPathPresetLabelKey(preset.id)),
];

const translated = { de: translationsDe, es: translationsEs, fr: translationsFr };

/**
 * Names that are legitimately spelled the same in English and the target
 * language. Anything else matching English means the entry was copied rather
 * than translated, which is the failure this suite is here to catch.
 */
const SHARED_SPELLINGS = new Set(['Plus', 'Zoom', 'Boomerang', 'Zigzag', 'Triangle']);

describe('animation preset names', () => {
	it('covers all three preset vocabularies without overlap', () => {
		// 39 editor presets + 266 OOXML catalogue presets + 26 motion paths.
		expect(PRESET_KEYS).toHaveLength(331);
		expect(new Set(PRESET_KEYS).size).toBe(331);
	});

	it('names every reachable preset in English', () => {
		const lookup = translationsEn as Record<string, string | undefined>;
		expect(PRESET_KEYS.filter((key) => !lookup[key])).toStrictEqual([]);
	});

	for (const [locale, dictionary] of Object.entries(translated)) {
		it(`${locale} names every reachable preset`, () => {
			const lookup = dictionary as Record<string, string | undefined>;
			expect(PRESET_KEYS.filter((key) => !lookup[key])).toStrictEqual([]);
		});

		it(`${locale} translates them rather than echoing English`, () => {
			const lookup = dictionary as Record<string, string | undefined>;
			const echoed = PRESET_KEYS.filter((key) => {
				const value = lookup[key];
				return value === translationsEn[key] && !SHARED_SPELLINGS.has(value ?? '');
			});
			expect(echoed).toStrictEqual([]);
		});
	}
});
