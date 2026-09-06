import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import {
	buildHollowHitOutline,
	buildStrokeOutline,
	buildSubpathFillOverlay,
	getComputedEffectStyle,
	getEffectStyleSource,
	getSoftEdgeSvgFilter,
	strokeOutlineViewBox,
} from 'pptx-viewer-shared';
import type { StrokeOutlinePaint } from 'pptx-viewer-shared';
import React from 'react';
import type { CSSProperties } from 'react';

import { getImageSurfaceMaskStyle } from '../../utils';
import { StaticElementRenderer } from '../StaticElementRenderer';

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
	if (paint.kind === 'rectPath') {
		// A freeform `a:path type="rect"` gradient: the nested-rectangle band
		// field stretched over the shape's bounding box.
		return (
			<pattern id={paint.id} patternUnits='objectBoundingBox' width={1} height={1}>
				<image href={paint.href} x={0} y={0} width={1} height={1} preserveAspectRatio='none' />
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
 *  4. A per-sub-path FILL overlay, for a multi-sub-path preset (`smileyFace`'s
 *     open eyes, `actionButtonBlank`'s darkened bevel well) whose sub-paths
 *     cannot share one CSS `background-color`: `getShapeVisualStyle` drops the
 *     container fill for these (via shared `suppressesCssFill`) so this layered
 *     SVG paints it instead, each sub-path with its own resolved fill.
 *  5. A mirrored REFLECTION sibling (`a:reflection`): a full, inert clone of the
 *     element's own rendered content (`StaticElementRenderer`, the same
 *     read-only recursive renderer thumbnails/previews use), not just its
 *     resolved fill - fill, outline, its text body, and for a group its
 *     children, all mirror. `suppressReflection` stops the clone from
 *     recursing into its OWN reflection block.
 *
 * A group has no `shapeStyle` of its own, so the fill-overlay/outline extras
 * above naturally stay `undefined` for one (their builders self-guard on
 * `hasShapeProperties`), but `p:grpSpPr/a:effectLst` DOES resolve a soft edge
 * and a reflection (from `groupEffectStyle`, see shared `getComputedEffectStyle`
 * / `getEffectStyleSource`); the reflection mirrors the whole group subtree,
 * the soft edge feathers the group's own composited raster (its shadow/glow
 * ride the container `filter` set by `getShapeVisualStyle`, not this overlay).
 *
 * Renders nothing when the element has no fill overlay, soft edge, stroke
 * outline, hollow hit band, sub-path fill, or reflection.
 */
export function ShapeEffectOverlay({
	element,
	animatesFill = false,
	animatesStroke = false,
	suppressReflection = false,
}: {
	element: PptxElement;
	/** Let an active fill-colour keyframe own SVG sub-path paint. */
	animatesFill?: boolean;
	/** Let an active stroke-colour keyframe own the SVG outline paint. */
	animatesStroke?: boolean;
	/**
	 * Do not render this element's own reflection mirror. Set by
	 * `StaticElementRenderer` while it is itself rendering AS a reflection
	 * mirror's content, so a mirror never grows a mirror of itself.
	 */
	suppressReflection?: boolean;
}): React.ReactElement | null {
	const fx = getComputedEffectStyle(element);
	const overlay = fx.fillOverlay;
	const reflection = suppressReflection ? undefined : fx.reflection;
	const softEdge = getSoftEdgeSvgFilter(getEffectStyleSource(element), element.id);
	const strokeOutline = buildStrokeOutline(element);
	// An unfilled, textless shape is a FRAME: its container is pointer-events:none
	// so clicks fall through to what it is drawn over, and this transparent band
	// opts its OUTLINE back into hit testing (same trick as connector-hit-target).
	const hollowHit = buildHollowHitOutline(element);
	const subpathFill = buildSubpathFillOverlay(element);
	if (!overlay && !softEdge && !strokeOutline && !hollowHit && !subpathFill && !reflection) {
		return null;
	}

	const fillOverlayStyle: CSSProperties | undefined = overlay
		? {
				position: 'absolute',
				inset: 0,
				...(isImageLikeElement(element) ? getImageSurfaceMaskStyle(element) : {}),
				background: overlay.color,
				mixBlendMode: overlay.blendMode as CSSProperties['mixBlendMode'],
				pointerEvents: 'none',
			}
		: undefined;

	return (
		<>
			{subpathFill ? (
				<svg
					className='pptx-react-subpath-fill'
					aria-hidden='true'
					viewBox={`0 0 ${subpathFill.viewBoxWidth} ${subpathFill.viewBoxHeight}`}
					preserveAspectRatio='none'
					style={{
						position: 'absolute',
						inset: 0,
						width: '100%',
						height: '100%',
					}}
				>
					{subpathFill.paints.map((paint, idx) => (
						<path
							key={idx}
							d={paint.d}
							fill={animatesFill ? 'inherit' : paint.fill}
							stroke='none'
						/>
					))}
				</svg>
			) : null}
			{softEdge ? (
				<svg
					width={0}
					height={0}
					aria-hidden='true'
					style={{
						position: 'absolute',
						width: 0,
						height: 0,
						overflow: 'hidden',
					}}
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
							stroke={animatesStroke ? 'inherit' : strokeOutline.stroke}
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
			{reflection ? (
				<div
					className='pptx-react-reflection'
					aria-hidden='true'
					style={reflection as CSSProperties}
				>
					{/*
						Full inert clone of the element's own rendered content: fill,
						outline, and its text body (a picture's actual photo when
						`element` is one). `positioned={false}` fills the wrapper above
						at 100%/100% instead of re-applying the element's own x/y (the
						element's own rotation already applies to this whole overlay via
						the enclosing container's transform, so re-applying it here would
						double it). `suppressReflection` stops this clone from mounting
						ANOTHER copy of this very reflection.
					*/}
					<StaticElementRenderer element={element} positioned={false} suppressReflection />
				</div>
			) : null}
		</>
	);
}
