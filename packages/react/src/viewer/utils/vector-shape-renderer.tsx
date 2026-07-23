import {
	PptxElement,
	hasShapeProperties,
	isCalloutShape,
	getCalloutLeaderLineGeometry,
	buildCalloutLeaderLineSvgPath,
	getCalloutViewBoxBounds,
} from 'pptx-viewer-core';
import { svgLineCap } from 'pptx-viewer-shared';
import React from 'react';

import { colorWithOpacity } from './color';
import {
	getConnectorPathGeometry,
	renderConnectorMarker,
	getCompoundLineOffsets,
	getCompoundLineWidths,
} from './connector-path';
import { getShapeType } from './shape-types';
import { normalizeStrokeDashType, getSvgStrokeDasharray } from './style';
import { getStrokeOnlyPresetPaths } from './vector-subpath-paint';
import { renderCustomGeometryVector, renderStrokeOnlyPreset } from './vector-subpath-render';

export function renderVectorShape(
	element: PptxElement,
	hasFill: boolean,
	fillColor: string,
	strokeWidth: number,
	strokeColor: string,
	// When an active `p:animClr` color animation targets this shape's fill /
	// stroke, the painted SVG path relinquishes its static paint and uses
	// `inherit` so the wrapper-level `fill` / `stroke` colour keyframes (emitted
	// by the shared timeline) cascade into the vector. Absent/false keeps the
	// exact static paint (no regression).
	animatesFill?: boolean,
	animatesStroke?: boolean,
): React.ReactNode | null {
	if (!hasShapeProperties(element)) {
		return null;
	}
	const normalizedType = (element.shapeType || '').toLowerCase();
	const fillPaint = animatesFill
		? 'inherit'
		: colorWithOpacity(fillColor, element.shapeStyle?.fillOpacity);
	const strokePaint = animatesStroke
		? 'inherit'
		: colorWithOpacity(strokeColor, element.shapeStyle?.strokeOpacity);
	const dashType = normalizeStrokeDashType(element.shapeStyle?.strokeDash);
	const dashArray = getSvgStrokeDasharray(
		dashType,
		Math.max(strokeWidth, 1),
		element.shapeStyle?.customDashSegments,
	);
	if (normalizedType === 'can' || normalizedType === 'cylinder') {
		const width = Math.max(element.width, 1);
		const height = Math.max(element.height, 1);
		const rim = Math.max(Math.min(height * 0.16, 28), 6);
		const stroke = Math.max(strokeWidth, 1);
		return (
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className='w-full h-full pointer-events-none'
				preserveAspectRatio='none'
			>
				<ellipse
					cx={width / 2}
					cy={rim / 2}
					rx={width / 2}
					ry={rim / 2}
					fill={hasFill ? fillPaint : 'none'}
					stroke={strokeWidth > 0 ? strokePaint : 'none'}
					strokeWidth={stroke}
					strokeDasharray={dashArray}
					vectorEffect='non-scaling-stroke'
				/>
				<rect
					x={0}
					y={rim / 2}
					width={width}
					height={Math.max(height - rim, 1)}
					fill={hasFill ? fillPaint : 'none'}
					stroke={strokeWidth > 0 ? strokePaint : 'none'}
					strokeWidth={stroke}
					strokeDasharray={dashArray}
					vectorEffect='non-scaling-stroke'
				/>
				<ellipse
					cx={width / 2}
					cy={height - rim / 2}
					rx={width / 2}
					ry={rim / 2}
					fill={hasFill ? fillPaint : 'none'}
					stroke={strokeWidth > 0 ? strokePaint : 'none'}
					strokeWidth={stroke}
					strokeDasharray={dashArray}
					vectorEffect='non-scaling-stroke'
				/>
			</svg>
		);
	}

	if (
		(element.type === 'shape' || element.type === 'image' || element.type === 'picture') &&
		element.pathData &&
		element.pathWidth &&
		element.pathHeight &&
		element.pathWidth > 0 &&
		element.pathHeight > 0
	) {
		// Custom geometry: emit one `<path>` per structured sub-path so each
		// sub-path's own `@fill` mode (norm/lighten/darken/none) and `@stroke`
		// flag are honoured. Geometry without structured sub-paths falls back to
		// painting the aggregate `pathData` with a single fill plus compound
		// stroke strands (the legacy behaviour).
		return renderCustomGeometryVector(
			element.pathData,
			element.pathWidth,
			element.pathHeight,
			element.customGeometryPaths,
			element.shapeStyle,
			hasFill,
			fillColor,
			element.shapeStyle?.fillOpacity,
			strokePaint,
			strokeWidth,
			dashArray,
			Boolean(animatesFill),
		);
	}

	// ── Callout leader lines ──────────────────────────────────────────────
	if (isCalloutShape(normalizedType)) {
		const width = Math.max(element.width, 1);
		const height = Math.max(element.height, 1);
		const geometry = getCalloutLeaderLineGeometry(
			normalizedType,
			width,
			height,
			element.shapeAdjustments,
		);
		if (geometry && geometry.points.length >= 2) {
			const leaderPath = buildCalloutLeaderLineSvgPath(geometry);
			const bounds = getCalloutViewBoxBounds(width, height, geometry);
			const lineStroke = Math.max(strokeWidth, 1);
			// Offset the SVG container so it covers the expanded viewBox area
			const offsetLeft = bounds.minX;
			const offsetTop = bounds.minY;
			return (
				<svg
					viewBox={`${bounds.minX} ${bounds.minY} ${bounds.viewWidth} ${bounds.viewHeight}`}
					className='pointer-events-none'
					preserveAspectRatio='none'
					style={{
						position: 'absolute',
						left: offsetLeft,
						top: offsetTop,
						width: bounds.viewWidth,
						height: bounds.viewHeight,
						overflow: 'visible',
					}}
				>
					{/* Accent bar: horizontal line at top of shape */}
					{geometry.hasAccent && (
						<line
							x1={0}
							y1={0}
							x2={width}
							y2={0}
							stroke={strokePaint}
							strokeWidth={lineStroke}
							vectorEffect='non-scaling-stroke'
						/>
					)}
					{/* Leader line from shape edge to callout point */}
					<path
						d={leaderPath}
						fill='none'
						stroke={strokePaint}
						strokeWidth={lineStroke}
						strokeDasharray={dashArray}
						strokeLinecap='round'
						strokeLinejoin='round'
						vectorEffect='non-scaling-stroke'
					/>
				</svg>
			);
		}
	}

	if (
		element.type === 'connector' ||
		getShapeType(element.shapeType) === 'connector' ||
		element.shapeType === 'line'
	) {
		const viewWidth = Math.max(element.width, 1);
		const viewHeight = Math.max(element.height, 1);
		const { pathData } = getConnectorPathGeometry(element);
		const markerSeed = element.id.replace(/[^a-zA-Z0-9_-]/gu, '_');
		const startMarkerId = `${markerSeed}-start-arrow`;
		const endMarkerId = `${markerSeed}-end-arrow`;
		const startArrow = element.shapeStyle?.connectorStartArrow;
		const endArrow = element.shapeStyle?.connectorEndArrow;
		const startArrowW = element.shapeStyle?.connectorStartArrowWidth;
		const startArrowL = element.shapeStyle?.connectorStartArrowLength;
		const endArrowW = element.shapeStyle?.connectorEndArrowWidth;
		const endArrowL = element.shapeStyle?.connectorEndArrowLength;
		const compoundLine = element.shapeStyle?.compoundLine;
		// Line cap from a:ln/@cap (flat -> butt, sq -> square, rnd -> round).
		const connectorLineCap = svgLineCap(element.shapeStyle?.lineCap);
		// Hit target width: wide invisible stroke so thin lines are easy to click
		const hitTargetWidth = Math.max(strokeWidth * 3, 12);
		const offsets = getCompoundLineOffsets(compoundLine, strokeWidth);
		const widths = getCompoundLineWidths(compoundLine, strokeWidth);

		return (
			<svg
				viewBox={`0 0 ${viewWidth} ${viewHeight}`}
				className='w-full h-full'
				preserveAspectRatio='none'
				style={{ overflow: 'visible', pointerEvents: 'none' }}
			>
				<defs>
					{renderConnectorMarker(startMarkerId, startArrow, strokePaint, startArrowW, startArrowL)}
					{renderConnectorMarker(endMarkerId, endArrow, strokePaint, endArrowW, endArrowL)}
				</defs>
				{/* Invisible fat hit-target path: catches pointer events */}
				<path
					d={pathData}
					fill='none'
					stroke='transparent'
					strokeWidth={hitTargetWidth}
					strokeLinecap='round'
					strokeLinejoin='round'
					style={{ pointerEvents: 'stroke' }}
				/>
				{/* Visible connector stroke(s): compound lines render as parallel paths */}
				{offsets.map((offset, idx) => (
					<path
						key={idx}
						d={pathData}
						fill='none'
						stroke={strokePaint}
						strokeWidth={Math.max(widths[idx] ?? strokeWidth, 1)}
						strokeDasharray={dashArray}
						strokeLinecap={connectorLineCap}
						strokeLinejoin='round'
						markerStart={
							idx === 0 && startArrow && startArrow !== 'none'
								? `url(#${startMarkerId})`
								: undefined
						}
						markerEnd={
							idx === offsets.length - 1 && endArrow && endArrow !== 'none'
								? `url(#${endMarkerId})`
								: undefined
						}
						vectorEffect='non-scaling-stroke'
						style={{
							pointerEvents: 'none',
							...(offset !== 0 ? { transform: `translate(0, ${offset}px)` } : {}),
						}}
					/>
				))}
			</svg>
		);
	}

	// Open, stroke-only presets (e.g. `arc`): `evaluatePresetShape` reports
	// `fillNone`, so paint a stroked outline rather than flood-filling the wedge.
	// Placed last so connector/callout shapes keep their dedicated renderers.
	const strokeOnlyPreset = getStrokeOnlyPresetPaths(element);
	if (strokeOnlyPreset) {
		return renderStrokeOnlyPreset(
			strokeOnlyPreset,
			element.width,
			element.height,
			element.shapeStyle,
			strokePaint,
			strokeWidth,
			dashArray,
		);
	}

	return null;
}
