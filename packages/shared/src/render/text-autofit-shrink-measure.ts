/**
 * DOM half of `a:normAutofit` live shrink: measuring how tall the body would
 * render at a candidate {@link NormAutofitStep}, and the one composed call
 * every binding's inline-text-editor commit handler makes.
 *
 * See `text-autofit-shrink.ts` for the pure decision this measurement feeds.
 *
 * @module render/text-autofit-shrink-measure
 */
import type { TextStyle } from 'pptx-viewer-core';

import type { NormAutofitShrinkResult, NormAutofitStep } from './text-autofit-shrink';
import { computeNormAutofitShrink } from './text-autofit-shrink';

/**
 * Multiply every font-size (and, where set, line-height) found in `root` and
 * its descendants by `factor`/`lineFactor`, in place.
 *
 * Runs a snapshot pass first (reading every element's CURRENT computed size)
 * before writing any of them, so scaling a parent does not get compounded
 * when its child is visited next (a child that only inherits its size would
 * otherwise report the parent's already-scaled value).
 */
function scaleFontSizes(root: HTMLElement, fontFactor: number, lineFactor: number): void {
	const elements: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
	const original = elements.map((el) => {
		const computed = getComputedStyle(el);
		const fontSize = Number.parseFloat(computed.fontSize);
		const lineHeight = Number.parseFloat(computed.lineHeight);
		return {
			el,
			fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
			// `getComputedStyle().lineHeight` resolves to `'normal'` (not a px
			// value) when unset; `Number.parseFloat` on that is `NaN`, which the
			// `Number.isFinite` guard below correctly treats as "leave it alone".
			lineHeight: Number.isFinite(lineHeight) ? lineHeight : undefined,
		};
	});
	for (const entry of original) {
		if (entry.fontSize !== undefined) {
			entry.el.style.fontSize = `${entry.fontSize * fontFactor}px`;
		}
		if (entry.lineHeight !== undefined) {
			entry.el.style.lineHeight = `${entry.lineHeight * lineFactor}px`;
		}
	}
}

/**
 * Measure the natural content height (px, insets/padding included, matching
 * `measureAutoFitContentHeightPx`'s convention) that `editorEl` would render
 * at `step`, relative to the `baseline` step already baked into its current
 * rendering (i.e. whatever `autoFitFontScale`/`autoFitLineSpacingReduction`
 * the element carried before this edit).
 *
 * Clones `editorEl` off-screen at a fixed width with `height: auto` (the same
 * technique `measureAutoFitContentHeightPx` uses, for the same reason: a
 * `scrollHeight` read on the live, still-constrained node cannot tell "fits
 * now" apart from "box unchanged"), then rescales every descendant's
 * font-size/line-height from `baseline` to `step` before measuring, since a
 * real font-size change is what actually reflows text, unlike a CSS
 * `transform: scale()`.
 *
 * Returns `0` outside a DOM environment or when `editorEl` carries no
 * measurable font size, so a caller can treat that as "no measurement
 * available" without special-casing it (mirrors
 * `measureAutoFitContentHeightPx`'s contract).
 */
export function measureNormAutofitStepHeightPx(
	editorEl: HTMLElement,
	widthPx: number,
	baseline: NormAutofitStep,
	step: NormAutofitStep,
): number {
	if (typeof document === 'undefined' || !editorEl.ownerDocument) {
		return 0;
	}
	const doc = editorEl.ownerDocument;
	const clone = editorEl.cloneNode(true) as HTMLElement;
	if (editorEl instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
		clone.value = editorEl.value;
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
		const baselineScale = baseline.fontScale > 0 ? baseline.fontScale : 1;
		const fontFactor = step.fontScale / baselineScale;
		const lineFactor = (1 - step.lnSpcReduction) / (1 - baseline.lnSpcReduction || 1);
		scaleFontSizes(clone, fontFactor, lineFactor);
		return clone.scrollHeight;
	} finally {
		doc.body.removeChild(clone);
	}
}

/**
 * The one call every binding's inline-text-editor commit handler makes for
 * `normAutofit`: build the DOM-measuring callback and hand it to the shared
 * decision, exactly the way `resolveInlineEditAutoFitHeight` composes
 * `spAutoFit`'s measurement and decision.
 *
 * `editorEl` is `null` when the binding could not find its still-mounted
 * editor node; this returns `'unchanged'` in that case without measuring.
 */
export function resolveInlineEditNormAutofitShrink(
	textStyle: TextStyle | undefined,
	boxHeightPx: number,
	editorEl: HTMLElement | null,
): NormAutofitShrinkResult {
	if (!editorEl) {
		return 'unchanged';
	}
	const baseline: NormAutofitStep = {
		fontScale: textStyle?.autoFitFontScale ?? 1,
		lnSpcReduction: textStyle?.autoFitLineSpacingReduction ?? 0,
	};
	const widthPx = editorEl.offsetWidth;
	return computeNormAutofitShrink({
		autoFitMode: textStyle?.autoFitMode,
		currentFontScale: textStyle?.autoFitFontScale,
		currentLnSpcReduction: textStyle?.autoFitLineSpacingReduction,
		boxHeightPx,
		measureAtStep: (step) => measureNormAutofitStepHeightPx(editorEl, widthPx, baseline, step),
	});
}
