import type { PptxElement, PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';
import React from 'react';

import { resolvePalette, resolveStyle, layoutToCategory } from '../../utils/smartart-helpers';
import {
	renderStepDownProcess,
	renderAlternatingFlow,
	renderDescendingProcess,
	renderPictureAccentList,
	renderVerticalBlockList,
	renderGroupedList,
	renderPyramidList,
	renderHorizontalPictureList,
	renderAccentProcess,
	renderVerticalChevronList,
} from '../../utils/smartart-layouts-extra';
import { DrawingShapeRenderer } from './smartart-drawing-shape-renderer';
import {
	ListRenderer,
	ProcessRenderer,
	CycleRenderer,
	MatrixRenderer,
} from './smartart-layout-renderers';
import {
	PyramidRenderer,
	VennRenderer,
	FunnelRenderer,
	TargetRenderer,
} from './smartart-layout-renderers-secondary';
import {
	HierarchyRenderer,
	GearRenderer,
	TimelineRenderer,
	BendingProcessRenderer,
} from './smartart-layout-renderers-tertiary';
// Sub-module imports
import { wrapChrome, fitFontSize, chevronPoints } from './smartart-renderer-utils';

/**
 * SmartArtRenderer — Phase 2 Implementation
 *
 * Renders SmartArt diagrams with proper positioned shapes, styling,
 * connector lines between nodes, and layout-specific shape rendering.
 *
 * Features:
 * - Pre-computed drawing shape rendering (from PowerPoint's layout engine)
 * - Proper SVG-based rendering for all layout categories
 * - Connector lines between parent-child nodes in hierarchy layouts
 * - Chevron/arrow shapes for process layouts
 * - Concentric rings for cycle/radial layouts
 * - Pyramid trapezoids for pyramid layouts
 * - Rounded rectangles with shadows for professional appearance
 * - Text scaled to fit within each node
 * - Chrome wrapper for background/outline styling
 * - Support for all layout categories: list, process, cycle, hierarchy,
 *   relationship, matrix, pyramid, funnel, target, gear, timeline, venn
 */

interface SmartArtRendererProps {
	/** The SmartArt element to render */
	element: PptxElement;
	/** Optional className for styling */
	className?: string;
}

/**
 * Phase 2 SmartArt renderer component.
 *
 * Renders SmartArt nodes using SVG with proper positioning, styling,
 * and connector lines based on the layout type.
 */
function SmartArtRendererImpl({
	element,
	className = '',
}: SmartArtRendererProps): React.ReactElement {
	if (element.type !== 'smartArt' || !element.smartArtData) {
		return (
			<div
				className={`w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none ${className}`}
			>
				SmartArt
			</div>
		);
	}

	const { nodes, drawingShapes, chrome } = element.smartArtData;

	if (nodes.length === 0) {
		return (
			<div
				className={`w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none ${className}`}
			>
				SmartArt
			</div>
		);
	}

	const palette = resolvePalette(element);
	const style = resolveStyle(element);

	// Prefer pre-computed drawing shapes when available — these reflect
	// PowerPoint's actual layout engine output and are the most accurate.
	if (drawingShapes && drawingShapes.length > 0) {
		return wrapChrome(
			chrome,
			<DrawingShapeRenderer
				elementId={element.id}
				shapes={drawingShapes}
				style={style}
				palette={palette}
			/>,
			className,
		);
	}

	// Determine the layout category for algorithmic rendering
	const namedLayout = element.smartArtData.layout;
	const layoutType = namedLayout
		? layoutToCategory(namedLayout)
		: (
				element.smartArtData.resolvedLayoutType ??
				element.smartArtData.layoutType ??
				'list'
			).toLowerCase();

	const content = renderLayout(layoutType, element, nodes, palette, style);

	return wrapChrome(chrome, content, className);
}

// ── Layout dispatch ─────────────────────────────────────────────────────────

/**
 * Dispatch to the appropriate layout renderer based on the resolved layout type.
 *
 * @param layoutType - Normalised layout category string (e.g. "hierarchy", "process").
 * @param element    - The parent SmartArt element.
 * @param nodes      - The SmartArt nodes to render.
 * @param palette    - Resolved colour palette.
 * @param style      - Resolved SmartArt style.
 * @returns A React element for the chosen layout.
 */
function renderLayout(
	layoutType: string,
	element: PptxElement,
	nodes: PptxSmartArtNode[],
	palette: string[],
	style: SmartArtStyle,
): React.ReactElement {
	if (layoutType.includes('hierarchy') || layoutType.includes('org')) {
		return <HierarchyRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (
		layoutType.includes('process') ||
		layoutType.includes('chevron') ||
		layoutType.includes('arrow')
	) {
		return <ProcessRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('cycle') || layoutType.includes('radial')) {
		return <CycleRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('matrix')) {
		return <MatrixRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('pyramid')) {
		return <PyramidRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('venn')) {
		return <VennRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('funnel')) {
		return <FunnelRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('target') || layoutType.includes('bullseye')) {
		return <TargetRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('gear')) {
		return <GearRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('timeline') || layoutType.includes('linear')) {
		return <TimelineRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (layoutType.includes('bending') || layoutType.includes('snake')) {
		return (
			<BendingProcessRenderer element={element} nodes={nodes} palette={palette} style={style} />
		);
	}
	// ── Extra layout types (delegated to smartart-layouts-extra) ────────────
	if (layoutType.includes('stepdown')) {
		return <>{renderStepDownProcess(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('alternatingflow') || layoutType.includes('alternating')) {
		return <>{renderAlternatingFlow(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('descending')) {
		return <>{renderDescendingProcess(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('pictureaccent')) {
		return <>{renderPictureAccentList(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('verticalblock')) {
		return <>{renderVerticalBlockList(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('grouped')) {
		return <>{renderGroupedList(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('pyramidlist')) {
		return <>{renderPyramidList(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('horizontalpicture')) {
		return <>{renderHorizontalPictureList(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('accentprocess')) {
		return <>{renderAccentProcess(element, nodes, palette, style)}</>;
	}
	if (layoutType.includes('verticalchevron')) {
		return <>{renderVerticalChevronList(element, nodes, palette, style)}</>;
	}
	// Default: list layout
	return <ListRenderer element={element} nodes={nodes} palette={palette} style={style} />;
}

// ── Memoized export ─────────────────────────────────────────────────────────

/**
 * Memo comparator: re-render only when the SmartArt element identity or its
 * core data references change. SmartArt rendering is expensive (many SVG
 * shapes, layout computations), so skipping no-op renders is a meaningful
 * win for slides with multiple diagrams.
 */
function arePropsEqual(prev: SmartArtRendererProps, next: SmartArtRendererProps): boolean {
	if (prev.className !== next.className) {
		return false;
	}
	if (prev.element.id !== next.element.id) {
		return false;
	}
	if (prev.element.type !== next.element.type) {
		return false;
	}
	if (prev.element.width !== next.element.width || prev.element.height !== next.element.height) {
		return false;
	}
	if (prev.element.x !== next.element.x || prev.element.y !== next.element.y) {
		return false;
	}
	const prevData = prev.element.type === 'smartArt' ? prev.element.smartArtData : undefined;
	const nextData = next.element.type === 'smartArt' ? next.element.smartArtData : undefined;
	if (prevData !== nextData) {
		return false;
	}
	return true;
}

export const SmartArtRenderer = React.memo(SmartArtRendererImpl, arePropsEqual);

// ── Exported test utilities ─────────────────────────────────────────────────

/** @internal Exposed for testing */
export { fitFontSize, chevronPoints };
