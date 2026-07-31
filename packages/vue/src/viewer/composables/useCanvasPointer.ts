/**
 * useCanvasPointer: everything a pointer landing on the editable slide canvas
 * can mean.
 *
 * This is deliberately one composable rather than several: a single
 * `pointerdown` has to arbitrate between AI pick mode, the format painter, a
 * pending inline edit, touch double-tap, template-element locking, drag start
 * and rubber-band selection, and the ORDER of those checks is the behaviour.
 * Splitting them apart would hide that ordering.
 *
 * Extracted verbatim from `PowerPointViewer.vue`; every dependency arrives as a
 * getter or a ref so nothing is snapshotted at setup time.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { resolveTopLevelElementId } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import { isElementIdInteractive } from './template-editing';

/** Max gap between two taps for them to count as a double-tap. */
const DOUBLE_TAP_MS = 400;
/** px tolerance for matching the second tap after a selection-induced reflow. */
const TAP_DISTANCE = 40;

export interface UseCanvasPointerOptions {
	canEdit: () => boolean;
	editTemplateMode: Ref<boolean>;
	findActiveElement: (id: string) => PptxElement | undefined;
	/** Opens the equation editor instead of inline text edit; true when it handled the element. */
	openEquationEditorForElement: (element: PptxElement) => boolean;
	enterInlineEdit: (id: string) => void;
	inlineEditingElementId: Ref<string | null>;
	commitInlineEdit: () => void;
	cancelInlineEdit: () => void;
	formatPainterActive: Ref<boolean>;
	cancelFormatPainter: () => void;
	applyFormatToTarget: (id: string) => void;
	selectedElementIds: Ref<string[]>;
	selectElement: (id: string, additive: boolean) => void;
	clearSelection: () => void;
	activeSlideIndex: Ref<number>;
	/** AI "pick an element on the canvas" mode, when the host opted into `ai`. */
	aiPickMode: Ref<boolean>;
	addAiPick: (slideIndex: number, elementId: string) => void;
	startElementDrag: (id: string, event: PointerEvent, wasSelected: boolean) => void;
	beginMarquee: (event: PointerEvent) => void;
}

export interface UseCanvasPointerResult {
	/**
	 * Route a tap / double-click that should open an element for editing: an
	 * equation element opens the equation editor (inline text editing would only
	 * see the "[Equation]" placeholder and destroy the OMML on commit), everything
	 * else enters ordinary inline text editing.
	 */
	requestElementEdit: (id: string) => void;
	/** Double-clicking a rendered equation always opens its edit dialog. */
	onCanvasDoubleClick: (event: MouseEvent) => void;
	/** Click-to-select via event delegation (elements render `data-element-id`). */
	onCanvasPointerDown: (event: PointerEvent) => void;
	/** Escape: cancel a pending edit, then disarm the painter, then clear the selection. */
	onEscape: () => void;
}

