/**
 * `animation-render-context` - the geometry + theme lookup a slide's native
 * animation timeline needs to resolve formulas that reference the animated
 * shape's REAL box (e.g. Grow And Turn's `-#ppt_w/2` fly-in) and scheme-colour
 * (`a:schemeClr`) stops in a `p:animClr` / `p:tavLst` colour ramp. Neither can
 * be resolved from the animation node alone (see
 * `animation-ppt-formula-ground-truth.md`), so `PresentationAnimationController
 * .fromSlide` builds this once per slide from data every binding already
 * loads: the slide's own elements (for geometry) and the deck's resolved
 * theme colour map.
 *
 * @module render/animation-render-context
 */
import type { PptxSlide } from 'pptx-viewer-core';

import { BACKGROUND_ANIMATION_ID_SUFFIX } from './animation-target-id';
import { flattenSlideElements } from './presentation-action';

/**
 * A shape's authored box as a fraction (0..1) of the slide's own width/height,
 * matching the `#ppt_x`/`#ppt_y`/`#ppt_w`/`#ppt_h` convention (`x`/`y` are the
 * TOP-LEFT corner; a formula consumer derives the centre itself).
 */
export interface AnimationElementBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * The context a slide's animation timeline resolves formulas/scheme colours
 * against. Both members are independently optional in practice (a binding
 * may have geometry but no theme, or vice versa); `getElementBox` always
 * exists on a built context but returns `undefined` for an id it has no
 * geometry for.
 */
export interface AnimationRenderContext {
	/** The animated element's authored box (slide-fraction units), or `undefined` when unknown. */
	getElementBox(elementId: string): AnimationElementBox | undefined;
	/** The deck's resolved theme colour map (`accent1`.., `tx1`/`bg1`/`tx2`/`bg2` aliases), when loaded. */
	themeColorMap?: Readonly<Record<string, string>>;
}

/** Slide canvas size, in the SAME px unit `PptxElement.x/y/width/height` are authored in. */
export interface AnimationSlideSize {
	widthPx: number;
	heightPx: number;
}

/** A `p:spTgt/p:bg` background-only target shares its owning shape's box. */
function stripBackgroundSuffix(elementId: string): string {
	return elementId.endsWith(BACKGROUND_ANIMATION_ID_SUFFIX)
		? elementId.slice(0, -BACKGROUND_ANIMATION_ID_SUFFIX.length)
		: elementId;
}

/**
 * Build the render context `PresentationAnimationController.fromSlide` threads
 * into the timeline builder. Returns `undefined` when neither geometry nor a
 * theme colour map is usable, so a caller with nothing to offer skips building
 * a context at all and the timeline falls back to its existing self-only
 * formula resolution / bare scheme-name fallback exactly as before.
 */
export function buildAnimationRenderContext(
	slide: PptxSlide,
	slideSize: AnimationSlideSize | undefined,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): AnimationRenderContext | undefined {
	const hasGeometry = slideSize !== undefined && slideSize.widthPx > 0 && slideSize.heightPx > 0;
	if (!hasGeometry && !themeColorMap) {
		return undefined;
	}
	let boxes: Map<string, AnimationElementBox> | undefined;
	if (hasGeometry && slideSize) {
		boxes = new Map();
		for (const element of flattenSlideElements(slide.elements)) {
			boxes.set(element.id, {
				x: element.x / slideSize.widthPx,
				y: element.y / slideSize.heightPx,
				width: element.width / slideSize.widthPx,
				height: element.height / slideSize.heightPx,
			});
		}
	}
	const resolvedBoxes = boxes;
	return {
		getElementBox: (elementId) => resolvedBoxes?.get(stripBackgroundSuffix(elementId)),
		themeColorMap,
	};
}
