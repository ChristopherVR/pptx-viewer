/**
 * RibbonFontControlsComponent's font-size ladder, Angular binding.
 *
 * Pins that the Home/Text tab's size dropdown + grow/shrink ladder is sourced
 * from shared's `COMMON_FONT_SIZES` (`pptx-viewer-shared`'s
 * `render/text-format-presets.ts`) rather than a locally hand-typed array
 * that had drifted (missing 48pt, 66/80 instead of shared's 60/72).
 */
import { describe, expect, it } from 'vitest';

import { COMMON_FONT_SIZES } from '../internal/shared';
import { FONT_SIZES } from './ribbon-font-controls.component';

describe('ribbonFontControlsComponent FONT_SIZES', () => {
	it('matches the shared font-size ladder exactly', () => {
		expect(FONT_SIZES).toStrictEqual(COMMON_FONT_SIZES);
	});

	it('includes 48pt and the shared 60/72 steps', () => {
		expect(FONT_SIZES).toContain(48);
		expect(FONT_SIZES).toContain(60);
		expect(FONT_SIZES).toContain(72);
		expect(FONT_SIZES).not.toContain(66);
		expect(FONT_SIZES).not.toContain(80);
	});
});
