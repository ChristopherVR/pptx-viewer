import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	buildGradientStrokeOutline,
	getComputedEffectStyle,
	getSoftEdgeSvgFilter,
	svgGradientFillRef,
} from 'pptx-viewer-shared';
import React from 'react';
import type { CSSProperties } from 'react';

/**
 * ShapeEffectOverlay: paints the two shape-effect extras that need their own
 * DOM nodes (the shape's CSS `filter`/`box-shadow`/blend already ride on the
 * shape container `<div>` via `getShapeVisualStyle`). React port of the Vue /
 * Svelte `ShapeEffectOverlay`:
 *
 *  1. A DAG fill-overlay tint layer (`ComputedEffectStyle.fillOverlay`): an
 *     absolutely-positioned, blended `<div>` painted over the element rather
 *     than blending the whole element (which would also tint text/children).
 *     `getShapeVisualStyle` therefore no longer sets a whole-element
 *     `mix-blend-mode` when a fill-overlay colour is present.
 *  2. A gradient OUTLINE (`a:ln/a:gradFill`): a CSS `border` takes one colour
 *     only, so the outline is stroked as a real SVG path over the element,
 *     following the shape's own geometry. `getShapeVisualStyle` drops the CSS
 *     border for these shapes so the averaged solid does not show underneath.
 *  3. The soft-edge feather `<filter>` (`a:softEdge`): the shape's CSS `filter`
 *     already carries a `url(#soft-edge-<id>)` reference (emitted by
 *     `getShapeVisualStyle`); this injects the matching `<filter>` markup into a
 *     hidden, zero-size `<svg><defs>` so that reference resolves. Mirrors how
 *     the duotone filter is injected via `renderDagDuotoneFilterForElement`.
 *
 * Renders nothing when the element has no shape properties, no fill overlay,
 * and no soft edge.
 */
export function ShapeEffectOverlay({
	element,
}: {
	element: PptxElement;
}): React.ReactElement | null {
	if (!hasShapeProperties(element)) {
		return null;
	}

	const overlay = getComputedEffectStyle(element).fillOverlay;
	const softEdge = getSoftEdgeSvgFilter(element.shapeStyle, element.id);
	const strokeOutline = buildGradientStrokeOutline(element);
	if (!overlay && !softEdge && !strokeOutline) {
		return null;
	}

	const fillOverlayStyle: CSSProperties | undefined = overlay
		? {
				position: 'absolute',
				inset: 0,
				background: overlay.color,
				mixBlendMode: overlay.blendMode as CSSProperties['mixBlendMode'],
				pointerEvents: 'none',
			}
		: undefined;

	return (
		<>
			{softEdge ? (
				<svg
					width={0}
					height={0}
					aria-hidden='true'
					style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
				>
					<defs dangerouslySetInnerHTML={{ __html: softEdge.filterMarkup }} />
				</svg>
			) : null}
			{fillOverlayStyle ? (
				<div className='pptx-react-fill-overlay' aria-hidden='true' style={fillOverlayStyle} />
			) : null}
			{strokeOutline ? (
				<svg
					className='pptx-react-gradient-outline'
					aria-hidden='true'
					viewBox={`0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`}
					preserveAspectRatio='none'
					style={{
						position: 'absolute',
						inset: 0,
						width: '100%',
						height: '100%',
						overflow: 'visible',
						pointerEvents: 'none',
					}}
				>
					<defs>
						{strokeOutline.gradient.kind === 'radial' ? (
							<radialGradient
								id={strokeOutline.gradient.id}
								cx={strokeOutline.gradient.cx}
								cy={strokeOutline.gradient.cy}
								r={strokeOutline.gradient.r}
							>
								{strokeOutline.gradient.stops.map((stop, idx) => (
									<stop
										key={idx}
										offset={stop.offset}
										stopColor={stop.color}
										stopOpacity={typeof stop.opacity === 'number' ? stop.opacity : undefined}
									/>
								))}
							</radialGradient>
						) : (
							<linearGradient
								id={strokeOutline.gradient.id}
								x1={strokeOutline.gradient.x1}
								y1={strokeOutline.gradient.y1}
								x2={strokeOutline.gradient.x2}
								y2={strokeOutline.gradient.y2}
							>
								{strokeOutline.gradient.stops.map((stop, idx) => (
									<stop
										key={idx}
										offset={stop.offset}
										stopColor={stop.color}
										stopOpacity={typeof stop.opacity === 'number' ? stop.opacity : undefined}
									/>
								))}
							</linearGradient>
						)}
					</defs>
					<path
						d={strokeOutline.d}
						fill='none'
						stroke={svgGradientFillRef(strokeOutline.gradient)}
						strokeWidth={strokeOutline.strokeWidth}
						strokeDasharray={strokeOutline.dashArray}
						strokeLinecap={strokeOutline.lineCap}
						strokeLinejoin={strokeOutline.lineJoin}
					/>
				</svg>
			) : null}
		</>
	);
}
