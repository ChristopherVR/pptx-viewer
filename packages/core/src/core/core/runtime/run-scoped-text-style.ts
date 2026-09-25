import type { TextStyle } from '../../types';

/**
 * Strip the paragraph-only members of an ELEMENT-level `textStyle` before it is
 * used as a run style.
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
 */
export function toRunScopedTextStyle(textStyle: TextStyle | undefined): TextStyle | undefined {
	if (!textStyle || textStyle.rtl === undefined) {
		return textStyle;
	}
	const { rtl: _paragraphDirection, ...runScoped } = textStyle;
	return runScoped as TextStyle;
}

/**
 * The part of the run-scoped ELEMENT style a PARSED segment may inherit.
 *
 * Every run's style is assembled as `{...runScopedTextStyle,
 * ...segment.style, ...uniformSegmentOverrides}`. A parsed segment's own
 * style is already complete (its `a:rPr` over the resolved defaults), so a
 * key it lacks means "this run does not set it". The element style, though,
 * is filled first-run-wins at load, so underlaying it handed the FIRST run's
 * `b="1"` or `err="1"` to every later run that authored neither, and the
 * ownership gate saw a value its baseline lacked and wrote it out
 * (measured on `solution-explorer.pptx`: 85 `@b` and 113 `@err` gained over
 * three rewritten slides).
 *
 * A key whose element value still equals the element's own authored or
 * baseline value is that load-time resolution, not an edit, so it is
 * dropped for parsed segments. A key the user changed at element level
 * differs from both and keeps reaching every run, as before. Styles with no
 * recorded baseline (SDK-built text) are returned unchanged.
 */
export function toParsedSegmentUnderlay(
	runScopedTextStyle: TextStyle | undefined,
): TextStyle | undefined {
	const baseline = runScopedTextStyle?.inheritedRunStyle;
	if (!runScopedTextStyle || !baseline) {
		return runScopedTextStyle;
	}
	const authored = runScopedTextStyle.authoredRunStyle;
	const underlay: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(runScopedTextStyle)) {
		const styleKey = key as keyof TextStyle;
		const loaded = authored?.[styleKey] ?? baseline[styleKey];
		if (loaded !== undefined && loaded === value) {
			continue;
		}
		underlay[key] = value;
	}
	return underlay as TextStyle;
}
