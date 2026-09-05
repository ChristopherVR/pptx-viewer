/**
 * `animation-text-style-css` - builds a scoped, `!important` CSS rule that
 * applies an active {@link TextStyleAnimationDescriptor} on top of an
 * element's own rendered text runs.
 *
 * Every binding already stamps its top-level rendered element wrapper with
 * `data-element-id="<id>"` (selection, hit-testing, the four non-React
 * bindings' post-render DOM pass). A run span always carries its OWN inline
 * `style` attribute (bold/italic/underline/size are declared there
 * unconditionally, see `text-run-style.ts`), so plain CSS inheritance from an
 * ancestor can never reach it: only a stylesheet rule with `!important`
 * outranks another element's own inline style. Scoping the selector to this
 * element's `data-element-id` keeps the override from leaking onto sibling
 * elements that reuse the same generic run markup.
 *
 * `fontScale` is applied as `calc(1em * <scale>)` rather than an absolute
 * size: once this rule wins, the run's own inline `font-size` is not
 * consulted at all, so the `em` here resolves against the INHERITED
 * (ancestor) font-size, giving a reasonable relative-size approximation
 * without needing per-run size bookkeeping at the override layer.
 *
 * @module render/animation-text-style-css
 */

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';

/** Escape a value for safe use inside a double-quoted CSS attribute selector. */
function escapeCssAttributeValue(value: string): string {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

/**
 * Build the CSS override rule for one element's active text-style animation,
 * or `undefined` when there is nothing to override (so a binding can skip
 * rendering a `<style>` tag entirely).
 *
 * Emits TWO scoped rules, both keyed off the SAME `data-element-id`, so one
 * call covers every element type a font-style emphasis effect can target
 * (text/shape, a table cell, a connector caption, a chart title/label/legend,
 * a SmartArt node caption): a binding no longer needs to gate this call on
 * "is this a plain text element" - PowerPoint animates a table cell or a
 * chart title exactly the same way.
 *
 * - The `[style]` rule targets ordinary HTML text (paragraph runs, table
 *   cell spans, connector caption spans): every one of those already carries
 *   its OWN inline `style` attribute (see the module doc), which plain CSS
 *   inheritance cannot reach.
 * - The `text, tspan` rule targets SVG text (chart titles/axis
 *   labels/data labels/legend, SmartArt node captions): every binding draws
 *   those as raw SVG presentation ATTRIBUTES (`fill=`, `font-weight=`, ...),
 *   never an inline `style`, so the `[style]` rule's selector never matches
 *   them at all. `font-weight`/`font-style`/`font-size`/`text-decoration`
 *   are CSS properties SVG text already honours; `color` is not (SVG paints
 *   text via `fill`), so the colour case is re-expressed as `fill` here
 *   instead of reusing the `color` declaration.
 *
 * Neither rule leaks onto a chart's non-text SVG (bars, slices, borders):
 * `text, tspan` is a plain type selector, not `*`, so nothing else in the
 * element's subtree matches it.
 */
export function buildTextStyleOverrideCss(
	elementId: string,
	style: TextStyleAnimationDescriptor | undefined,
): string | undefined {
	if (!style) {
		return undefined;
	}
	const declarations: string[] = [];
	const svgDeclarations: string[] = [];
	if (style.bold !== undefined) {
		const decl = `font-weight: ${style.bold ? 'bold' : 'normal'} !important;`;
		declarations.push(decl);
		svgDeclarations.push(decl);
	}
	if (style.italic !== undefined) {
		const decl = `font-style: ${style.italic ? 'italic' : 'normal'} !important;`;
		declarations.push(decl);
		svgDeclarations.push(decl);
	}
	if (style.underline !== undefined) {
		const decl = `text-decoration-line: ${style.underline ? 'underline' : 'none'} !important;`;
		declarations.push(decl);
		svgDeclarations.push(decl);
	}
	if (
		typeof style.fontScale === 'number' &&
		Number.isFinite(style.fontScale) &&
		style.fontScale > 0
	) {
		const decl = `font-size: calc(1em * ${style.fontScale}) !important;`;
		declarations.push(decl);
		svgDeclarations.push(decl);
	}
	if (style.color) {
		declarations.push(`color: ${style.color} !important;`);
		svgDeclarations.push(`fill: ${style.color} !important;`);
	}
	if (declarations.length === 0) {
		return undefined;
	}
	const scope = `[data-element-id="${escapeCssAttributeValue(elementId)}"]`;
	const htmlRule = `${scope} [style] { ${declarations.join(' ')} }`;
	const svgRule = `${scope} text, ${scope} tspan { ${svgDeclarations.join(' ')} }`;
	return `${htmlRule}\n${svgRule}`;
}

/**
 * A visually inert `@keyframes` block for an emphasis step whose ONLY effect
 * is a text-style change (Bold Reveal, Underline, Style Emphasis, ...).
 *
 * The timeline builder needs every step to own a CSS animation so the
 * playback engine's timing (delay, duration, cleanup) has something to hang
 * off, but the unmapped-preset safety net used to hand these steps a neutral
 * `pulse`, so PowerPoint's plain "the text turns bold" played with a scale
 * throb on top. This keyframe holds the element exactly as rendered while the
 * `textStyle` override does the visible work.
 */
export function buildTextStyleHoldKeyframe(uid: number): { keyframeName: string; css: string } {
	const keyframeName = `pptx-tl-textstyle-hold-${uid}`;
	return {
		keyframeName,
		css: `@keyframes ${keyframeName} {\n\tfrom { opacity: 1; }\n\tto { opacity: 1; }\n}`,
	};
}
