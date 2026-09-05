import type { PptxElement } from 'pptx-viewer-core';
import { updateSmartArtNodeText, setSmartArtNodeStyle } from 'pptx-viewer-core';
import {
	buildSmartArtA11y,
	canDrillDown,
	computeSmartArtElementLayout,
	flattenNodes,
	resolveRevealedDrawingShapes,
	resolveRevealedSmartArtNodes,
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
} from '../../utils/smartart-helpers';
import { DrawingShapeRenderer } from './smartart-drawing-shape-renderer';
// Sub-module imports
import { wrapChrome, fitFontSize, chevronPoints } from './smartart-renderer-utils';
import { SmartArtEditableLayer } from './SmartArtEditableLayer';
import { SmartArtLayoutSvg } from './SmartArtLayoutSvg';

/**
 * SmartArtRenderer.
 *
 * Renders a SmartArt diagram, preferring PowerPoint's own cached geometry and
 * falling back to the shared layout engine when the deck has none.
 *
 * Two render paths, in order:
 *
 * 1. **Cached `dsp` drawing shapes** (`smartArtData.drawingShapes`, extracted
 *    from `ppt/diagrams/drawing*.xml`). These are PowerPoint's actual layout
 *    output and are always preferred. A text edit patches them in place, so the
 *    path stays current.
 * 2. **Shared layout engine** (`computeSmartArtElementLayout`), used only when
 *    the cached drawing is absent (freshly inserted SmartArt, or a diagram
 *    whose structural edit cleared it). That engine runs the real DiagramML
 *    interpreter over the file's `dgm:layoutDef` first and only then falls back
 *    to a family approximation, and it is the same call Vue, Angular, Svelte
 *    and Vanilla make, so all five bindings draw the same diagram (including
 *    the `colorsDef @meth="span"` colour-interpolation it derives from
 *    `smartArtData.colorTransform`).
 *
 * React used to own a private JSX tree of ~20 hand-written layout pictures for
 * path 2 which never consulted `dgm:layoutDef` at all. It has been deleted; the
 * three arrangements it genuinely had that the shared engine did not (gear,
 * timeline, bending/snake) were lifted into shared instead, so all five
 * bindings gained them.
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
	// the current playback progress, preferring the AUTHORED per-node
	// `p:graphicEl/@id` reveal set (animationState.diagramReveal) over the
	// click-count estimate when available. Non-diagram / absent state reveals all.
	const { nodes: revealedNodes } = resolveRevealedSmartArtNodes(
		nodes,
		animationState,
		smartArtData.presLayoutVars,
	);
	const revealedShapes =
		drawingShapes && drawingShapes.length > 0
			? resolveRevealedDrawingShapes(drawingShapes, nodes, animationState)
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

	// G8: `a:graphicFrameLocks/@noDrilldown` forbids entering this SmartArt's
	// individual nodes for editing.
	const editable = canEdit && Boolean(onUpdateElement) && canDrillDown(element);

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
				allShapes={drawingShapes}
				style={style}
				palette={palette}
				nodes={nodes}
				nodeLabels={nodeLabels}
			/>
		);
	} else {
		// No cached drawing: run the shared engine (DiagramML interpreter first,
		// family approximation second). With a staged build, `revealedNodes` may
		// be empty (progress 0) or a leading prefix; an empty node list yields an
		// empty layout, which is exactly the "not built yet" state while the
		// wrapper is still fading in.
		const layout = computeSmartArtElementLayout(
			smartArtData,
			revealedNodes,
			{ width: element.width, height: element.height },
			palette,
			style,
			element.id,
		);
		// Rendered nodes are index-aligned with the flattened source nodes, which
		// is how every binding maps a rendered shape back to a model node id.
		const nodeIds = flattenNodes(revealedNodes).map((n) => n.id);
		content = <SmartArtLayoutSvg layout={layout} nodeIds={nodeIds} nodeLabels={nodeLabels} />;
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
	// The authored per-node reveal set (`p:graphicEl/@id`) arrives WITHOUT a
	// `build` descriptor before the first click (nothing has fired yet, so the
	// engine hands out an empty node set and no active step). Comparing `build`
	// alone kept the fully-populated first render on screen behind the hidden
	// wrapper, so the show stage still carried every node in the DOM.
	return sameDiagramReveal(prev.animationState?.diagramReveal, next.animationState?.diagramReveal);
}

/**
 * Structural equality for two reveal descriptors: the engine allocates a fresh
 * descriptor on every state snapshot, so identity alone would defeat the memo.
 */
function sameDiagramReveal(
	prev: ElementAnimationState['diagramReveal'],
	next: ElementAnimationState['diagramReveal'],
): boolean {
	if (prev === next) {
		return true;
	}
	if (!prev || !next) {
		return false;
	}
	if (prev.mode !== next.mode || prev.descriptor.background !== next.descriptor.background) {
		return false;
	}
	const prevIds = prev.descriptor.nodeIds;
	const nextIds = next.descriptor.nodeIds;
	if (prevIds.size !== nextIds.size) {
		return false;
	}
	for (const id of prevIds) {
		if (!nextIds.has(id)) {
			return false;
		}
	}
	return true;
}

export const SmartArtRenderer = React.memo(SmartArtRendererImpl, arePropsEqual);

// ── Exported test utilities ─────────────────────────────────────────────────

/** @internal Exposed for testing */
export { fitFontSize, chevronPoints };
