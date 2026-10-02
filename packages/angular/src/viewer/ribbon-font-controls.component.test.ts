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
	it('gates the picker and the strip on an editable text selection', () => {
		expect(ribbonSource).toContain('<pptx-ui-ribbon-home-font-picker');
		expect(ribbonSource).toContain('<pptx-ui-ribbon-home-font ');
		expect(ribbonSource).toContain('return this.canEdit() && this.isText();');
		expect(ribbonSource).toContain('enabled: this.enabled()');
	});

	it.each(['ribbon-home-section.component.ts', 'ribbon-content.component.ts'])(
		'passes read-only eligibility through %s',
		(file) => {
			const source = componentSource(import.meta.dirname, file);
			const control = source.match(/<pptx-ribbon-font-controls[^>]*>/u)?.[0];
			expect(control).toContain('[canEdit]="canEdit()"');
		},
	);

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
		expect(ribbonSource).toContain('this.patchFontSize(textFontSizePtToPx(Number(value)))');
		expect(ribbonSource).toContain('this.patchFontSize(textFontSizePtToPx(steppedFontSizePt(');
		expect(ribbonSource).toContain('textFontSizePatch(element, fontSize)');
		expect(inspectorSource).toContain('fontSize: fontSizeOf(cur)');
		expect(inspectorSource).toContain('textFontSizePatch(cur, textFontSizePtToPx(val))');
	});

	it('keeps authored fractional point sizes visible and editable', () => {
		// The shared select retains an authored value that is not one of the presets.
		expect(ribbonSource).toContain('fontSize: this.curFontSize()');
		expect(inspectorSource).toContain('inputmode="decimal"');
		expect(inspectorSource).toContain('step="any"');
		expect(steppedFontSizePt(48.1, 1)).toBe(54);
		expect(steppedFontSizePt(48.1, -1)).toBe(48);
	});
});

describe('ribbonFontControlsComponent shared colour, spacing and case intents', () => {
	it('feeds the theme grid and recents, and shows no theme grid for highlight', () => {
		expect(ribbonSource).toContain('themeColors: this.loader?.themeColorMap()');
		expect(ribbonSource).toContain('ref: this.curColorRef()');
		expect(ribbonSource).toContain('recent: this.recentColors?.recent()');
		expect(ribbonSource).toContain('highlight: { value: this.curHighlight()');
	});

	it('a colour intent commits both the hex and the ref and records the colour as recent', () => {
		expect(ribbonSource).toContain('this.patch({ color: String(value), colorRef: ref });');
		expect(ribbonSource).toContain('this.patch({ highlightColor: String(value) });');
		expect(ribbonSource).toContain('this.recentColors?.push(String(value));');
	});

	it('routes character spacing and change case intents', () => {
		expect(ribbonSource).toContain('this.patch({ characterSpacing: Number(value) });');
		expect(ribbonSource).toContain('this.changeCase(value as ChangeCaseMode);');
	});

	it('re-derives its state when the language changes', () => {
		expect(ribbonSource).toContain('homeTranslator(this.translation, this.language');
	});
});
