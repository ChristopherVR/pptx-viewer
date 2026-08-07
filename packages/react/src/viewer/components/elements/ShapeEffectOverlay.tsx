import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	buildHollowHitOutline,
	buildStrokeOutline,
	getComputedEffectStyle,
	getSoftEdgeSvgFilter,
	strokeOutlineViewBox,
} from 'pptx-viewer-shared';
import type { StrokeOutlinePaint } from 'pptx-viewer-shared';
import React from 'react';
import type { CSSProperties } from 'react';

/**
 * The `<defs>` paint server an outline is stroked with. Only a gradient or a
 * pattern needs one; a flat colour rides on the path's `stroke` directly.
 */
function renderOutlinePaint(paint: StrokeOutlinePaint): React.ReactElement {
	if (paint.kind === 'pattern') {
		return (
			<pattern
				id={paint.id}
				width={paint.width}
				height={paint.height}
				patternUnits='userSpaceOnUse'
			>
				<image href={paint.href} width={paint.width} height={paint.height} />
			</pattern>
		);
	}
	const stops = paint.stops.map((stop, idx) => (
		<stop
			key={idx}
			offset={stop.offset}
			stopColor={stop.color}
			stopOpacity={typeof stop.opacity === 'number' ? stop.opacity : undefined}
		/>
	));
	if (paint.kind === 'radial') {
		return (
			<radialGradient id={paint.id} cx={paint.cx} cy={paint.cy} r={paint.r}>
				{stops}
			</radialGradient>
		);
	}
	return (
		<linearGradient id={paint.id} x1={paint.x1} y1={paint.y1} x2={paint.x2} y2={paint.y2}>
			{stops}
		</linearGradient>
	);
}

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
 *  2. A stroked SVG OUTLINE, for the two cases a CSS border cannot paint: a
 *     gradient / pattern line (`a:ln/a:gradFill`, `a:ln/a:pattFill`), which a
 *     border can only render as one flat colour, and a stroke-only ("open")
 *     preset such as `line` or `arc`, which has no box to put a border on. Both
 *     are stroked as a real SVG path over the element, following the shape's own
 *     geometry; `getShapeVisualStyle` drops the CSS border for these shapes so
 *     the averaged solid (or a rectangle) does not show underneath.
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
	const strokeOutline = buildStrokeOutline(element);
	// An unfilled, textless shape is a FRAME: its container is pointer-events:none
	// so clicks fall through to what it is drawn over, and this transparent band
	// opts its OUTLINE back into hit testing (same trick as connector-hit-target).
	const hollowHit = buildHollowHitOutline(element);
	if (!overlay && !softEdge && !strokeOutline && !hollowHit) {
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
					viewBox={strokeOutlineViewBox(element)}
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
					{strokeOutline.paint ? <defs>{renderOutlinePaint(strokeOutline.paint)}</defs> : null}
					{strokeOutline.strands.map((strand, idx) => (
						<path
							key={idx}
							d={strokeOutline.d}
							fill='none'
							stroke={strokeOutline.stroke}
							strokeWidth={strand.strokeWidth}
							strokeDasharray={strokeOutline.dashArray}
							strokeLinecap={strokeOutline.lineCap}
							strokeLinejoin={strokeOutline.lineJoin}
							style={
								strand.offset !== 0 ? { transform: `translate(0, ${strand.offset}px)` } : undefined
							}
						/>
					))}
				</svg>
			) : null}
			{hollowHit ? (
				<svg
					aria-hidden='true'
					viewBox={strokeOutlineViewBox(element)}
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
					<path
						d={hollowHit.d}
						fill='none'
						stroke='transparent'
						strokeWidth={hollowHit.strokeWidth}
						style={{ pointerEvents: 'stroke' }}
					/>
				</svg>
			) : null}
		</>
	);
}
