/**
 * Computed-style inlining for the SVG `foreignObject` raster export path.
 *
 * Unlike the html2canvas pipeline (`export/css-preprocessing.ts`), which
 * actively *flattens away* backdrop-filter, mix-blend-mode and 3D transforms
 * because html2canvas's own CSS engine cannot paint them, this path exists
 * specifically to *preserve* them: the browser's real layout/paint engine
 * rasterises `foreignObject` content, so anything `getComputedStyle` reports
 * is something the browser can already paint correctly, custom-property
 * references included (a computed value never contains an unresolved
 * `var()`).
 *
 * The approach is therefore "copy every computed property to an inline
 * style" rather than a curated allow-list: a curated list is exactly the
 * kind of thing that silently misses the next CSS feature a future OOXML
 * mapping needs. A small exclude-list removes properties that are either
 * meaningless off-screen (`cursor`, layout-affecting scrollbar metrics) or
 * actively harmful to inline (shorthand/longhand pairs that fight each
 * other; see {@link EXCLUDED_STYLE_PROPERTIES}).
 */

/**
 * Longhand-conflicting or interaction-only properties to skip. Everything
 * else `getComputedStyle` reports is copied verbatim.
 *
 * - `cursor`, `caret-color`, `user-select`: interactive-only, invisible in a
 *   raster and occasionally logged as unsupported by strict SVG parsers.
 * - `all`: a computed value of `all` is never meaningful to copy forward.
 */
export const EXCLUDED_STYLE_PROPERTIES: ReadonlySet<string> = new Set([
	'cursor',
	'caret-color',
	'user-select',
	'-webkit-user-select',
	'all',
]);

/** The subset of `CSSStyleDeclaration` this module needs, so tests can pass a plain object-backed fake. */
export interface StyleDeclarationLike {
	readonly length: number;
	item(index: number): string;
	getPropertyValue(property: string): string;
}

/**
 * Build a `style` attribute value from a computed style, skipping properties
 * in {@link EXCLUDED_STYLE_PROPERTIES} and any with an empty computed value.
 */
export function buildInlineStyleText(computed: StyleDeclarationLike): string {
	const parts: string[] = [];
	for (let i = 0; i < computed.length; i++) {
		const prop = computed.item(i);
		if (EXCLUDED_STYLE_PROPERTIES.has(prop)) {
			continue;
		}
		const value = computed.getPropertyValue(prop);
		if (!value) {
			continue;
		}
		parts.push(`${prop}:${value}`);
	}
	return parts.join(';');
}

/** Injectable so tests (and non-browser hosts) can supply a fake `getComputedStyle`. */
export type ComputedStyleReader = (element: Element) => StyleDeclarationLike;

/**
 * Walk `liveRoot` and its structurally-identical clone `cloneRoot` in
 * lock-step, reading each live element's computed style and writing it as an
 * inline `style` attribute on the corresponding clone element.
 *
 * The clone must be produced by `cloneNode(true)` on `liveRoot` (or an
 * equivalent structural copy) *before* calling this: computed styles can
 * only be read from elements attached to a styled document, so this always
 * reads from the live tree and writes to the detached clone, never the
 * reverse.
 */
export function inlineComputedStylesOnClone(
	liveRoot: Element,
	cloneRoot: Element,
	readComputedStyle: ComputedStyleReader,
): void {
	const liveEl = liveRoot as HTMLElement | SVGElement;
	const cloneEl = cloneRoot as HTMLElement | SVGElement;
	cloneEl.setAttribute('style', buildInlineStyleText(readComputedStyle(liveEl)));

	const liveChildren = liveRoot.children;
	const cloneChildren = cloneRoot.children;
	const count = Math.min(liveChildren.length, cloneChildren.length);
	for (let i = 0; i < count; i++) {
		inlineComputedStylesOnClone(liveChildren[i], cloneChildren[i], readComputedStyle);
	}
}
