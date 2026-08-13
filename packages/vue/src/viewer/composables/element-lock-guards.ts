/**
 * element-lock-guards.ts: mapping shared `a:spLocks` decisions onto the Vue
 * canvas gestures.
 *
 * The DECISION is never made here: `pptx-viewer-shared`'s `element-locks`
 * module owns the flag composition (`noSelect` subsumes everything, every other
 * flag gates exactly one gesture). What lives here is the small amount of glue
 * between that descriptor and the two shapes the Vue viewer needs it in: a
 * geometry patch to sanitise, and a per-selected-element lookup for the
 * selection overlay's template.
 *
 * Vue parsed `a:spLocks` and shipped an inspector Lock toggle that wrote
 * `locks` NOTHING on the canvas ever read, so a "locked" shape still dragged,
 * resized and rotated freely. These helpers are what closes that.
 *
 * @module composables/element-lock-guards
 */
import type { PptxElement } from 'pptx-viewer-core';
import { resolveElementInteractivity } from 'pptx-viewer-shared';
import type { ElementInteractivity } from 'pptx-viewer-shared';
import { computed } from 'vue';

/** The geometry a transform gesture reports, minus the element id. */
export interface GeometryBox {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

/**
 * Drop the parts of a live transform that the element's locks forbid, folding
 * each locked axis back to its value at gesture start.
 *
 * The start box (not the live element) is the reference on purpose: the live
 * element is patched on every pointermove, so comparing against it would only
 * ever block the first frame of a gesture.
 *
 * `x`/`y` move under EITHER gesture (dragging a NW handle walks the origin), so
 * the origin is pinned only when both move and resize are locked. That
 * approximation is unreachable from the UI anyway, because the overlay does not
 * render the handles of a shape that may not be resized; this is the
 * belt-and-braces layer behind it.
 */
export function applyGeometryLocks<T extends GeometryBox>(
	interactivity: ElementInteractivity,
	start: GeometryBox,
	patch: T,
): T {
	if (interactivity.movable && interactivity.resizable && interactivity.rotatable) {
		return patch;
	}
	const originPinned = !interactivity.movable && !interactivity.resizable;
	return {
		...patch,
		x: originPinned ? start.x : patch.x,
		y: originPinned ? start.y : patch.y,
		width: interactivity.resizable ? patch.width : start.width,
		height: interactivity.resizable ? patch.height : start.height,
		rotation: interactivity.rotatable ? patch.rotation : start.rotation,
	};
}

/** The plain geometry of an element, with rotation defaulted. */
export function geometryOf(element: PptxElement): GeometryBox {
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation ?? 0,
	};
}

/**
 * What each selected element still allows, keyed by id.
 *
 * The selection overlay renders one box per selected id and has to decide, per
 * box, whether to paint the eight resize handles and the rotate knob. Resolving
 * the whole map once per render keeps the SFC to a lookup.
 */
export function selectionInteractivityById(
	elements: readonly PptxElement[],
	selectedIds: readonly string[],
): Map<string, ElementInteractivity> {
	const wanted = new Set(selectedIds);
	const byId = new Map<string, ElementInteractivity>();
	for (const element of elements) {
		if (wanted.has(element.id)) {
			byId.set(element.id, resolveElementInteractivity(element));
		}
	}
	return byId;
}

/** The two per-box questions the selection overlay's template has to ask. */
export interface SelectionAffordances {
	/** Paint the eight resize handles for this box? */
	canResize: (id: string) => boolean;
	/** Paint the rotate stem + knob for this box? */
	canRotate: (id: string) => boolean;
}

/**
 * Reactive form of {@link selectionInteractivityById}: resolve the whole map
 * once per render and hand the overlay two predicates, so the SFC keeps no
 * derivation of its own.
 */
export function useSelectionAffordances(
	elements: () => readonly PptxElement[],
	selectedIds: () => readonly string[],
): SelectionAffordances {
	const byId = computed(() => selectionInteractivityById(elements(), selectedIds()));
	return {
		canResize: (id) => byId.value.get(id)?.resizable !== false,
		canRotate: (id) => byId.value.get(id)?.rotatable !== false,
	};
}
