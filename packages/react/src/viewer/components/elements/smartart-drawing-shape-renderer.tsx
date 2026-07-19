import type { PptxSmartArtDrawingShape, PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';
import { resolveDrawingShapeNodeId } from 'pptx-viewer-shared';
import React from 'react';

import { colour, styleShadow, styleStroke, truncate } from '../../utils/smartart-helpers';
import {
	fitFontSize,
	chevronPoints,
	smartArtNodeGroupProps,
	SmartArtNodeText,
} from './smartart-renderer-utils';

// ── Props ───────────────────────────────────────────────────────────────────

/** Props for the pre-computed drawing shape renderer. */
interface DrawingShapeRendererProps {
	/** Unique element ID for generating stable React keys. */
	elementId: string;
	/** Pre-computed drawing shapes from PowerPoint's layout engine. */
	shapes: PptxSmartArtDrawingShape[];
	/** Resolved SmartArt style (controls shadow, stroke). */
	style: SmartArtStyle;
	/** Resolved colour palette. */
	palette: string[];
	/**
	 * Model nodes, used to map a clicked drawing shape back to a node id for
	 * inline editing. When omitted, shapes are not tagged as editable.
	 */
	nodes?: readonly PptxSmartArtNode[];
	/**
	 * Per-node accessibility labels keyed by node id (from the shared
	 * `buildSmartArtA11y` view-model). When present, each shape with a resolvable
	 * node id gains `role="img"` + `aria-label` and an SVG `<title>`.
	 */
	nodeLabels?: Map<string, string>;
}

// ── Fill helpers ──────────────────────────────────────────────────────────────

/**
 * Build an SVG gradient `<def>` for a cached drawing shape that carries a
 * gradient fill, plus the `fill` reference (`url(#id)`) to paint it with.
 * Returns `null` when the shape has no gradient stops.
 */
function drawingShapeGradientDef(
	id: string,
	shape: PptxSmartArtDrawingShape,
): { def: React.ReactElement; ref: string } | null {
	const stops = shape.fillGradientStops;
	if (!stops || stops.length === 0) {
		return null;
	}
	const stopEls = stops.map((s, i) => (
		<stop
			key={`${id}-s${i}`}
			offset={`${Math.max(0, Math.min(100, s.position))}%`}
			stopColor={s.color}
			{...(s.opacity !== undefined ? { stopOpacity: s.opacity } : {})}
		/>
	));
	if (shape.fillGradientType === 'radial') {
		return {
			ref: `url(#${id})`,
			def: (
				<radialGradient id={id} key={id} cx='50%' cy='50%' r='50%'>
					{stopEls}
				</radialGradient>
			),
		};
	}
	// OOXML angle is clockwise from the +x axis with y pointing down, which
	// matches the SVG coordinate system, so sin/cos map directly.
	const rad = ((shape.fillGradientAngle ?? 0) * Math.PI) / 180;
	const dx = Math.cos(rad) / 2;
	const dy = Math.sin(rad) / 2;
	return {
		ref: `url(#${id})`,
		def: (
			<linearGradient
				id={id}
				key={id}
				x1={`${(0.5 - dx) * 100}%`}
				y1={`${(0.5 - dy) * 100}%`}
				x2={`${(0.5 + dx) * 100}%`}
				y2={`${(0.5 + dy) * 100}%`}
			>
				{stopEls}
			</linearGradient>
		),
	};
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Renders pre-computed drawing shapes that come directly from PowerPoint's
 * layout engine output.
 *
 * Each shape is positioned within an SVG viewBox derived from the bounding
 * box of all shapes. Supports ellipses, chevrons/homePlates, and rounded
 * rectangles, with optional rotation, stroke, shadow, and text labels.
 */
export function DrawingShapeRenderer({
	elementId,
	shapes,
	style,
	palette,
	nodes,
	nodeLabels,
}: DrawingShapeRendererProps): React.ReactElement {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const s of shapes) {
		if (s.x < minX) {
			minX = s.x;
		}
		if (s.y < minY) {
			minY = s.y;
		}
		if (s.x + s.width > maxX) {
			maxX = s.x + s.width;
		}
		if (s.y + s.height > maxY) {
			maxY = s.y + s.height;
		}
	}

	const drawingW = maxX - minX || 1;
	const drawingH = maxY - minY || 1;
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			viewBox={`0 0 ${drawingW} ${drawingH}`}
			className='w-full h-full pointer-events-none'
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-drawing-shapes'
		>
			{shapes.map((shape, i) => {
				const gradient = drawingShapeGradientDef(`${elementId}-dspgrad-${shape.id}-${i}`, shape);
				// Precedence: gradient -> pattern foreground -> solid/palette.
				const fill =
					gradient?.ref ??
					shape.fillPatternForegroundColor ??
					shape.fillColor ??
					colour(i, palette);
				const relX = shape.x - minX;
				const relY = shape.y - minY;
				const rx = shape.shapeType === 'roundRect' ? Math.min(shape.width, shape.height) * 0.1 : 0;
				const isEllipse = shape.shapeType === 'ellipse';
				const isChevron = shape.shapeType === 'chevron' || shape.shapeType === 'homePlate';
				const rotation = shape.rotation
					? `rotate(${shape.rotation} ${relX + shape.width / 2} ${relY + shape.height / 2})`
					: undefined;
				const strokeCol = shape.strokeColor ?? (sw > 0 ? 'rgba(255,255,255,0.3)' : 'none');
				const strokeW = shape.strokeWidth ?? sw;
				const fontSize =
					shape.fontSize ?? fitFontSize(shape.text ?? '', shape.width * 0.85, shape.height, 14);

				const nodeId = nodes ? resolveDrawingShapeNodeId(shape, i, shapes, nodes) : undefined;
				const nodeLabel = nodeId ? nodeLabels?.get(nodeId) : undefined;
				const groupProps = nodeId
					? smartArtNodeGroupProps(nodeId, shadow, nodeLabel)
					: { style: { filter: shadow } };

				return (
					<g key={`${elementId}-dsp-${shape.id}-${i}`} {...groupProps}>
						{nodeLabel ? <title>{nodeLabel}</title> : null}
						{gradient ? <defs>{gradient.def}</defs> : null}
						{isEllipse ? (
							<ellipse
								cx={relX + shape.width / 2}
								cy={relY + shape.height / 2}
								rx={shape.width / 2}
								ry={shape.height / 2}
								fill={fill}
								stroke={strokeCol}
								strokeWidth={strokeW}
								transform={rotation}
							/>
						) : isChevron ? (
							<polygon
								points={chevronPoints(relX, relY, shape.width, shape.height)}
								fill={fill}
								stroke={strokeCol}
								strokeWidth={strokeW}
								transform={rotation}
							/>
						) : (
							<rect
								x={relX}
								y={relY}
								width={shape.width}
								height={shape.height}
								rx={rx}
								fill={fill}
								stroke={strokeCol}
								strokeWidth={strokeW}
								transform={rotation}
							/>
						)}
						{shape.text ? (
							<SmartArtNodeText
								x={relX + shape.width / 2}
								y={relY + shape.height / 2}
								text={truncate(shape.text, 40)}
								fill={shape.fontColor ?? 'white'}
								fontSize={fontSize}
								className='pointer-events-none'
							/>
						) : null}
					</g>
				);
			})}
		</svg>
	);
}
