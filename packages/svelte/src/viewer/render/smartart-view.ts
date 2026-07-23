import type { PptxSmartArtNode, SmartArtPptxElement, SmartArtStyle } from 'pptx-viewer-core';
import type {
	DiagramBuildState,
	RenderedNode,
	RenderedShape,
	SmartArtLayoutResult,
	SmartArtNodeA11y,
} from 'pptx-viewer-shared';
import {
	buildChromeStyle,
	buildSmartArtA11y,
	computeDrawingViewBox,
	computeSmartArtLayout,
	projectDrawingShapes,
	resolveDrawingShapeNodeId,
	resolvePalette,
	revealedSmartArtNodeCount,
	styleShadowFilter,
} from 'pptx-viewer-shared';

import { styleToString } from '../style';

/**
 * View-model resolution for `smartArt` elements (port of the vanilla
 * binding's `renderSmartArtElement`). Palette / stroke / shadow / layout
 * geometry all come from `pptx-viewer-shared`; this module only picks the
 * rendering path and shapes the data for the `SmartArtView` SFC.
 */

/** Inline style applied to every SmartArt SVG so it fills the element box. */
export const SMARTART_SVG_STYLE = 'width: 100%; height: 100%; pointer-events: none; display: block';

/** Connector stroke for the fallback layout path. */
export const SMARTART_CONNECTOR_STROKE = '#94a3b8';

/** Resolved SmartArt view: drawing shapes, engine layout, or a placeholder. */
export type SmartArtView =
	| {
			kind: 'drawing';
			viewBox: string;
			shapes: AccessibleDrawingShape[];
			shadow: string | undefined;
	  }
	| { kind: 'layout'; layout: AccessibleLayout }
	| { kind: 'placeholder' };

export type AccessibleDrawingShape = RenderedShape & { ariaLabel?: string; nodeId?: string };
export type AccessibleLayout = Omit<SmartArtLayoutResult, 'nodes'> & {
	nodes: Array<RenderedNode & { ariaLabel?: string; nodeId?: string }>;
};

function labelMap(nodes: SmartArtNodeA11y[]): Map<string, string> {
	return new Map(nodes.map((node) => [node.id, node.label]));
}

/** Chrome (background / outline) style string for the graphic wrapper. */
export function smartArtChromeStyle(element: SmartArtPptxElement): string {
	return styleToString({ ...buildChromeStyle(element.smartArtData?.chrome), position: 'relative' });
}

/** Assistive-tech diagram label, when the element carries SmartArt data. */
export function smartArtAriaLabel(element: SmartArtPptxElement): string | undefined {
	return element.smartArtData ? buildSmartArtA11y(element.smartArtData).label : undefined;
}

/**
 * Number of leading drawing shapes to reveal for a partial diagram build, kept
 * proportional to the revealed node prefix so the shapes appear in step with the
 * nodes. Mirrors the Vue `SmartArtRenderer` reveal slice.
 */
function revealedShapeCount(shownNodes: number, totalNodes: number, totalShapes: number): number {
	return Math.ceil((shownNodes / Math.max(totalNodes, 1)) * totalShapes);
}

/**
 * Pick the rendering path: pre-computed drawing shapes (preferred), the
 * shared layout engine over the node tree, or an empty placeholder.
 *
 * `build` is the active staged diagram build (`p:bldDgm`) during a running
 * presentation, if any: only the leading nodes / drawing shapes for the current
 * progress are revealed. The view box is still computed from the FULL shape set
 * so the diagram does not rescale as it builds (mirrors React / Vue).
 */
export function buildSmartArtView(
	element: SmartArtPptxElement,
	build?: DiagramBuildState,
): SmartArtView {
	const data = element.smartArtData;
	const nodes: PptxSmartArtNode[] = data?.nodes ?? [];
	const allDrawingShapes = data?.drawingShapes ?? [];
	const shownNodeCount = build ? revealedSmartArtNodeCount(nodes, build) : nodes.length;
	const isPartialBuild = build !== undefined && shownNodeCount < nodes.length;
	const revealedNodes = isPartialBuild ? nodes.slice(0, shownNodeCount) : nodes;
	const drawingShapes =
		isPartialBuild && allDrawingShapes.length > 0
			? allDrawingShapes.slice(
					0,
					revealedShapeCount(shownNodeCount, nodes.length, allDrawingShapes.length),
				)
			: allDrawingShapes;

	if (data && allDrawingShapes.length > 0) {
		const style: SmartArtStyle = data.style ?? 'flat';
		// View box from the FULL shape set so the diagram keeps its size while building.
		const viewBox = computeDrawingViewBox(allDrawingShapes);
		const labels = labelMap(buildSmartArtA11y(data).nodes);
		const shapes = projectDrawingShapes(
			element.id,
			drawingShapes,
			viewBox,
			resolvePalette(data),
			style,
		);
		return {
			kind: 'drawing',
			viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
			shapes: shapes.map((shape, index) => {
				const nodeId = resolveDrawingShapeNodeId(
					drawingShapes[index]!,
					index,
					drawingShapes,
					nodes,
				);
				return { ...shape, nodeId, ariaLabel: nodeId ? labels.get(nodeId) : undefined };
			}),
			shadow: styleShadowFilter(style),
		};
	}

	if (data && nodes.length > 0) {
		const layout = computeSmartArtLayout(
			revealedNodes,
			{ width: element.width, height: element.height },
			resolvePalette(data),
			data.style ?? 'flat',
			element.id,
			data.resolvedLayoutType,
			data.layout,
			undefined,
			data.layoutDefinition,
			data.presLayoutVars,
		);
		const labels = buildSmartArtA11y(data).nodes;
		return {
			kind: 'layout',
			layout: {
				...layout,
				nodes: layout.nodes.map((node, index) => ({
					...node,
					nodeId: nodes[index]?.id,
					ariaLabel: labels[index]?.label,
				})),
			},
		};
	}

	return { kind: 'placeholder' };
}

/** One rendered line of a multi-line SVG label; `y` offsets the node centre. */
export interface SvgTextLine {
	text: string;
	y: number;
}

/**
 * Split node text on `\n` and compute per-line y offsets (in SVG px) that
 * centre the block around the node centre y (offset 0). Single-line text
 * produces one entry with y=0, preserving `dominant-baseline="central"`
 * behaviour exactly (mirrors Vue's / vanilla's `textLines`).
 */
export function svgTextLines(text: string, fontSize: number): SvgTextLine[] {
	const raw = text.split('\n').filter((l) => l.length > 0);
	if (raw.length === 0) {
		return [{ text: '', y: 0 }];
	}
	const lh = fontSize * 1.2;
	const totalH = raw.length * lh;
	return raw.map((line, i) => ({
		text: line,
		y: -totalH / 2 + lh / 2 + i * lh,
	}));
}
