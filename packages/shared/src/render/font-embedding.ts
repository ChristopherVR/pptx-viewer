/**
 * font-embedding.ts: the one decision behind the File > Fonts "Embed fonts in
 * the file" toggle, shared by all five bindings.
 *
 * Every binding already stored an `embedFontsEnabled` boolean and rendered a
 * switch for it. None of them read it back: the flag reached no save call, so
 * the switch moved and the saved file was byte-identical either way. This
 * module makes the switch mean something, and - just as importantly - makes it
 * admit when it cannot.
 *
 * What the viewer CAN do:
 *   - Keep the fonts a deck already carries. `PptxHandler.save()` re-embeds
 *     `p:embeddedFontLst` and every `ppt/fonts/*.fntdata` part losslessly by
 *     default, reusing the original obfuscation key and rId.
 *   - Strip them, by passing `embeddedFontList: null`, which removes the list,
 *     the `/font` relationships and the binary parts.
 *
 * What it CANNOT do: add a font that is not already embedded. That needs the
 * font's binary, and a browser will not hand one over for an installed system
 * face (`local()` in `FontFace` gives a usable font object, not readable
 * bytes), nor is there any glyph subsetting here to honour
 * `saveSubsetFonts`. So on a deck with nothing embedded the toggle is reported
 * as non-interactive with a reason, rather than being left to imply an
 * embedding that will never happen.
 *
 * @module render/font-embedding
 */

/** i18n key explaining an inert toggle. */
export const FONT_EMBEDDING_UNAVAILABLE_KEY = 'pptx.fonts.embedUnavailable';

/** What the "Embed fonts in the file" toggle should look like and do. */
export interface FontEmbeddingDescriptor {
	/** Distinct typeface names the loaded deck currently embeds. */
	embeddedFamilies: string[];
	/**
	 * Whether the toggle accepts input. False when the deck embeds nothing,
	 * because turning it on could not produce an embedded font.
	 */
	interactive: boolean;
	/**
	 * The position the toggle must START in so that it describes the file that
	 * would be written right now. A deck that arrived with embedded fonts keeps
	 * them on save, so the switch has to read "on" from the outset; the previous
	 * hardcoded `false` said the opposite of what save actually did.
	 */
	initialEnabled: boolean;
	/** Present only when `interactive` is false. */
	disabledReasonKey?: string;
}

/**
 * Describe the toggle for a deck that embeds `embeddedFamilies`.
 *
 * @param embeddedFamilies - Typeface names from `p:embeddedFontLst`, i.e. the
 *   `family` of each entry in `PptxData.embeddedFonts`. Blank entries and
 *   case-insensitive duplicates (the same face arrives once per weight) are
 *   folded, because the toggle is about faces, not font-data parts.
 *
 * @example
 * ```ts
 * describeFontEmbedding([]).interactive; // false
 * describeFontEmbedding(['Aptos']).initialEnabled; // true
 * ```
 */
export function describeFontEmbedding(
	embeddedFamilies: readonly string[] | undefined,
): FontEmbeddingDescriptor {
	const seen = new Set<string>();
	const families: string[] = [];
	for (const raw of embeddedFamilies ?? []) {
		const family = raw?.trim();
		if (!family) {
			continue;
		}
		const key = family.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		families.push(family);
	}
	const hasAny = families.length > 0;
	return {
		embeddedFamilies: families,
		interactive: hasAny,
		initialEnabled: hasAny,
		...(hasAny ? {} : { disabledReasonKey: FONT_EMBEDDING_UNAVAILABLE_KEY }),
	};
}

/**
 * The `PptxHandlerSaveOptions` slice implied by the toggle's position.
 *
 * Spread into the options object a binding hands `PptxHandler.save()`:
 *
 * ```ts
 * handler.save(slides, { ...saveOptions, ...embeddedFontSaveOptions(embedFonts) });
 * ```
 *
 * `true` never names the font list, deliberately: core's default already
 * re-embeds whatever the deck arrived with, and naming `embeddedFonts`
 * explicitly would hand it a stale array captured before the last load.
 *
 * Both positions DO write `p:presentation/@embedTrueTypeFonts`. The attribute
 * is PowerPoint's own record of the toggle (it is what File > Options > Save
 * reads back), so a deck saved with the switch off must say `"0"` even though
 * the binary parts are what actually changed; leaving it at the loaded value
 * made PowerPoint report fonts as embedded in a file that no longer carried
 * any, and vice versa.
 *
 * @param embedFonts - The toggle's position.
 * @returns `{ embeddedFontList: null, embedTrueTypeFonts: false }` to strip,
 *   `{ embedTrueTypeFonts: true }` to keep.
 */
export function embeddedFontSaveOptions(embedFonts: boolean): {
	embeddedFontList?: null;
	embedTrueTypeFonts: boolean;
} {
	return embedFonts
		? { embedTrueTypeFonts: true }
		: { embeddedFontList: null, embedTrueTypeFonts: false };
}
