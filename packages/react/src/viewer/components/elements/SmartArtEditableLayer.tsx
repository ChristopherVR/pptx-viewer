import type { PptxSmartArtData } from 'pptx-viewer-core';
import { computeInlineEditorRect, findSmartArtNodeText } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import React from 'react';

import { SmartArtInlineNodeEditor } from './SmartArtInlineNodeEditor';
import { SmartArtNodeStyleBar } from './SmartArtNodeStyleBar';
import { NODE_ID_ATTR, findNodeIdFromEvent, useSmartArtHoverState } from './useSmartArtHoverState';

// ── Constants ───────────────────────────────────────────────────────────────

/** Comfortable click/edit margin added around the tight text bounding box. */
const EDITOR_PADDING = 4;
/** Matches SmartArtNodeText's line-height multiplier so wrapping lines up. */
const LINE_HEIGHT_RATIO = 1.2;
/** Approximate rendered size of the style bar (6 swatches + padding/border). */
const STYLE_BAR_WIDTH = 168;
const STYLE_BAR_HEIGHT = 40;

// ── Props ───────────────────────────────────────────────────────────────────

interface SmartArtEditableLayerProps {
	/** Current SmartArt data (used to resolve the editing node's initial text). */
	smartArtData: PptxSmartArtData;
	/** Whether inline editing is allowed (false during presentation / readonly). */
	canEdit: boolean;
	/** Commit edited node text through the host's element-update path. */
	onCommitNodeText: (nodeId: string, text: string) => void;
	/** Resolved palette colours (hex strings) for the swatch bar. */
	palette?: string[];
	/** Commit a per-node fill colour change. */
	onChangeNodeStyle?: (nodeId: string, fill: string) => void;
	/** The rendered SmartArt SVG content (node groups tagged with data attrs). */
	children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Wraps rendered SmartArt content and adds inline (on-canvas) node text editing.
 *
 * Node groups in every layout renderer are tagged with `data-smartart-node-id`.
 * A single delegated double-click handler resolves the clicked node, projects
 * its on-screen box into container-local coordinates (so it survives zoom), and
 * opens a {@link SmartArtInlineNodeEditor} positioned over the node. Commit
 * flows through `onCommitNodeText`, which the host wires to the same element
 * update path the inspector uses (undo/redo + save round-trip).
 *
 * When both `palette` and `onChangeNodeStyle` are provided, hovering a node
 * also shows a {@link SmartArtNodeStyleBar} floating above it for quick
 * per-node fill colour picking (single-click, no text editor needed).
 *
 * Hover tracking is delegated to {@link useSmartArtHoverState}.
 *
 * When `canEdit` is false this is an inert pass-through wrapper.
 */
export function SmartArtEditableLayer({
	smartArtData,
	canEdit,
	onCommitNodeText,
	palette,
	onChangeNodeStyle,
	children,
}: SmartArtEditableLayerProps): React.ReactNode {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	// Anchors the style-bar popover; mousemove events landing inside it must not
	// clear the hover state, or the popover would unmount as soon as the
	// pointer reaches the swatches it needs to be clicked.
	const styleBarRef = React.useRef<HTMLDivElement | null>(null);
	const [edit, setEdit] = React.useState<{
		nodeId: string;
		rect: InlineEditRect;
		fontSize?: number;
	} | null>(null);

	const { hoveredNodeId, hoveredNodeRect, handleMouseMove, clearHover } =
		useSmartArtHoverState(containerRef);

	const openEditor = React.useCallback(
		(target: EventTarget | null): void => {
			const nodeEl = findNodeIdFromEvent(target);
			const container = containerRef.current;
			if (!nodeEl || !container) {
				return;
			}
			const nodeId = nodeEl.getAttribute(NODE_ID_ATTR);
			if (!nodeId) {
				return;
			}
			// Prefer the actual rendered <text> element's tight bounding box over
			// the node group's box: several layouts (gear, timeline, ...) tag a
			// group that also contains non-text decoration (stems, dots, teeth)
			// whose box is much larger than, and offset from, where the text
			// itself is drawn. Falls back to the group box when there's no text
			// node yet (e.g. an empty node being given its first label).
			const textEl = nodeEl.querySelector('text');
			const textRect = textEl?.getBoundingClientRect();
			const hasTextRect = textRect !== undefined && textRect.width > 0 && textRect.height > 0;
			const sourceRect = hasTextRect ? textRect : nodeEl.getBoundingClientRect();
			const rect = computeInlineEditorRect(sourceRect, container.getBoundingClientRect());
			const paddedRect: InlineEditRect = {
				left: rect.left - EDITOR_PADDING,
				top: rect.top - EDITOR_PADDING,
				width: rect.width + EDITOR_PADDING * 2,
				height: rect.height + EDITOR_PADDING * 2,
			};
			// Approximate the on-screen font size from the measured text box so
			// the overlay's typography doesn't visibly jump relative to the
			// rendered text underneath (each layout picks its own per-node size).
			const lineCount = Math.max(1, textEl?.querySelectorAll('tspan').length ?? 1);
			const fontSize = hasTextRect
				? Math.max(8, textRect.height / (lineCount * LINE_HEIGHT_RATIO))
				: undefined;
			clearHover();
			setEdit({ nodeId, rect: paddedRect, fontSize });
		},
		[clearHover],
	);

	if (!canEdit) {
		return children;
	}

	const initialText = edit ? (findSmartArtNodeText(smartArtData, edit.nodeId) ?? '') : '';

	const showStyleBar =
		!edit &&
		hoveredNodeId !== null &&
		hoveredNodeRect !== null &&
		palette !== undefined &&
		onChangeNodeStyle !== undefined;

	return (
		<div
			ref={containerRef}
			className='relative h-full w-full'
			style={{ cursor: hoveredNodeId ? 'text' : undefined }}
			onMouseMove={(e) => handleMouseMove(e, styleBarRef)}
			onMouseLeave={clearHover}
			// Editing is a deliberate double-click; single clicks still select /
			// drag the SmartArt element via the parent handlers.
			onDoubleClick={(e) => {
				const nodeEl = findNodeIdFromEvent(e.target);
				if (nodeEl) {
					e.stopPropagation();
					openEditor(e.target);
				}
			}}
		>
			{!edit && (
				<style>{`[data-smartart-node-id]:hover { outline: 2px solid rgba(96,165,250,0.6); outline-offset: 1px; }`}</style>
			)}
			{children}
			{showStyleBar &&
				(() => {
					const container = containerRef.current;
					const maxLeft = Math.max(
						0,
						(container?.clientWidth ?? STYLE_BAR_WIDTH) - STYLE_BAR_WIDTH,
					);
					const maxTop = Math.max(
						0,
						(container?.clientHeight ?? STYLE_BAR_HEIGHT) - STYLE_BAR_HEIGHT,
					);
					return (
						<div
							ref={styleBarRef}
							style={{
								position: 'absolute',
								left: Math.min(
									maxLeft,
									Math.max(0, hoveredNodeRect.left + hoveredNodeRect.width - STYLE_BAR_WIDTH),
								),
								top: Math.min(maxTop, Math.max(0, hoveredNodeRect.top - 22)),
								zIndex: 10,
							}}
						>
							<SmartArtNodeStyleBar
								palette={palette}
								onPickFill={(color) => onChangeNodeStyle(hoveredNodeId, color)}
							/>
						</div>
					);
				})()}
			{edit && (
				<SmartArtInlineNodeEditor
					key={edit.nodeId}
					initialText={initialText}
					rect={edit.rect}
					fontSize={edit.fontSize}
					onCommit={(text) => {
						onCommitNodeText(edit.nodeId, text);
						setEdit(null);
					}}
					onCancel={() => setEdit(null)}
				/>
			)}
		</div>
	);
}
