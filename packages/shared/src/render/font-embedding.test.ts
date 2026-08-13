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
		expect(embeddedFontSaveOptions(false)).toStrictEqual({ embeddedFontList: null });
	});

	it('says nothing at all when the toggle is on, leaving core to re-embed', () => {
		expect(embeddedFontSaveOptions(true)).toStrictEqual({});
		expect('embeddedFontList' in embeddedFontSaveOptions(true)).toBeFalsy();
	});
});
