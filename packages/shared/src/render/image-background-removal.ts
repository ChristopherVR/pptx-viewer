import type { PptxBackgroundRemoval, PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

/**
 * Framework-neutral descriptor for PowerPoint's "Remove Background"
 * (`a14:backgroundRemoval`) on a picture.
 *
 * ## Why this does not feed the `filter` / `clip-path` a binding applies
 *
 * PowerPoint's background removal is DESTRUCTIVE. The bitmap the picture points
 * at already has the background stripped; the `a14` blip extension records the
 * retained rectangle and the user's foreground/background strokes only so the
 * removal can be re-edited from the pristine original (kept beside it as a
 * `.wdp` HD Photo part).
 *
 * Measured with PowerPoint COM rather than assumed: a slide whose picture was
 * given a `a14:backgroundRemoval` retaining just the middle 50% x 50% exported
 * BYTE-IDENTICALLY to the untouched control. Clipping to
 * {@link ImageBackgroundRemovalDescriptor.clipPath} would therefore crop an
 * image whose background is already gone, and diverge from PowerPoint on every
 * real file.
 *
 * The descriptor exists for the paths that legitimately need the geometry:
 * inspectors and the AI/MCP layer reporting the picture's editing state, and any
 * future "restore/redo background removal" flow that re-derives the picture from
 * the original. Rendering it is opt-in, never automatic.
 */
export interface ImageBackgroundRemovalDescriptor {
	/** Retained rectangle edges as 0..1 fractions of the image. */
	retained: { top: number; bottom: number; left: number; right: number };
	/**
	 * CSS `clip-path` for the retained rectangle, e.g. `inset(12% 7% 12% 7%)`.
	 * Only meaningful against the PRISTINE original image; see the module note.
	 */
	clipPath: string;
	/** Number of `a14:foregroundMark` strokes recorded. */
	foregroundMarkCount: number;
	/** Number of `a14:backgroundMark` strokes recorded. */
	backgroundMarkCount: number;
	/**
	 * The stored bitmap already has the background removed. Always `true` for
	 * file-sourced data; kept explicit so a consumer cannot forget the rule.
	 */
	prerendered: true;
}

/** Format a 0..1 fraction as a CSS percentage with at most 4 decimals. */
function percent(value: number): string {
	const pct = Math.round(Math.min(Math.max(value, 0), 1) * 1000000) / 10000;
	return `${pct}%`;
}

/**
 * Build the background-removal descriptor for an element, or `undefined` when
 * the picture has no removal recorded (or is not a picture at all).
 *
 * @example
 * ```ts
 * getImageBackgroundRemoval(el)?.clipPath;
 * // => "inset(12% 7% 12% 7%)" for t=0.12 b=0.88 l=0.07 r=0.93
 * ```
 */
export function getImageBackgroundRemoval(
	element: PptxElement,
): ImageBackgroundRemovalDescriptor | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	const removal: PptxBackgroundRemoval | undefined = element.imageEffects?.backgroundRemoval;
	if (!removal) {
		return undefined;
	}
	const { top, bottom, left, right } = removal;
	return {
		retained: { top, bottom, left, right },
		// CSS inset() takes insets from each edge, clockwise from the top.
		clipPath: `inset(${percent(top)} ${percent(1 - right)} ${percent(1 - bottom)} ${percent(left)})`,
		foregroundMarkCount: removal.foregroundMarks?.length ?? 0,
		backgroundMarkCount: removal.backgroundMarks?.length ?? 0,
		prerendered: true,
	};
}