export function useCanvasPointer(options: UseCanvasPointerOptions): UseCanvasPointerResult {
	// Touch double-tap detection (mirrors React/Angular canvas-level detection).
	// On mobile, native `dblclick` is not reliably synthesised from two quick taps,
	// so the last tap's element id and coordinates are tracked by hand. Plain
	// mutable state, never rendered, so it is not a ref.
	let lastCanvasTap: { id: string; time: number; x: number; y: number } | null = null;

	function requestElementEdit(id: string): void {
		const el = options.findActiveElement(id);
		if (el && options.openEquationEditorForElement(el)) {
			return;
		}
		options.enterInlineEdit(id);
	}

	function onCanvasDoubleClick(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		const id = target?.closest<HTMLElement>('[data-element-id]')?.dataset.elementId;
		if (!id) {
			return;
		}
		const element = options.findActiveElement(id);
		if (
			element &&
			hasTextProperties(element) &&
			(element.textSegments ?? []).some((segment) => segment.equationXml)
		) {
			requestElementEdit(id);
		}
	}

	function onEscape(): void {
		if (options.inlineEditingElementId.value) {
			options.cancelInlineEdit();
			return;
		}
		if (options.formatPainterActive.value) {
			options.cancelFormatPainter();
			return;
		}
		options.clearSelection();
	}

	/**
	 * Second tap of a touch double-tap: open the tapped thing for editing. A table
	 * routes to the nearest cell (after a selection reflow `elementFromPoint` may
	 * no longer hit the `<td>` directly), everything else to inline text edit.
	 * Returns true when the tap was consumed.
	 */
	function handleDoubleTap(event: PointerEvent, doubleTapId: string): boolean {
		const el = options.findActiveElement(doubleTapId);
		if (el?.type === 'table') {
			const tableHost = document.querySelector(`[data-element-id="${doubleTapId}"]`);
			const tds = tableHost?.querySelectorAll('td');
			let closestTd: HTMLElement | null = null;
			if (tds && tds.length > 0) {
				let minDist = Infinity;
				for (const td of tds) {
					const r = td.getBoundingClientRect();
					if (r.width === 0 || r.height === 0) {
						continue;
					}
					const cx = r.left + r.width / 2;
					const cy = r.top + r.height / 2;
					const dist = Math.hypot(event.clientX - cx, event.clientY - cy);
					if (dist < minDist) {
						minDist = dist;
						closestTd = td as HTMLElement;
					}
				}
			}
			if (closestTd) {
				closestTd.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
				return true;
			}
		}
		if (doubleTapId) {
			requestElementEdit(doubleTapId);
		}
		return true;
	}

	/**
	 * Touch/pen tap bookkeeping. Returns true when this tap completed a
	 * double-tap and the caller must stop (no selection / drag / marquee).
	 */
	function trackTap(event: PointerEvent, fallbackId: string | undefined): boolean {
		const now = event.timeStamp || Date.now();
		const last = lastCanvasTap;

		// Resolve the element id: prefer the event target's ancestry, but fall
		// back to elementFromPoint (covers cases where an overlay div intercepts).
		const hitEl = document.elementFromPoint(event.clientX, event.clientY);
		const target = event.target as HTMLElement | null;
		const hitElementId = resolveTopLevelElementId(hitEl) ?? resolveTopLevelElementId(target);
		const resolvedId =
			hitElementId && isElementIdInteractive(hitElementId, options.editTemplateMode.value)
				? hitElementId
				: fallbackId;

		// On the second tap, match against the first tap's element. Layout may
		// shift between taps (selection causing fitScale change), so the second
		// tap might not resolve to ANY element. Use proximity + the stored id.
		const isSameTarget =
			last &&
			now - last.time < DOUBLE_TAP_MS &&
			(resolvedId === last.id ||
				(Math.abs(event.clientX - last.x) < TAP_DISTANCE &&
					Math.abs(event.clientY - last.y) < TAP_DISTANCE));

		if (last && isSameTarget) {
			lastCanvasTap = null;
			return handleDoubleTap(event, resolvedId ?? last.id);
		}
		if (resolvedId) {
			lastCanvasTap = { id: resolvedId, time: now, x: event.clientX, y: event.clientY };
		} else if (last && now - last.time < DOUBLE_TAP_MS) {
			// Keep the previous tap alive if no element resolved (second tap in
			// reflowed area); the proximity check above will still match.
		} else {
			lastCanvasTap = null;
		}
		return false;
	}

	function onCanvasPointerDown(event: PointerEvent): void {
		if (!options.canEdit()) {
			return;
		}
		// Primary button only. A right-click also fires pointerdown, and this handler
		// replaces the selection with the element under it, so a right-click on one of
		// several selected shapes collapsed the selection to that one BEFORE the
		// contextmenu handler ran: the menu then saw a single element and offered no
		// Group. React, Svelte and Vanilla all filter the button here; Vue did not.
		// (Touch and pen both report button 0 on pointerdown, so they still pass.)
		if (event.button !== 0) {
			return;
		}
		const target = event.target as HTMLElement | null;
		// Top-level, not innermost. A group renders its children's element nodes
		// INSIDE its own, so `closest()` answers with a grouped CHILD, whose id
		// matches no top-level element: the selection then pointed at nothing, the
		// chrome never drew, and the context menu offered no Ungroup. PowerPoint
		// selects the group on a single click, and so do React, Vanilla and Svelte.
		const hitId = resolveTopLevelElementId(target);
		// Template (master/layout) elements are interaction-locked unless the user
		// turns on edit-template mode; a click on a locked one behaves like an
		// empty-canvas click (no select / drag / inline-edit).
		const id =
			hitId && isElementIdInteractive(hitId, options.editTemplateMode.value) ? hitId : undefined;

		// AI pick mode: the next canvas element click(s) become picks for the
		// assistant (multi-pick, deduped) instead of a normal selection/drag. Resolve
		// via elementFromPoint too so overlays do not swallow the hit.
		if (options.aiPickMode.value) {
			const pickId =
				resolveTopLevelElementId(document.elementFromPoint(event.clientX, event.clientY)) ?? hitId;
			if (pickId && isElementIdInteractive(pickId, options.editTemplateMode.value)) {
				event.preventDefault();
				options.addAiPick(options.activeSlideIndex.value, pickId);
			}
			return;
		}

		// On touch, if a table cell is being edited and the tap did NOT land inside
		// the cell input itself (the input stops its own pointerdown), the
		// TableRenderer's document-level pointerdown listener handles blur/commit.
		// (See TableRenderer.vue: docListener.)
		if (event.pointerType !== 'mouse' && trackTap(event, id)) {
			return;
		}

		// While inline-editing, a tap elsewhere (another element or empty canvas)
		// commits the pending edit first (the typed text must be kept).
		if (options.inlineEditingElementId.value && id !== options.inlineEditingElementId.value) {
			options.commitInlineEdit();
		}
		// Format painter intercepts the next click: apply to a target element, then
		// disarm; an empty-canvas click just disarms.
		if (options.formatPainterActive.value) {
			if (id) {
				options.applyFormatToTarget(id);
			}
			options.cancelFormatPainter();
			return;
		}
		const additive = event.shiftKey || event.ctrlKey || event.metaKey;
		if (id) {
			const ids = options.selectedElementIds.value;
			const wasSelected = !additive && ids.length === 1 && ids[0] === id;
			if (!wasSelected) {
				options.selectElement(id, additive);
			}
			// Drive move (drag) + inline-edit entry from the element itself. A tap
			// without drag on an already-selected element enters inline edit.
			if (!additive) {
				options.startElementDrag(id, event, wasSelected);
			}
		} else {
			// Empty canvas: start a rubber band. It resolves on pointerup, replacing
			// (or extending, with a modifier) the selection with whatever it covered;
			// a click-sized band therefore also clears, as the bare click used to.
			options.clearSelection();
			options.beginMarquee(event);
		}
	}

	return { requestElementEdit, onCanvasDoubleClick, onCanvasPointerDown, onEscape };
}
