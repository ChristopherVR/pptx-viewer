/**
 * The "Embed fonts in the file" toggle has to describe the file that will
 * actually be written. Two things went wrong before this module existed:
 *
 *  1. Every binding stored `embedFontsEnabled` and none of them read it, so the
 *     switch was inert. `embeddedFontSaveOptions` is the value the bindings now
 *     hand `PptxHandler.save()`, and the two branches must genuinely differ.
 *  2. The switch defaulted to OFF on a deck that already embeds fonts, which
 *     core preserves on save. Wiring OFF straight to "strip" would have turned a
 *     cosmetic bug into data loss, so `initialEnabled` has to follow the deck.
 */
import { describe, expect, it } from 'vitest';

import {
	describeFontEmbedding,
	embeddedFontSaveOptions,
	FONT_EMBEDDING_UNAVAILABLE_KEY,
} from './font-embedding';
import { DEFAULT_VIEWER_OPTIONS, VIEWER_OPTIONS_TABS } from './options';

describe('describeFontEmbedding', () => {
	it('reports a deck with no embedded fonts as a non-interactive toggle with a reason', () => {
		const descriptor = describeFontEmbedding([]);

		expect(descriptor.interactive).toBeFalsy();
		expect(descriptor.initialEnabled).toBeFalsy();
		expect(descriptor.disabledReasonKey).toBe(FONT_EMBEDDING_UNAVAILABLE_KEY);
		expect(descriptor.embeddedFamilies).toStrictEqual([]);
	});

	it('treats an absent list the same as an empty one', () => {
		expect(describeFontEmbedding(undefined).interactive).toBeFalsy();
	});

	it('starts ON for a deck that already embeds fonts, because save keeps them', () => {
		const descriptor = describeFontEmbedding(['Aptos', 'Bahnschrift']);

		expect(descriptor.interactive).toBeTruthy();
		expect(descriptor.initialEnabled).toBeTruthy();
		expect(descriptor.disabledReasonKey).toBeUndefined();
		expect(descriptor.embeddedFamilies).toStrictEqual(['Aptos', 'Bahnschrift']);
	});

	it('folds the per-weight duplicates and blanks that come out of p:embeddedFontLst', () => {
		// One typeface arrives once per variant (regular/bold/italic/boldItalic),
		// so the raw family list repeats; the toggle is about faces, not parts.
		const descriptor = describeFontEmbedding(['Aptos', 'aptos', '  Aptos  ', '', '   ', 'Calibri']);

		expect(descriptor.embeddedFamilies).toStrictEqual(['Aptos', 'Calibri']);
	});
});

describe('embeddedFontSaveOptions', () => {
	it('asks core to strip the embedded font list when the toggle is off', () => {
		// `null` is what removes p:embeddedFontLst, the /font relationships and
		// the .fntdata parts. Anything else (including `undefined`) preserves.
		expect(embeddedFontSaveOptions(false)).toStrictEqual({
			embeddedFontList: null,
			embedTrueTypeFonts: false,
		});
	});

	it('never names the font list when the toggle is on, leaving core to re-embed', () => {
		expect('embeddedFontList' in embeddedFontSaveOptions(true)).toBeFalsy();
	});

	it('writes p:presentation/@embedTrueTypeFonts to match the toggle in both positions', () => {
		// The attribute is PowerPoint's own record of the switch. Leaving it at
		// the loaded value produced a deck that said "1" with every .fntdata part
		// stripped (or "0" with them all kept), which is what File > Options >
		// Save then showed the user. `false` must be explicit: core writes "0" for
		// it and only preserves the loaded value for `undefined`.
		expect(embeddedFontSaveOptions(true).embedTrueTypeFonts).toBeTruthy();
		expect(embeddedFontSaveOptions(false).embedTrueTypeFonts).toBeFalsy();
		expect('embedTrueTypeFonts' in embeddedFontSaveOptions(false)).toBeTruthy();
	});
});

/**
 * One setting, one switch.
 *
 * File > Options > Save carried a second "Embed fonts in the file" toggle
 * (`ViewerSaveOptions.embedFonts`, plus an `embedAllFontCharacters` companion)
 * that nothing read. So the viewer showed the user two switches for one
 * setting, in two places, and the one that looked most like PowerPoint was the
 * one that did nothing. The options copy is gone; this keeps it gone.
 */
describe('font embedding has exactly one setting', () => {
	it('is absent from the File > Options model', () => {
		const save = DEFAULT_VIEWER_OPTIONS.save as unknown as Record<string, unknown>;
		expect(Object.keys(save)).not.toContain('embedFonts');
		expect(Object.keys(save)).not.toContain('embedAllFontCharacters');
	});

	it('is absent from every File > Options pane', () => {
		const keys = VIEWER_OPTIONS_TABS.flatMap((tab) =>
			tab.sections.flatMap((section) => section.controls.map((control) => control.key)),
		);
		// `enableCustomFontUpload` is a different setting (loading a local face for
		// rendering), so match embedding specifically.
		expect(keys.filter((key) => /^embed.*font|font.*embed/iu.test(key))).toStrictEqual([]);
	});

	it('leaves `embeddedFontSaveOptions` as the only thing a save reads it through', () => {
		expect(embeddedFontSaveOptions(true)).toStrictEqual({ embedTrueTypeFonts: true });
		expect(embeddedFontSaveOptions(false)).toStrictEqual({
			embeddedFontList: null,
			embedTrueTypeFonts: false,
		});
	});
});
