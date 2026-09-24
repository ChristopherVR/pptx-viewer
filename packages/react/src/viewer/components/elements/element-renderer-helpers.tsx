import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	elementContainerHeightStyle,
	MEDIA_FULLSCREEN_OVERLAY_STYLE,
	paintedElementSize,
} from 'pptx-viewer-shared';
import React from 'react';
import type { CSSProperties } from 'react';

import {
	getElementTransform,
	getCropShapeClipPath,
	hasDagDuotoneEffect,
	renderDagDuotoneSvgFilter,
} from '../../utils';
import type { ElementAnimationState } from '../../utils/animation-timeline';

/**
 * Whether the element actually carries a run-level text hyperlink
 * (`a:hlinkClick` on any text run). Used to decide whether the element wrapper
 * must stay pointer-interactive so an inner hyperlink span can receive clicks.
 *
 * Re-exported from `pptx-viewer-shared`: it is one half of the actionable-element
 * rule, which every binding now shares so they classify a deck identically.
 */
export { elementHasTextHyperlink } from 'pptx-viewer-shared';

/* ───────────────────────── DagDuotone SVG filter ──────────────────────── */

interface DagDuotoneShape {
	shapeStyle?: {
		dagDuotone?: { color1: string; color2: string };
	};
}

/**
 * Renders the inline SVG `<filter>` element needed for dag-duotone image
 * effects.  Returns `null` when the element has no duotone.
 */
export function renderDagDuotoneFilterForElement(el: PptxElement): React.ReactNode {
	if (!hasDagDuotoneEffect(el)) {
		return null;
	}
	const duotone = (el as DagDuotoneShape).shapeStyle?.dagDuotone;
	if (!duotone) {
		return null;
	}
	return renderDagDuotoneSvgFilter(el.id, duotone.color1, duotone.color2);
}

/* ──────────────────── Container style computation ─────────────────────── */

interface ContainerStyleParams {
	el: PptxElement;
	isFullscreenMedia: boolean;
	isImg: boolean;
	zIndex: number | undefined;
	opacity: number | undefined;
	animationState: ElementAnimationState | undefined;
	shapeVisualStyle: CSSProperties;
	/** Whether the element has active CSS 3D extrusion panels. */
	has3DExtrusion?: boolean;
	/** Draw the editable-template affordance (amber dashed ring + transparency). */
	templateEditing?: boolean;
}

/** Builds the `style` object for the outermost element container `<div>`. */
export function getContainerStyle({
	el,
	isFullscreenMedia,
	isImg,
	zIndex,
	opacity,
	animationState,
	shapeVisualStyle,
	has3DExtrusion,
	templateEditing,
}: ContainerStyleParams): CSSProperties {
	// For 3D-extruded shapes the side panels extend beyond the element bounds,
	// so overflow must be visible and the container needs `perspective` to
	// establish a proper 3D rendering context. A blur effect with `@grow` set
	// likewise needs `overflow: visible` so the blur halo is not clipped at the
	// element box (mirrors shared `getComputedEffectStyle().overflowVisible`).
	const ss = hasShapeProperties(el) ? el.shapeStyle : undefined;
	const isPicture = el.type === 'picture' || el.type === 'image';
	const blurGrowVisible = Boolean(
		ss?.blurGrow && typeof ss.blurRadius === 'number' && ss.blurRadius > 0,
	);
	const overflowValue =
		has3DExtrusion || blurGrowVisible || isPicture
			? ('visible' as const)
			: isImg || el.type === 'media'
				? ('hidden' as const)
				: undefined;

	// The painted box is the element's authored extent (see shared
	// `paintedElementSize`): it must never be padded past that in read-only
	// rendering, or a solid-filled degenerate shape (a thin horizontal rule)
	// paints as a thick bar instead of its authored 1-2px line (issue #285).
	// Grabbability for a degenerate shape is a SEPARATE, interactive-only
	// affordance; see `elementHitTargetStyle`, rendered by `ElementRenderer`.
	const painted = paintedElementSize(el);
	// The `fullScrn` full-slide overlay layout: the trigger and the literal
	// override values are shared so all five bindings agree on both.
	const fs = MEDIA_FULLSCREEN_OVERLAY_STYLE;
	// A table's authored `a:ext/@cy` is a cache of its last-computed row-height
	// sum, not a hard clip (see `elementContainerHeightStyle`): its container
	// sizes to content so an auto-grown row is not clipped.
	const heightStyle: CSSProperties = isFullscreenMedia
		? { height: fs.height }
		: el.type === 'table'
			? elementContainerHeightStyle(el, painted.height)
			: { height: painted.height };
	return {
		left: isFullscreenMedia ? fs.left : el.x,
		top: isFullscreenMedia ? fs.top : el.y,
		width: isFullscreenMedia ? fs.width : painted.width,
		...heightStyle,
		transform: isFullscreenMedia ? fs.transform : getElementTransform(el),
		transformOrigin: 'center',
		overflow: overflowValue,
		clipPath: isPicture
			? undefined
			: isImg && !has3DExtrusion
				? getCropShapeClipPath(el)
				: undefined,
		zIndex: isFullscreenMedia ? fs.zIndex : zIndex,
		visibility: animationState?.visible === false ? 'hidden' : 'visible',
		animation: animationState?.cssAnimation,
		background: isFullscreenMedia ? fs.background : undefined,
		transition: isFullscreenMedia ? fs.transition : undefined,
		borderColor: isFullscreenMedia ? fs.borderColor : undefined,
		...shapeVisualStyle,
		...(isPicture
			? {
					backgroundColor: 'transparent',
					backgroundImage: undefined,
					backgroundRepeat: undefined,
					backgroundSize: undefined,
					backgroundPosition: undefined,
					borderRadius: undefined,
					clipPath: undefined,
					overflow: 'visible',
				}
			: {}),
		// COMPOSE the effect alpha (`a:alphaModFix` on the effect DAG) with the
		// element opacity instead of letting the spread clobber it. The other four
		// bindings multiply the two; React spread the shape style over its own
		// `opacity` key, so a half-transparent element carrying a DAG alpha
		// rendered at the DAG's alpha alone.
		opacity:
			typeof shapeVisualStyle.opacity === 'number'
				? (opacity ?? 1) * shapeVisualStyle.opacity
				: opacity,
		// Editable-template affordance: a distinct amber dashed ring + slight
		// transparency so inherited master/layout shapes read as "template" while
		// edit-template mode is on. Applied after the shape style so it wins; never
		// set for normal slide content or while the mode is off.
		...(templateEditing
			? { outline: '2px dashed rgb(217, 119, 6)', outlineOffset: '1px', opacity: opacity ?? 0.95 }
			: {}),
	};
}

/*
 * The action-indicator badge and the link tooltip moved to
 * `./ActionAffordance`, which renders the shared (binding-neutral) markup and
 * styling from `pptx-viewer-shared`.
 */
