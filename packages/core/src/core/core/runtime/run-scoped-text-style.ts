import type { TextStyle } from '../../types';

/**
 * `CT_TextFont` metadata keys (`@panose`/`@pitchFamily`/`@charset`) for each
 * of the four typeface slots. Stripped from the element-level style for the
 * same reason as `rtl` below: they describe ONE specific run's font node,
 * not a shape-wide default, so leaving them in the element style leaks a
 * value from whichever run last resolved it onto every other run.
 */
const FONT_METADATA_KEYS = [
	'latinFontPanose',
	'latinFontPitchFamily',
	'latinFontCharset',
	'eastAsiaFontPanose',
	'eastAsiaFontPitchFamily',
	'eastAsiaFontCharset',
	'complexScriptFontPanose',
	'complexScriptFontPitchFamily',
	'complexScriptFontCharset',
	'symbolFontPanose',
	'symbolFontPitchFamily',
	'symbolFontCharset',
] as const satisfies ReadonlyArray<keyof TextStyle>;

/**
 * Strip the paragraph-only and per-run-metadata members of an ELEMENT-level
 * `textStyle` before it is used as a run style.
 *
 * `rtl` is the one field that means two different things on the same model
 * slot. At element level it is the paragraph direction: it is parsed from
 * `a:pPr/@rtl` (`CT_TextParagraphProperties`), it is edited alongside `align` /
 * `paragraphIndent` in the shared text-advanced panel, and `resolveParagraphRtl`
 * reads it as the paragraph default that a run's own direction overrides. On a
 * RUN it is `<a:rtl val="..."/>`, a child element of
 * `CT_TextCharacterProperties`.
 *
 * The element style is spread into every run before serialisation, so leaving
 * `rtl` in it flattened the paragraph's single direction onto each of its runs:
 * an Arabic deck that authored 0 run-level `<a:rtl>` elements round-tripped
 * into 52, and an element-level LTR even clobbered a run that had authored RTL
 * for itself. That is the same inheritance-flattening class as the `a:pPr`
 * collapse.
 *
 * `a:pPr/@rtl` is still written, from the untouched style, by
 * `buildParagraphPropertiesXml`. A run only gets `<a:rtl>` when the run itself
 * carried one, which arrives on `segment.style` and is spread after this.
 *
 * The font-metadata keys have the SAME leak shape as `rtl`, just discovered
 * later: `segmentStyle` (`PptxHandlerRuntimeSaveParagraphs`) is built as
 * `{...runScopedTextStyle, ...segment.style, ...uniformSegmentOverrides}`, so
 * a key `segment.style` never sets at all is not overridden by that spread.
 * Measured on a real deck: a run whose own `<a:ea typeface="Abraham
 * Lincoln"/>` carried no `@panose` came back stamped with the PANOSE of an
 * unrelated CJK font used by an earlier run in the same shape, because the
 * element-level style had been seeded from that earlier run. The typeface
 * fields themselves (`fontFamily`, `eastAsiaFont`, etc.) are intentionally
 * NOT stripped: a run that authors no font of its own legitimately inherits
 * the element/theme typeface, and `createRunPropertiesFromTextStyle`'s
 * `owns(...)` gate decides whether that inherited face differs enough from
 * the paragraph baseline to write. Its accompanying `@panose` is a separate,
 * optional descriptor of one specific font node and is not needed for that
 * inherited typeface to round-trip correctly.
 */
export function toRunScopedTextStyle(textStyle: TextStyle | undefined): TextStyle | undefined {
	if (!textStyle) {
		return textStyle;
	}
	const hasFontMetadata = FONT_METADATA_KEYS.some((key) => textStyle[key] !== undefined);
	if (textStyle.rtl === undefined && !hasFontMetadata) {
		return textStyle;
	}
	const runScoped: TextStyle = { ...textStyle };
	delete runScoped.rtl;
	for (const key of FONT_METADATA_KEYS) {
		delete runScoped[key];
	}
	return runScoped;
}
