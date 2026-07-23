import type { PptxElement, PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';
import { updateSmartArtNodeText, setSmartArtNodeStyle } from 'pptx-viewer-core';
import {
	buildSmartArtA11y,
	revealedSmartArtNodeCount,
	shouldCommitSmartArtNodeText,
	rebuildDrawingShapesIfCleared,
} from 'pptx-viewer-shared';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
	resolvePalette,
	resolveSmartArtDataPalette,
	resolveStyle,
	layoutToCategory,
} from '../../utils/smartart-helpers';
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
import { SmartArtEditableLayer } from './SmartArtEditableLayer';

/**
 * SmartArtRenderer: Phase 2 Implementation
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
	/**
	 * When true, double-clicking a node opens an inline text editor. Disabled
	 * during presentation / readonly. Defaults to false.
	 */
	canEdit?: boolean;
	/**
	 * Commit a partial element update (e.g. new `smartArtData` after a node text
	 * edit) through the host's element-update path (undo/redo + save round-trip).
	 * Required for editing to take effect.
	 */
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	/**
	 * Playback state for the diagram. A staged diagram build
	 * (`build.kind === 'diagram'`) reveals the leading nodes / drawing shapes for
	 * the current progress; absent or non-diagram state renders every node.
	 */
	animationState?: ElementAnimationState;
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
	canEdit = false,
	onUpdateElement,
	animationState,
}: SmartArtRendererProps): React.ReactElement {
	const { t } = useTranslation();
	if (element.type !== 'smartArt' || !element.smartArtData) {
		return (
			<div
				className={`w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none ${className}`}
			>
				{t('pptx.smartArt.placeholder')}
			</div>
		);
	}

	const smartArtData = element.smartArtData;
	const { nodes, drawingShapes, chrome } = smartArtData;

	// Staged diagram build (p:bldDgm): reveal only the leading nodes / shapes for
	// the current playback progress. Non-diagram / absent state reveals all.
	const diagramBuild = animationState?.build?.kind === 'diagram' ? animationState.build : undefined;
	const shownNodeCount = diagramBuild
		? revealedSmartArtNodeCount(nodes, diagramBuild)
		: nodes.length;
	const isPartialBuild = diagramBuild !== undefined && shownNodeCount < nodes.length;
	const revealedNodes = isPartialBuild ? nodes.slice(0, shownNodeCount) : nodes;
	const revealedShapes =
		isPartialBuild && drawingShapes && drawingShapes.length > 0
			? drawingShapes.slice(
					0,
					Math.ceil((shownNodeCount / Math.max(nodes.length, 1)) * drawingShapes.length),
				)
			: drawingShapes;

	if (nodes.length === 0) {
		return (
			<div
				className={`w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none ${className}`}
			>
				{t('pptx.smartArt.placeholder')}
			</div>
		);
	}

	const palette = resolvePalette(element);
	const style = resolveStyle(element);

	// Accessibility view-model (container description + per-node labels by id).
	const a11y = buildSmartArtA11y(smartArtData);
	const nodeLabels = new Map(a11y.nodes.map((n) => [n.id, n.label]));

	const editable = canEdit && Boolean(onUpdateElement);

	// Commit an inline node text edit through the host's element-update path,
	// reusing the same core op the inspector uses (undo/redo + save round-trip).
	const handleCommitNodeText = (nodeId: string, text: string): void => {
		if (!onUpdateElement || !shouldCommitSmartArtNodeText(smartArtData, nodeId, text)) {
			return;
		}
		const updated = updateSmartArtNodeText(smartArtData, nodeId, text);
		const box = { width: element.width, height: element.height };
		const reflowed = rebuildDrawingShapesIfCleared(
			updated,
			smartArtData.layout,
			resolveSmartArtDataPalette(updated),
			style,
			element.id,
			box,
		);
		onUpdateElement({ smartArtData: reflowed } as Partial<PptxElement>);
	};

	// Commit a per-node fill colour change through the same element-update path.
	const handleChangeNodeStyle = (nodeId: string, fill: string): void => {
		if (!onUpdateElement) {
			return;
		}
		const next = setSmartArtNodeStyle(smartArtData, nodeId, { fillColor: fill });
		if (next !== smartArtData) {
			const box = { width: element.width, height: element.height };
			const reflowed = rebuildDrawingShapesIfCleared(
				next,
				smartArtData.layout,
				resolveSmartArtDataPalette(next),
				style,
				element.id,
				box,
			);
			onUpdateElement({ smartArtData: reflowed } as Partial<PptxElement>);
		}
	};

	// Prefer pre-computed drawing shapes when available; these reflect
	// PowerPoint's actual layout engine output and are the most accurate.
	let content: React.ReactElement;
	if (revealedShapes && revealedShapes.length > 0) {
		content = (
			<DrawingShapeRenderer
				elementId={element.id}
				shapes={revealedShapes}
				style={style}
				palette={palette}
				nodes={nodes}
				nodeLabels={nodeLabels}
			/>
		);
	} else {
		// Determine the layout category for algorithmic rendering. With a staged
		// build, `revealedNodes` may be empty (progress 0) or a leading prefix; the
		// layout renderers render nothing for an empty node list, which is exactly
		// the "not built yet" state while the wrapper is still fading in.
		const namedLayout = smartArtData.layout;
		const layoutType = namedLayout
			? layoutToCategory(namedLayout)
			: (smartArtData.resolvedLayoutType ?? smartArtData.layoutType ?? 'list').toLowerCase();

		content = renderLayout(layoutType, element, revealedNodes, palette, style, nodeLabels);
	}

	const body = editable ? (
		<SmartArtEditableLayer
			smartArtData={smartArtData}
			canEdit={editable}
			onCommitNodeText={handleCommitNodeText}
			palette={palette}
			onChangeNodeStyle={handleChangeNodeStyle}
		>
			{content}
		</SmartArtEditableLayer>
	) : (
		content
	);

	return wrapChrome(chrome, body, className, { role: a11y.role, label: a11y.label });
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
	nodeLabels: Map<string, string>,
): React.ReactElement {
	if (layoutType.includes('hierarchy') || layoutType.includes('org')) {
		return <HierarchyRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}
	if (
		layoutType.includes('process') ||
		layoutType.includes('chevron') ||
		layoutType.includes('arrow')
	) {
		return (
			<ProcessRenderer
				element={element}
				nodes={nodes}
				palette={palette}
				style={style}
				nodeLabels={nodeLabels}
			/>
		);
	}
	if (layoutType.includes('cycle') || layoutType.includes('radial')) {
		return (
			<CycleRenderer
				element={element}
				nodes={nodes}
				palette={palette}
				style={style}
				nodeLabels={nodeLabels}
			/>
		);
	}
	if (layoutType.includes('matrix')) {
		return (
			<MatrixRenderer
				element={element}
				nodes={nodes}
				palette={palette}
				style={style}
				nodeLabels={nodeLabels}
			/>
		);
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
	return (
		<ListRenderer
			element={element}
			nodes={nodes}
			palette={palette}
			style={style}
			nodeLabels={nodeLabels}
		/>
	);
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
	if (prev.canEdit !== next.canEdit) {
		return false;
	}
	if (prev.onUpdateElement !== next.onUpdateElement) {
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
	// A staged diagram build advances `build.progress` each RAF frame; re-render
	// whenever the reveal state changes so nodes appear progressively.
	const prevBuild = prev.animationState?.build;
	const nextBuild = next.animationState?.build;
	if (
		prevBuild?.kind !== nextBuild?.kind ||
		prevBuild?.mode !== nextBuild?.mode ||
		prevBuild?.progress !== nextBuild?.progress
	) {
		return false;
	}
	return true;
}

export const SmartArtRenderer = React.memo(SmartArtRendererImpl, arePropsEqual);

// ── Exported test utilities ─────────────────────────────────────────────────

/** @internal Exposed for testing */
export { fitFontSize, chevronPoints };
