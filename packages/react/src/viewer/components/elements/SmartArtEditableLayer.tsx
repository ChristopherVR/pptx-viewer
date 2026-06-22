import type { PptxSmartArtData } from 'pptx-viewer-core';
import { computeInlineEditorRect, findSmartArtNodeText } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import React from 'react';

import { SmartArtInlineNodeEditor } from './SmartArtInlineNodeEditor';

// ── Props ───────────────────────────────────────────────────────────────────

interface SmartArtEditableLayerProps {
	/** Current SmartArt data (used to resolve the editing node's initial text). */
	smartArtData: PptxSmartArtData;
	/** Whether inline editing is allowed (false during presentation / readonly). */
	canEdit: boolean;
	/** Commit edited node text through the host's element-update path. */
	onCommitNodeText: (nodeId: string, text: string) => void;
	/** The rendered SmartArt SVG content (node groups tagged with data attrs). */
	children: React.ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Attribute carried by each rendered node group so clicks map back to a node. */
const NODE_ID_ATTR = 'data-smartart-node-id';

/** Walk up from an event target to the nearest element bearing a node id. */
function findNodeIdFromEvent(target: EventTarget | null): Element | null {
	let el = target instanceof Element ? target : null;
	while (el) {
		if (el.hasAttribute(NODE_ID_ATTR)) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
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
 * When `canEdit` is false this is an inert pass-through wrapper.
 */
export function SmartArtEditableLayer({
	smartArtData,
	canEdit,
	onCommitNodeText,
	children,
}: SmartArtEditableLayerProps): React.ReactNode {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [edit, setEdit] = React.useState<{ nodeId: string; rect: InlineEditRect } | null>(null);

	const openEditor = React.useCallback((target: EventTarget | null): void => {
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
		setEdit({ nodeId, rect });
	}, []);

	if (!canEdit) {
		return children;
	}

	const initialText = edit ? (findSmartArtNodeText(smartArtData, edit.nodeId) ?? '') : '';

	return (
		<div
			ref={containerRef}
			className='relative h-full w-full'
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
			{children}
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
