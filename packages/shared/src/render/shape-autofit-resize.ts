/**
 * Editor-time resize for `a:spAutoFit` ("Resize shape to fit text").
 *
 * ECMA-376 gives autofit two, mutually exclusive jobs: `a:normAutofit`
 * shrinks the TEXT to fit the shape (`fontScale` / `lnSpcReduction`, see
 * `computeAutoFitTextStyle` in `text-style-helpers.ts`); `a:spAutoFit` grows
 * or shrinks the SHAPE to fit the text, never the font. `computeAutoFitTextStyle`
 * deliberately applies no font override for `spAutoFit` because an authored
 * deck's `a:ext` is already the box PowerPoint sized to fit - but that
 * assumption only holds for a shape nobody has touched since. The moment a
 * user types into a `spAutoFit` box in this editor, something has to keep it
 * true by resizing the box itself; this module is that something.
 *
 * Three pieces:
 * - {@link measureAutoFitContentHeightPx}: the one DOM-touching step, shared
 *   because it needs no framework, only the DOM API. It clones the live
 *   contentEditable node into an off-screen, `height: auto` copy at the
 *   shape's current width, so the reported height is the text's natural
 *   extent rather than the box's own (possibly stale) height. A plain
 *   `el.scrollHeight` read cannot tell "text now fits in less space" apart
 *   from "box unchanged": with the box's own height still imposed via CSS
 *   (flex vertical anchoring, `height: 100%`), `scrollHeight` on a
 *   shorter-than-before body still reports the box's old height, so autofit
 *   would only ever grow, never shrink.
 * - {@link computeAutoFitShapeHeightPx}: the pure decision the measured number
 *   feeds into.
 * - {@link resolveInlineEditAutoFitHeight}: the two composed into the one call
 *   every binding's inline-text-editor commit handler makes. Each handler
 *   queries its own still-mounted `[data-inline-editor]` DOM node (the exact
 *   query is left to the binding since the timing of "still mounted" differs
 *   slightly framework to framework) and passes it in here along with the
 *   element's text style and current height; the result is written onto the
 *   element's `height` (model px, the same unit `PptxElement.width/height`
 *   already use) via the binding's normal update path - which is also what
 *   makes the resize survive to disk: core's save pipeline serializes
 *   `height` to `a:ext/@cy` exactly as it does for a drag-resize.
 */
import type { TextStyle } from 'pptx-viewer-core';
import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';

/** Input for {@link computeAutoFitShapeHeightPx}. */
export interface AutoFitShapeResizeInput {
	/** `a:bodyPr` autofit mode; only `'shrink'` (`a:spAutoFit`) resizes the shape. */
	autoFitMode: TextStyle['autoFitMode'] | undefined;
	/**
	 * The text body's natural content height in px, insets included (from
	 * {@link measureAutoFitContentHeightPx}).
	 */
	measuredContentHeightPx: number;
	/** The shape's current height in px (`element.height`, model units). */
	currentHeightPx: number;
}

/**
 * Below this, PowerPoint's "Resize shape to fit text" never shrinks a box
 * further: a completely empty spAutoFit text box still reserves room for one
 * line plus its insets. Reusing the shared drag-resize floor keeps this
 * consistent with every other resize path rather than inventing a second
 * minimum.
 */
export const AUTOFIT_MIN_SHAPE_HEIGHT_PX = MIN_ELEMENT_SIZE;

/**
 * Sub-pixel measurement noise (font hinting, browser rounding) should not
 * dirty the document on every keystroke that did not actually change the
 * required height.
 */
const RESIZE_EPSILON_PX = 1;

/**
 * Decide the new shape height for a `spAutoFit` text box after an edit, or
 * `undefined` when no resize is needed (autofit isn't `'shrink'`, there is no
 * usable measurement, or the required height did not meaningfully change).
 *
 * Pure: takes plain numbers, so it is trivially the same across all five
 * bindings and unit-testable without a DOM.
 */
export function computeAutoFitShapeHeightPx(input: AutoFitShapeResizeInput): number | undefined {
	if (input.autoFitMode !== 'shrink') {
		return undefined;
	}
	if (!(input.measuredContentHeightPx > 0)) {
		return undefined;
	}
	const next = Math.max(AUTOFIT_MIN_SHAPE_HEIGHT_PX, Math.round(input.measuredContentHeightPx));
	if (Math.abs(next - input.currentHeightPx) < RESIZE_EPSILON_PX) {
		return undefined;
	}
	return next;
}

/**
 * Measure `el`'s natural content height in px at a fixed width, independent
 * of whatever height the live element currently has imposed on it (flex
 * vertical anchoring, an explicit `height: 100%`, etc.).
 *
 * Clones `el` (so the exact rendered runs/bullets/columns are measured, not
 * an approximation), pins the clone off-screen at `widthPx` with
 * `height: auto`, reads `scrollHeight`, then discards the clone. Safe to call
 * from any binding's commit handler; it never touches the live, still-focused
 * editor node.
 *
 * `el` may be a plain `<textarea>` (Angular's editor) instead of a
 * contentEditable div: `cloneNode` copies a textarea's default value (its
 * original `value` attribute), not the live `.value` the user has been typing
 * into, so a textarea's current value is copied onto the clone explicitly.
 *
 * Returns `0` outside a DOM environment (SSR / non-browser test) so a caller
 * can treat that as "no measurement available" without special-casing it.
 */
export function measureAutoFitContentHeightPx(el: HTMLElement, widthPx: number): number {
	if (typeof document === 'undefined' || !el.ownerDocument) {
		return 0;
	}
	const doc = el.ownerDocument;
	const clone = el.cloneNode(true) as HTMLElement;
	if (el instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
		clone.value = el.value;
	}
	clone.style.position = 'fixed';
	clone.style.visibility = 'hidden';
	clone.style.pointerEvents = 'none';
	clone.style.left = '-99999px';
	clone.style.top = '0';
	clone.style.right = 'auto';
	clone.style.bottom = 'auto';
	clone.style.width = `${widthPx}px`;
	clone.style.height = 'auto';
	clone.style.minHeight = '0';
	clone.style.maxHeight = 'none';
	clone.removeAttribute('contenteditable');
	doc.body.appendChild(clone);
	try {
		return clone.scrollHeight;
	} finally {
		doc.body.removeChild(clone);
	}
}

/**
 * The one call every binding's inline-text-editor commit handler makes:
 * measure `editorEl` (when present) and decide the shape's new height.
 *
 * `editorEl` is `null` when the binding could not find its still-mounted
 * editor node (or never had one, e.g. committing with nothing selected); this
 * returns `undefined` in that case without measuring, exactly as it does when
 * the measurement or the mode says no resize is needed.
 */
export function resolveInlineEditAutoFitHeight(
	textStyle: TextStyle | undefined,
	currentHeightPx: number,
	editorEl: HTMLElement | null,
): number | undefined {
	if (!editorEl) {
		return undefined;
	}
	const measuredContentHeightPx = measureAutoFitContentHeightPx(editorEl, editorEl.offsetWidth);
	return computeAutoFitShapeHeightPx({
		autoFitMode: textStyle?.autoFitMode,
		measuredContentHeightPx,
		currentHeightPx,
	});
}
