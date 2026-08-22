import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import React from 'react';
import type { CSSProperties } from 'react';

import { MIN_ELEMENT_SIZE } from '../../constants';
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
	const blurGrowVisible = Boolean(
		ss?.blurGrow && typeof ss.blurRadius === 'number' && ss.blurRadius > 0,
	);
	const overflowValue =
		has3DExtrusion || blurGrowVisible
			? ('visible' as const)
			: isImg
				? ('hidden' as const)
				: undefined;

	return {
		left: isFullscreenMedia ? 0 : el.x,
		top: isFullscreenMedia ? 0 : el.y,
		width: isFullscreenMedia ? '100%' : Math.max(el.width, MIN_ELEMENT_SIZE),
		height: isFullscreenMedia ? '100%' : Math.max(el.height, MIN_ELEMENT_SIZE),
		transform: isFullscreenMedia ? 'none' : getElementTransform(el),
		transformOrigin: 'center',
		overflow: overflowValue,
		clipPath: isImg && !has3DExtrusion ? getCropShapeClipPath(el) : undefined,
		zIndex: isFullscreenMedia ? 20 : zIndex,
		visibility: animationState?.visible === false ? 'hidden' : 'visible',
		animation: animationState?.cssAnimation,
		background: isFullscreenMedia ? '#000' : undefined,
		transition: isFullscreenMedia
			? 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease'
			: undefined,
		borderColor: isFullscreenMedia ? 'transparent' : undefined,
		...shapeVisualStyle,
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

/**
 * Params shared with {@link getContainerStyle}; only the ones the handle host
 * actually needs to line up with the element's box.
 */
interface HandleHostStyleParams {
	el: PptxElement;
	isFullscreenMedia: boolean;
	zIndex: number | undefined;
}

/**
 * Builds the `style` for the sibling `<div>` that hosts the resize/rotate/
 * adjustment handles OUTSIDE the shape's own clipped container.
 *
 * A non-rectangular preset's `clip-path` (`resolveShapeGeometry`'s `clipPath`
 * decision) sits on the element's own interactive `<div>` so a click in the
 * shape's dead space (an arrow's notch, a chevron's corner) falls through to
 * whatever is drawn under it, matching PowerPoint. `clip-path` clips EVERY
 * descendant's hit-testing, not just paint, so a handle measured off the
 * preset geometry (`shape-adjustment-handles`, which deliberately places a
 * handle exactly on a preset vertex - `rightArrow`'s head/shaft corner is
 * ~90% outside the arrow's own silhouette) becomes unclickable the moment it
 * lands outside that clip region, even though it renders at the visually
 * correct spot. There is no CSS escape hatch for a clipped descendant, so the
 * handles render as a SIBLING with the identical box instead: the same
 * structure `SelectionOverlay` already gives Vue, Angular, Svelte and Vanilla,
 * none of which nest their handles inside the shape's own clipped node.
 *
 * `pointerEvents: 'none'` keeps this host transparent everywhere a handle is
 * not, so clicking through it still reaches the shape (or whatever is behind
 * it) exactly as before; `ResizeHandles` is rendered here with
 * `forcePointerEvents` so its own buttons opt back in individually.
 */
export function getHandleHostStyle({
	el,
	isFullscreenMedia,
	zIndex,
}: HandleHostStyleParams): CSSProperties {
	return {
		position: 'absolute',
		left: isFullscreenMedia ? 0 : el.x,
		top: isFullscreenMedia ? 0 : el.y,
		width: isFullscreenMedia ? '100%' : Math.max(el.width, MIN_ELEMENT_SIZE),
		height: isFullscreenMedia ? '100%' : Math.max(el.height, MIN_ELEMENT_SIZE),
		transform: isFullscreenMedia ? 'none' : getElementTransform(el),
		transformOrigin: 'center',
		zIndex: isFullscreenMedia ? 21 : zIndex,
		pointerEvents: 'none',
	};
}

/*
 * The action-indicator badge and the link tooltip moved to
 * `./ActionAffordance`, which renders the shared (binding-neutral) markup and
 * styling from `pptx-viewer-shared`.
 */
