import type { PptxSmartArtNode, SmartArtPptxElement, SmartArtStyle } from 'pptx-viewer-core';
import type {
	ElementAnimationState,
	RenderedNode,
	RenderedShape,
	SmartArtLayoutResult,
	SmartArtNodeA11y,
	SvgTextLine,
} from 'pptx-viewer-shared';
import {
	buildChromeStyle,
	buildSmartArtA11y,
	computeDrawingViewBox,
	computeSmartArtElementLayout,
	flattenNodes,
	projectDrawingShapes,
	resolveRevealedDrawingShapeNodeIds,
	resolvePalette,
	resolveRevealedDrawingShapes,
	resolveRevealedSmartArtNodes,
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
 * Pick the rendering path: pre-computed drawing shapes (preferred), the
 * shared layout engine over the node tree, or an empty placeholder.
 *
 * `animationState` is the active native-animation playback state, if any: when
 * it carries a staged diagram build, only the leading nodes / drawing shapes
 * for the current progress are revealed, preferring the AUTHORED per-node
 * `p:graphicEl/@id` reveal set (`animationState.diagramReveal`) over the
 * click-count estimate when available. The view box is still computed from the
 * FULL shape set so the diagram does not rescale as it builds (mirrors
 * React / Vue / Angular).
 */
export function buildSmartArtView(
	element: SmartArtPptxElement,
	animationState?: Pick<ElementAnimationState, 'build' | 'diagramReveal'>,
): SmartArtView {
	const data = element.smartArtData;
	const nodes: PptxSmartArtNode[] = data?.nodes ?? [];
	const allDrawingShapes = data?.drawingShapes ?? [];
	const { nodes: revealedNodes } = resolveRevealedSmartArtNodes(
		nodes,
		animationState,
		data?.presLayoutVars,
	);
	const drawingShapes =
		allDrawingShapes.length > 0
			? resolveRevealedDrawingShapes(allDrawingShapes, nodes, animationState)
			: allDrawingShapes;

	if (data && allDrawingShapes.length > 0) {
		const style: SmartArtStyle = data.style ?? 'flat';
		// View box from the FULL shape set so the diagram keeps its size while building.
		const viewBox = computeDrawingViewBox(allDrawingShapes);
		const labels = labelMap(buildSmartArtA11y(data).nodes);
		// Node ids resolve over the FULL shape list, then align with the revealed
		// subset by identity: a positional lookup over the subset mis-tags a
		// partial build.
		const nodeIds = resolveRevealedDrawingShapeNodeIds(allDrawingShapes, drawingShapes, nodes);
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
				const nodeId = nodeIds[index];
				return { ...shape, nodeId, ariaLabel: nodeId ? labels.get(nodeId) : undefined };
			}),
			shadow: styleShadowFilter(style),
		};
	}

	if (data && nodes.length > 0) {
		const layout = computeSmartArtElementLayout(
			data,
			revealedNodes,
			{ width: element.width, height: element.height },
			resolvePalette(data),
			data.style ?? 'flat',
			element.id,
		);
		// Rendered nodes are index-aligned with the FLATTENED source nodes (the
		// layout engine walks the tree depth-first), so the id mapping has to
		// flatten too: reading the top-level array mis-labelled every child of a
		// nested diagram and handed the inline editor the wrong node id.
		const labels = labelMap(buildSmartArtA11y(data).nodes);
		const flatIds = flattenNodes([...revealedNodes]).map((node) => node.id);
		return {
			kind: 'layout',
			layout: {
				...layout,
				nodes: layout.nodes.map((node, index) => {
					const nodeId = flatIds[index];
					return { ...node, nodeId, ariaLabel: nodeId ? labels.get(nodeId) : undefined };
				}),
			},
		};
	}

	return { kind: 'placeholder' };
}

/**
 * One rendered line of a multi-line SVG label. The fallback layout path gets
 * its lines (already positioned, with the anchor and baseline resolved) from
 * the shared `smartArtNodeLabel`; the cached drawing-shape path gets them from
 * `projectDrawingShapes`. Nothing here recomputes either.
 */
export type { SvgTextLine };
