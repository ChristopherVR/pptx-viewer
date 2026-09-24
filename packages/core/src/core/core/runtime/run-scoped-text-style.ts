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
