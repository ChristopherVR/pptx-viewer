/**
 * One place where a chart serializer turns a modelled colour back into a
 * DrawingML colour-choice node.
 *
 * ## Why this exists
 *
 * Every colour on `PptxChartData` is a RESOLVED hex: the parse ran the
 * authored `<a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr>`
 * through the theme and kept only the answer. Ten per-feature serializers
 * (data points, markers, trendlines, error bars, axis titles, the legend,
 * display units, up/down bars) each wrote that answer straight back as
 * `<a:srgbClr val="0C7E81"/>`, so a chart nobody had touched came out pinned
 * to today's palette and stopped following a theme change. Measured on
 * `issue-132-hr-deck.pptx`: three untouched charts gained five `a:srgbClr`
 * each, one per themed data point.
 *
 * The chart part is re-parsed from the archive and mutated in place, so the
 * authored node is still there to compare against. That is the whole trick,
 * and putting it here rather than in each serializer is what stops the
 * eleventh serializer from forgetting it: take {@link ResolveChartColor} and
 * call {@link writeChartColorChoice} instead of assigning an `a:srgbClr`
 * literal.
 *
 * @module utils/chart-color-choice
 */

import type { XmlObject } from '../types';
import { serializeColorChoice } from './color-xml-preservation';

/**
 * Resolve an authored colour-choice node (`a:schemeClr` with its transforms,
 * `a:sysClr`, `a:prstClr`, ...) to the hex it currently paints.
 *
 * Optional throughout: a serializer called without one cannot tell an authored
 * theme colour from an edited literal, so it replaces the node, which is the
 * behaviour every one of them had before this module existed. The save runtime
 * supplies `parseColor`; a caller fabricating a brand-new chart has nothing to
 * preserve and passes nothing.
 */
export type ResolveChartColor = (node: XmlObject) => string | undefined;

/** Strip a leading `#` and upper-case, the form DrawingML `val` wants. */
export function chartColorHex(color: string): string {
	return color.replace(/^#/u, '').toUpperCase();
}

/**
 * The colour-choice content to put inside a fill wrapper (`a:solidFill`):
 * `authored` verbatim when it still resolves to `color`, a fresh
 * `<a:srgbClr>` otherwise.
 *
 * Use this form when the wrapper has to be placed through a schema-order
 * helper; use {@link writeChartColorChoice} when it can be assigned directly.
 */
export function chartColorChoiceValue(
	authored: XmlObject | undefined,
	color: string,
	resolveColor?: ResolveChartColor,
	opacity?: number,
): XmlObject {
	return serializeColorChoice(
		authored,
		authored && resolveColor ? resolveColor(authored) : undefined,
		chartColorHex(color),
		opacity,
	);
}

/**
 * Write `color` as the colour-choice content of `container[key]`, keeping
 * whatever was authored there when it still resolves to the same colour.
 *
 * `container[key]` is the wrapper element (`a:solidFill`), and its value is
 * the colour choice itself, so this both preserves an authored `a:schemeClr`
 * (including its `lumMod` / `tint` / `alpha` transforms) and replaces it the
 * moment the model says a different colour.
 */
export function writeChartColorChoice(
	container: XmlObject,
	key: string,
	color: string,
	resolveColor?: ResolveChartColor,
	opacity?: number,
): void {
	container[key] = chartColorChoiceValue(
		container[key] as XmlObject | undefined,
		color,
		resolveColor,
		opacity,
	);
}
