import type { PptxSmartArtDrawingShape, SmartArtStyle } from 'pptx-viewer-core';
import React from 'react';

import { colour, styleShadow, styleStroke, truncate } from '../../utils/smartart-helpers';
import { fitFontSize, chevronPoints } from './smartart-renderer-utils';

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
				const fill = shape.fillColor ?? colour(i, palette);
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

				return (
					<g key={`${elementId}-dsp-${shape.id}-${i}`} style={{ filter: shadow }}>
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
							<text
								x={relX + shape.width / 2}
								y={relY + shape.height / 2}
								textAnchor='middle'
								dominantBaseline='central'
								fill={shape.fontColor ?? 'white'}
								fontSize={fontSize}
								className='pointer-events-none'
							>
								{truncate(shape.text, 40)}
							</text>
						) : null}
					</g>
				);
			})}
		</svg>
	);
}
