import type { PptxElement } from 'pptx-viewer-core';
import { resolveElementInteractivity } from 'pptx-viewer-shared';
import React from 'react';

import { MIN_ELEMENT_SIZE } from '../../constants';
import type { ShapeAdjustmentHandleDescriptor } from '../../types';
import { getElementTransform, getElementTransformWithoutRotation } from '../../utils';
import { ResizeHandles } from '../elements/ResizeHandles';

export interface SelectionHandleOverlayProps {
	/** The single selected element the handles belong to. */
	element: PptxElement;
	/** Every `a:avLst` handle this element offers (empty when it has none). */
	adjustmentHandles: ShapeAdjustmentHandleDescriptor[];
	onResizePointerDown: (elementId: string, e: React.MouseEvent, handle: string) => void;
	onAdjustmentPointerDown: (
		elementId: string,
		e: React.MouseEvent,
		descriptor: ShapeAdjustmentHandleDescriptor,
	) => void;
	onRotate?: (elementId: string, rotationDeg: number) => void;
	/**
	 * The same per-element click/dblclick/contextmenu callbacks
	 * `ElementRenderer`'s own container would otherwise receive, forwarded here
	 * with the already-known `element.id`.
	 *
	 * The rotate handle is deliberately drawn overlapping the element's own box
	 * ("it stays reliably hit-testable", see `ResizeHandles`), and its invisible
	 * enlarged hit area reaches even further in - for a short element that
	 * region can cover the box's own centre. Every handle's `onMouseDown`
	 * already calls `stopPropagation`, so a drag never depended on bubbling to
	 * the shape; a `click`/`dblclick`/`contextmenu` that lands there without
	 * ever moving the pointer is a different browser-native event with no
	 * handler in its way, and it bubbles looking for a listener. Nested inside
	 * `ElementRenderer`'s own div (the pre-existing structure) that listener
	 * was the shape's own; hosted here, as a stage-level sibling, it is not.
	 * `SlideCanvas`'s stage-level delegation (`getElementIdFromEvent`) cannot
	 * stand in for it either: it resolves an event's element by walking up to
	 * the nearest `data-pptx-element="true"` ancestor, and this host is
	 * deliberately NOT marked that way (see the render below), so without this
	 * explicit forward a right-click landing on the overlap missed the shape's
	 * menu entirely (`context-menu-parity.spec.ts`: "Escape and an outside
	 * click both dismiss the menu", the reopen step).
	 */
	onClick: (elementId: string, e: React.MouseEvent) => void;
	onDoubleClick: (elementId: string, e: React.MouseEvent) => void;
	onContextMenu: (elementId: string, e: React.MouseEvent) => void;
}

/**
 * Resize / rotate / adjustment handles for the single selected element,
 * mounted as a STAGE-level sibling of `ElementRenderer` (in `SlideCanvas`,
 * alongside `ConnectorEndpointOverlay` and `MotionPathOverlay`) rather than
 * as its child.
 *
 * `ElementRenderer`'s own container carries the preset's `clip-path`
 * (`shapeVisualStyle`'s clipPath cascade, e.g. for `rightArrow`) so a click in
 * a non-rectangular shape's dead space falls through to whatever is behind
 * it, matching PowerPoint. `clip-path` excludes every DESCENDANT from
 * hit-testing wherever it falls outside the polygon, not just from paint, and
 * there is no per-descendant CSS escape from an ancestor's clip. An
 * adjustment handle is deliberately measured onto a preset geometry VERTEX
 * (PowerPoint's own convention), and for a preset like `rightArrow` that
 * vertex sits exactly on a sharp convex corner of the clip polygon, so a
 * handle nested inside the clipped container had roughly half its hit area,
 * including its own centre, excluded from hit-testing (confirmed via
 * `document.elementFromPoint` at the handle's centre: the click landed on an
 * unrelated shape's text behind it instead of the handle). Hosting every
 * handle here, unclipped, fixes that uniformly rather than only for the one
 * preset a spec happens to catch it on.
 *
 * Deliberately does NOT touch `ElementRenderer`'s own container div: that
 * div's class/style pointer-events rules make exactly the shape's own
 * silhouette clickable (hollow-shape frames, presentation hit-testing, action
 * shapes), which is a different, unrelated concern from where the shape's
 * auxiliary handle UI paints.
 *
 * Not used for connectors: `ConnectorElementRenderer` renders its own
 * (unclipped) `ResizeHandles` internally, since a connector has no fill/clip
 * to escape.
 */
export function SelectionHandleOverlay({
	element,
	adjustmentHandles,
	onResizePointerDown,
	onAdjustmentPointerDown,
	onRotate,
	onClick,
	onDoubleClick,
	onContextMenu,
}: SelectionHandleOverlayProps): React.ReactElement {
	const allow = resolveElementInteractivity(element);
	return (
		<div
			data-element-id={element.id}
			data-pptx-selection-handle-host='true'
			style={{
				position: 'absolute',
				left: element.x,
				top: element.y,
				width: Math.max(element.width, MIN_ELEMENT_SIZE),
				height: Math.max(element.height, MIN_ELEMENT_SIZE),
				transform: getElementTransform(element),
				transformOrigin: 'center',
				// Transparent everywhere a handle button is not, so a click that
				// misses every handle still reaches the shape (or whatever is
				// behind it) exactly as if this host did not exist. `ResizeHandles`
				// renders with `forcePointerEvents` so its own buttons opt back in.
				pointerEvents: 'none',
			}}
			onClick={(e) => onClick(element.id, e)}
			onDoubleClick={(e) => onDoubleClick(element.id, e)}
			onContextMenu={(e) => onContextMenu(element.id, e)}
		>
			<ResizeHandles
				elementId={element.id}
				adjustmentHandles={adjustmentHandles}
				onResizePointerDown={onResizePointerDown}
				onAdjustmentPointerDown={onAdjustmentPointerDown}
				rotation={element.rotation}
				nonRotationTransform={getElementTransformWithoutRotation(element)}
				onRotate={allow.rotatable ? onRotate : undefined}
				forcePointerEvents
			/>
		</div>
	);
}
