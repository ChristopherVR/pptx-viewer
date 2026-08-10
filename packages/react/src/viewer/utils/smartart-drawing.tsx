import type { PptxElement, PptxSmartArtDrawingShape, SmartArtStyle } from 'pptx-viewer-core';
import { computeDrawingViewBox, projectDrawingShapes, styleShadowFilter } from 'pptx-viewer-shared';
import React from 'react';

/**
 * Render pre-computed drawing shapes from `ppt/diagrams/drawing*.xml`.
 * These are the shapes as computed by PowerPoint's layout engine.
 *
 * All of the geometry, fill, label wrapping and contrast decisions come from the
 * shared projection, so this function is only the JSX for one descriptor.
 */
export function renderDrawingShapes(
	element: PptxElement,
	shapes: PptxSmartArtDrawingShape[],
	style: SmartArtStyle,
	palette: string[],
): React.ReactNode {
	const viewBox = computeDrawingViewBox(shapes);
	const rendered = projectDrawingShapes(element.id, shapes, viewBox, palette, style);
	const shadow = styleShadowFilter(style);

	return (
		<svg
			viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
			className='w-full h-full pointer-events-none'
			preserveAspectRatio='xMidYMid meet'
		>
			{rendered.map((shape) => (
				<g key={shape.key} style={{ filter: shadow }}>
					{shape.imageUrl ? (
						<image
							x={shape.x}
							y={shape.y}
							width={shape.width}
							height={shape.height}
							href={shape.imageUrl}
							preserveAspectRatio='xMidYMid meet'
							transform={shape.transform}
						/>
					) : shape.isEllipse ? (
						<ellipse
							cx={shape.cx}
							cy={shape.cy}
							rx={shape.width / 2}
							ry={shape.height / 2}
							fill={shape.fill}
							stroke={shape.stroke}
							strokeWidth={shape.strokeWidth}
							transform={shape.transform}
						/>
					) : (
						<rect
							x={shape.x}
							y={shape.y}
							width={shape.width}
							height={shape.height}
							rx={shape.rx}
							fill={shape.fill}
							stroke={shape.stroke}
							strokeWidth={shape.strokeWidth}
							transform={shape.transform}
						/>
					)}
					{shape.textLines.length > 0 ? (
						<text
							x={shape.textX}
							textAnchor='middle'
							dominantBaseline='central'
							fill={shape.fontColor}
							fontSize={shape.fontSize}
							className='pointer-events-none'
						>
							{shape.textLines.map((line, lineIndex) => (
								<tspan key={`${shape.key}-line-${lineIndex}`} x={shape.textX} y={line.y}>
									{line.text}
								</tspan>
							))}
						</text>
					) : null}
				</g>
			))}
		</svg>
	);
}
