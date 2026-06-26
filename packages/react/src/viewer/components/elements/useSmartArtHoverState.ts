/**
 * Hook that tracks which SmartArt node is currently hovered and projects
 * its bounding box into container-local coordinates ready for overlay
 * positioning (style bar, editor rect).
 *
 * Extracted from SmartArtEditableLayer to keep that file within the
 * per-file line budget.
 *
 * @module useSmartArtHoverState
 */

import { computeInlineEditorRect } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import React from 'react';

// ── Shared attribute constant ─────────────────────────────────────────────────

/** Attribute carried by each rendered node group so pointer events map back to a node. */
export const NODE_ID_ATTR = 'data-smartart-node-id';

// ── Shared helper ─────────────────────────────────────────────────────────────

/** Walk up from an event target to the nearest element bearing a node id. */
export function findNodeIdFromEvent(target: EventTarget | null): Element | null {
	let el = target instanceof Element ? target : null;
	while (el) {
		if (el.hasAttribute(NODE_ID_ATTR)) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

// ── Hook return type ──────────────────────────────────────────────────────────

export interface SmartArtHoverState {
	/** The id of the node currently under the pointer, or null when none. */
	hoveredNodeId: string | null;
	/** Container-local bounding rect of the hovered node, or null when none. */
	hoveredNodeRect: InlineEditRect | null;
	/** mousemove handler to attach to the container div. */
	handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
	/** Clears both hoveredNodeId and hoveredNodeRect (use on mouseleave or editor open). */
	clearHover: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Tracks which SmartArt node group is under the pointer and provides
 * its bounding rect projected into the container's local coordinate space.
 *
 * @param containerRef - Ref to the wrapping div (used for coordinate projection).
 */
export function useSmartArtHoverState(
	containerRef: React.RefObject<HTMLDivElement | null>,
): SmartArtHoverState {
	const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
	const [hoveredNodeRect, setHoveredNodeRect] = React.useState<InlineEditRect | null>(null);

	const handleMouseMove = React.useCallback(
		(e: React.MouseEvent<HTMLDivElement>): void => {
			const nodeEl = findNodeIdFromEvent(e.target);
			const nodeId = nodeEl?.getAttribute(NODE_ID_ATTR) ?? null;
			setHoveredNodeId(nodeId);
			const container = containerRef.current;
			if (nodeEl && container) {
				setHoveredNodeRect(
					computeInlineEditorRect(
						nodeEl.getBoundingClientRect(),
						container.getBoundingClientRect(),
					),
				);
			} else {
				setHoveredNodeRect(null);
			}
		},
		[containerRef],
	);

	const clearHover = React.useCallback((): void => {
		setHoveredNodeId(null);
		setHoveredNodeRect(null);
	}, []);

	return { hoveredNodeId, hoveredNodeRect, handleMouseMove, clearHover };
}
