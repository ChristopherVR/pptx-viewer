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
import { componentSource } from './component-source.test-support';
import { FONT_SIZES, steppedFontSizePt } from './ribbon-font-controls.component';

const ribbonSource = componentSource(import.meta.dirname, 'ribbon-font-controls.component.ts');
const inspectorSource = componentSource(import.meta.dirname, 'inspector-panel.component.ts');

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

describe('ordinary text font size units', () => {
	it('converts model pixels to points and point edits back to pixels in both controls', () => {
		expect(ribbonSource).toContain('textFontSizePxToPt(fontSize)');
		expect(ribbonSource).toContain(
			'this.patchFontSize(textFontSizePtToPx(Number((event.target as HTMLSelectElement).value)))',
		);
		expect(ribbonSource).toContain('this.patchFontSize(textFontSizePtToPx(steppedFontSizePt(');
		expect(ribbonSource).toContain('textFontSizePatch(element, fontSize)');
		expect(inspectorSource).toContain('fontSize: fontSizeOf(cur)');
		expect(inspectorSource).toContain('textFontSizePatch(cur, textFontSizePtToPx(val))');
	});

	it('keeps authored fractional point sizes visible and editable', () => {
		expect(ribbonSource).toContain('!fontSizes.includes(curFontSize())');
		expect(inspectorSource).toContain('inputmode="decimal"');
		expect(inspectorSource).toContain('step="any"');
		expect(steppedFontSizePt(48.1, 1)).toBe(54);
		expect(steppedFontSizePt(48.1, -1)).toBe(48);
	});
});

describe('ribbonFontControlsComponent theme font colour (W3-G2)', () => {
	it('shows the theme-colours grid on the font-colour popover only, not highlight', () => {
		expect(ribbonSource).toContain('[showThemeColors]="true"');
		expect(ribbonSource).toContain('[currentRef]="curColorRef()"');
		expect(ribbonSource).toContain('(pickThemeColor)="setColorRef($event)"');
	});

	it('a preset/recent/custom pick clears any stored ref; a theme pick commits both', () => {
		expect(ribbonSource).toContain('this.patch({ color, colorRef: undefined });');
		expect(ribbonSource).toContain('this.patch({ color: commit.hex, colorRef: commit.ref });');
	});

	it('the standard-colour presets now come from the shared Office catalogue', () => {
		expect(ribbonSource).toContain('OFFICE_COLOR_SWATCH_HEXES');
	});
});
