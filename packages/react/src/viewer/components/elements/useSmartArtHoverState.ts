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
	/**
	 * mousemove handler to attach to the container div.
	 *
	 * `ignoreRef`, when given, names an element (e.g. a popover anchored to the
	 * hovered node, like the style bar) whose own bounds should not clear the
	 * hover state - the pointer is still "on" the hovered node as far as the UI
	 * is concerned while it sits over that element.
	 */
	handleMouseMove: (
		e: React.MouseEvent<HTMLDivElement>,
		ignoreRef?: React.RefObject<HTMLElement | null>,
	) => void;
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
	// Pending "leave" timeout: gives the pointer a brief grace period to reach a
	// popover anchored to the node (e.g. crossing the small visual gap between a
	// node and its floating style bar) without the hover state clearing first.
	const hideTimeoutRef = React.useRef<number | null>(null);

	const cancelPendingHide = React.useCallback((): void => {
		if (hideTimeoutRef.current !== null) {
			window.clearTimeout(hideTimeoutRef.current);
			hideTimeoutRef.current = null;
		}
	}, []);

	const handleMouseMove = React.useCallback(
		(
			e: React.MouseEvent<HTMLDivElement>,
			ignoreRef?: React.RefObject<HTMLElement | null>,
		): void => {
			const nodeEl = findNodeIdFromEvent(e.target);
			const container = containerRef.current;
			if (nodeEl && container) {
				cancelPendingHide();
				setHoveredNodeId(nodeEl.getAttribute(NODE_ID_ATTR));
				setHoveredNodeRect(
					computeInlineEditorRect(
						nodeEl.getBoundingClientRect(),
						container.getBoundingClientRect(),
					),
				);
				return;
			}
			// Pointer is over a popover anchored to the currently-hovered node
			// (not the node itself) - keep the existing hover state so the
			// popover doesn't unmount out from under the pointer.
			if (ignoreRef?.current && e.target instanceof Node && ignoreRef.current.contains(e.target)) {
				cancelPendingHide();
				return;
			}
			cancelPendingHide();
			hideTimeoutRef.current = window.setTimeout(() => {
				setHoveredNodeId(null);
				setHoveredNodeRect(null);
				hideTimeoutRef.current = null;
			}, 150);
		},
		[containerRef, cancelPendingHide],
	);

	const clearHover = React.useCallback((): void => {
		cancelPendingHide();
		setHoveredNodeId(null);
		setHoveredNodeRect(null);
	}, [cancelPendingHide]);

	React.useEffect(() => cancelPendingHide, [cancelPendingHide]);

	return { hoveredNodeId, hoveredNodeRect, handleMouseMove, clearHover };
}
