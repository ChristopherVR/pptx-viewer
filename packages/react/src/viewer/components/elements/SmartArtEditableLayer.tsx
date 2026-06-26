import type { PptxSmartArtData } from 'pptx-viewer-core';
import { computeInlineEditorRect, findSmartArtNodeText } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import React from 'react';

import { SmartArtInlineNodeEditor } from './SmartArtInlineNodeEditor';
import { SmartArtNodeStyleBar } from './SmartArtNodeStyleBar';
import {
	NODE_ID_ATTR,
	findNodeIdFromEvent,
	useSmartArtHoverState,
} from './useSmartArtHoverState';

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
	const [edit, setEdit] = React.useState<{ nodeId: string; rect: InlineEditRect } | null>(null);

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
			const rect = computeInlineEditorRect(
				nodeEl.getBoundingClientRect(),
				container.getBoundingClientRect(),
			);
			clearHover();
			setEdit({ nodeId, rect });
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
			onMouseMove={handleMouseMove}
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
			{showStyleBar && (
				<div
					style={{
						position: 'absolute',
						left: hoveredNodeRect.left + hoveredNodeRect.width - 120,
						top: Math.max(0, hoveredNodeRect.top - 22),
						zIndex: 10,
					}}
				>
					<SmartArtNodeStyleBar
						palette={palette}
						onPickFill={(color) => onChangeNodeStyle(hoveredNodeId, color)}
					/>
				</div>
			)}
			{edit && (
				<SmartArtInlineNodeEditor
					key={edit.nodeId}
					initialText={initialText}
					rect={edit.rect}
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
