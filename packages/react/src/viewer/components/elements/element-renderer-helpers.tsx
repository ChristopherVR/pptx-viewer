import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
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
 * This must reflect the ELEMENT's data, not the presence of an `onHyperlinkClick`
 * handler prop: the handler is always supplied by the canvas, so keying off it
 * would make every element (including inert layout/master template shapes)
 * report as actionable and defeat the `editTemplateMode` interaction gate.
 */
export function elementHasTextHyperlink(el: PptxElement): boolean {
	if (!hasTextProperties(el)) {
		return false;
	}
	return Boolean(el.textSegments?.some((segment) => Boolean(segment.style?.hyperlink)));
}

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
		opacity,
		visibility: animationState?.visible === false ? 'hidden' : 'visible',
		animation: animationState?.cssAnimation,
		background: isFullscreenMedia ? '#000' : undefined,
		transition: isFullscreenMedia
			? 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease'
			: undefined,
		borderColor: isFullscreenMedia ? 'transparent' : undefined,
		...shapeVisualStyle,
		// Editable-template affordance: a distinct amber dashed ring + slight
		// transparency so inherited master/layout shapes read as "template" while
		// edit-template mode is on. Applied after the shape style so it wins; never
		// set for normal slide content or while the mode is off.
		...(templateEditing
			? { outline: '2px dashed rgb(217, 119, 6)', outlineOffset: '1px', opacity: opacity ?? 0.95 }
			: {}),
	};
}

/* ────────────────────── Action indicator badge ────────────────────────── */

interface ActionIndicatorProps {
	clickTooltip: string | undefined;
	hoverTooltip: string | undefined;
}

/** Small amber lightning-bolt badge shown when an element has an action. */
export function ActionIndicator({
	clickTooltip,
	hoverTooltip,
}: ActionIndicatorProps): React.ReactElement {
	return (
		<div
			className='absolute -top-1 -right-1 z-20 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow'
			title={clickTooltip || hoverTooltip || 'Has action'}
		>
			<svg className='w-2.5 h-2.5 text-white' viewBox='0 0 24 24' fill='currentColor'>
				<path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
			</svg>
		</div>
	);
}
