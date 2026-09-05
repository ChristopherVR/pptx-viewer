import type { PptxSmartArtDrawingShape, PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';
import {
	computeDrawingViewBox,
	projectDrawingShapes,
	resolveRevealedDrawingShapeNodeIds,
	styleShadowFilter,
} from 'pptx-viewer-shared';
import type { RenderedShape } from 'pptx-viewer-shared';
import React from 'react';

import {
	SmartArtGradient,
	smartArtNodeGroupProps,
	SmartArtNodeText,
} from './smartart-renderer-utils';

// ── Props ───────────────────────────────────────────────────────────────────

/** Props for the pre-computed drawing shape renderer. */
interface DrawingShapeRendererProps {
	/** Unique element ID for generating stable React keys. */
	elementId: string;
	/**
	 * Pre-computed drawing shapes from PowerPoint's layout engine to draw: the
	 * REVEALED subset during a staged `p:bldDgm` build, the whole list otherwise.
	 */
	shapes: PptxSmartArtDrawingShape[];
	/**
	 * The FULL cached shape list `shapes` was taken from. The view box comes
	 * from it so a partial build does not rescale the diagram, and node ids are
	 * resolved over it so a partially revealed shape keeps its own node's id
	 * (matches Vue / Angular / Svelte / Vanilla). Defaults to `shapes`.
	 */
	allShapes?: readonly PptxSmartArtDrawingShape[];
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

/** The body primitive for one projected shape. */
function shapeBody(shape: RenderedShape): React.ReactElement {
	switch (shape.kind) {
		case 'image':
			return (
				<image
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					href={shape.imageUrl}
					preserveAspectRatio='xMidYMid meet'
					transform={shape.transform}
				/>
			);
		case 'ellipse':
			return (
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
			);
		case 'path':
			return (
				<path
					d={shape.pathData}
					fill={shape.fill}
					stroke={shape.stroke}
					strokeWidth={shape.strokeWidth}
					transform={shape.pathTransform}
				/>
			);
		default:
			return (
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
			);
	}
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Render the shapes PowerPoint's own layout engine already computed
 * (`ppt/diagrams/drawing*.xml`).
 *
 * Every decision (viewBox, fills including gradients and authored transparency,
 * primitive choice, label wrapping and contrast) comes from the shared
 * projection, so this component is the JSX for one descriptor plus React's
 * inline-edit / accessibility tagging.
 */
export function DrawingShapeRenderer({
	elementId,
	shapes,
	allShapes = shapes,
	style,
	palette,
	nodes,
	nodeLabels,
}: DrawingShapeRendererProps): React.ReactElement {
	const viewBox = computeDrawingViewBox(allShapes);
	const rendered = projectDrawingShapes(elementId, shapes, viewBox, palette, style);
	const nodeIds = nodes ? resolveRevealedDrawingShapeNodeIds(allShapes, shapes, nodes) : undefined;
	const shadow = styleShadowFilter(style);

	return (
		<svg
			viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
			className='w-full h-full pointer-events-none'
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-drawing-shapes'
		>
			{rendered.map((shape, i) => {
				const nodeId = nodeIds?.[i];
				const nodeLabel = nodeId ? nodeLabels?.get(nodeId) : undefined;
				const groupProps = nodeId
					? smartArtNodeGroupProps(nodeId, shadow, nodeLabel)
					: { style: { filter: shadow } };

				return (
					<g key={shape.key} {...groupProps}>
						{nodeLabel ? <title>{nodeLabel}</title> : null}
						{shape.gradient ? (
							<defs>
								<SmartArtGradient gradient={shape.gradient} />
							</defs>
						) : null}
						{shapeBody(shape)}
						{shape.textLines.length > 0 ? (
							<SmartArtNodeText
								x={shape.textX}
								y={shape.textY}
								lines={shape.textLines}
								fill={shape.fontColor}
								fontSize={shape.fontSize}
								fontFamily={shape.fontFamily}
								fontWeight={shape.fontWeight}
								fontStyle={shape.fontStyle}
								className='pointer-events-none'
							/>
						) : null}
					</g>
				);
			})}
		</svg>
	);
}
