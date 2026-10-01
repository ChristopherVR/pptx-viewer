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
import {
	canInteractWithElement,
	drillSelectionForClick,
	drillSelectionForDoubleClick,
	findElementPath,
	isEnterableGroup,
	memberChainAtPoint,
	parentSelection,
	resolveTopLevelElementId,
	setPendingCaretPoint,
} from 'pptx-viewer-shared';
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
	/**
	 * The active slide's top-level elements, for selecting inside a group
	 * (shared `group-drill`): with a group selected, a press selects the member
	 * under the pointer. Omitted, a group always selects as one.
	 */
	slideElements?: () => readonly PptxElement[] | undefined;
	/** The slide's authored size, to map a client point into slide space. */
	canvasSize?: () => { width: number; height: number };
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
	/**
	 * Escape: cancel a pending edit, then disarm the painter, then step a member
	 * selected inside a group out to its group, then clear the selection.
	 */
	onEscape: () => void;
}

export function useCanvasPointer(options: UseCanvasPointerOptions): UseCanvasPointerResult {
	// Touch double-tap detection (mirrors React/Angular canvas-level detection).
	// On mobile, native `dblclick` is not reliably synthesised from two quick taps,
	// so the last tap's element id and coordinates are tracked by hand. Plain
	// mutable state, never rendered, so it is not a ref.
	let lastCanvasTap: { id: string; time: number; x: number; y: number } | null = null;

	/**
	 * The id a press on `hitId` may act on, or undefined when nothing on the
	 * canvas is allowed to claim it.
	 *
	 * Two gates, in order. Template (master/layout) elements are inert unless the
	 * user turned on edit-template mode. Then `a:spLocks/@noSelect`: PowerPoint
	 * makes such a shape unclickable outright, and Vue read that flag nowhere, so
	 * a "locked" shape still selected, dragged and resized like any other.
	 */
	function interactiveIdFor(hitId: string | null | undefined): string | undefined {
		if (!hitId || !isElementIdInteractive(hitId, options.editTemplateMode.value)) {
			return undefined;
		}
		return canInteractWithElement(options.findActiveElement(hitId), 'select') ? hitId : undefined;
	}

	/**
	 * The slide-space point under a pointer event. The stage is scaled by a CSS
	 * transform, so its rendered width over its authored width is the true
	 * factor (the same measure `useMarqueeSelection` uses).
	 */
	function slidePoint(event: MouseEvent): { x: number; y: number } | null {
		const target = event.target instanceof Element ? event.target : null;
		const stage = target?.closest<HTMLElement>('[aria-roledescription="slide"]');
		const rect = stage?.getBoundingClientRect();
		const size = options.canvasSize?.();
		if (!rect || !size || rect.width <= 0) {
			return null;
		}
		const scale = rect.width / Math.max(size.width, 1);
		return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
	}

	/** The ids under the pointer inside the group `topId`, innermost first; null when it can't be entered. */
	function drillChain(topId: string, event: MouseEvent): string[] | null {
		const elements = options.slideElements?.();
		const top = elements?.find((el) => el.id === topId);
		if (!elements || !top || !isEnterableGroup(top)) {
			return null;
		}
		const point = slidePoint(event);
		return point ? memberChainAtPoint(elements, topId, point) : null;
	}

	/** A drilled-to member, or the top-level id when the member may not be selected. */
	function selectableOr(memberId: string | null, topId: string): string {
		if (!memberId || memberId === topId) {
			return topId;
		}
		return canInteractWithElement(options.findActiveElement(memberId), 'select') ? memberId : topId;
	}

	/**
	 * What a press on the top-level element `topId` selects, PowerPoint-style: a
	 * group first, then -- once it's selected -- the member under the pointer; a
	 * press on another member of the entered group moves to that member.
	 */
	function resolvePressTarget(topId: string, event: PointerEvent): string {
		const chain = drillChain(topId, event);
		const elements = options.slideElements?.();
		if (!chain || !elements) {
			return topId;
		}
		const ids = options.selectedElementIds.value;
		const selectedPath = ids.length === 1 ? findElementPath(elements, ids[0]) : null;
		return selectableOr(drillSelectionForClick(chain, selectedPath), topId);
	}

	/** A double-click on a group goes straight to the innermost member under the pointer. */
	function resolveDoubleClickTarget(topId: string, event: MouseEvent): string {
		const chain = drillChain(topId, event);
		return selectableOr(chain ? drillSelectionForDoubleClick(chain) : null, topId);
	}

	function requestElementEdit(id: string): void {
		const el = options.findActiveElement(id);
		if (el && options.openEquationEditorForElement(el)) {
			return;
		}
		options.enterInlineEdit(id);
	}

	function onCanvasDoubleClick(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		// A double-click on a group edits the member under the pointer directly,
		// without ungrouping (PowerPoint does the same).
		const topId = options.canEdit()
			? interactiveIdFor(resolveTopLevelElementId(target))
			: undefined;
		const memberId = topId ? resolveDoubleClickTarget(topId, event) : undefined;
		if (topId && memberId && memberId !== topId) {
			if (options.inlineEditingElementId.value === memberId) {
				return;
			}
			options.selectElement(memberId, false);
			// Caret at the END, as for any double-click (typing appends).
			requestElementEdit(memberId);
			return;
		}
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
		// A member selected inside a group steps back out to its group first
		// (shared `parentSelection`); a top-level selection clears.
		const elements = options.slideElements?.();
		const ids = options.selectedElementIds.value;
		const parent = elements && ids.length === 1 ? parentSelection(elements, ids[0]) : null;
		if (parent) {
			options.selectElement(parent, false);
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
		const resolvedId = interactiveIdFor(hitElementId) ?? fallbackId;

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
			const tapId = resolvedId ?? last.id;
			const memberId = resolveDoubleClickTarget(tapId, event);
			if (memberId !== tapId) {
				options.selectElement(memberId, false);
				requestElementEdit(memberId);
				return true;
			}
			return handleDoubleTap(event, tapId);
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
		// turns on edit-template mode, and an `a:spLocks/@noSelect` shape is locked
		// for everybody; a click on either behaves like an empty-canvas click (no
		// select / drag / inline-edit).
		const topId = interactiveIdFor(hitId);

		// AI pick mode: the next canvas element click(s) become picks for the
		// assistant (multi-pick, deduped) instead of a normal selection/drag. Resolve
		// via elementFromPoint too so overlays do not swallow the hit.
		if (options.aiPickMode.value) {
			const pickId = interactiveIdFor(
				resolveTopLevelElementId(document.elementFromPoint(event.clientX, event.clientY)) ?? hitId,
			);
			if (pickId) {
				event.preventDefault();
				options.addAiPick(options.activeSlideIndex.value, pickId);
			}
			return;
		}

		// On touch, if a table cell is being edited and the tap did NOT land inside
		// the cell input itself (the input stops its own pointerdown), the
		// TableRenderer's document-level pointerdown listener handles blur/commit.
		// (See TableRenderer.vue: docListener.)
		if (event.pointerType !== 'mouse' && trackTap(event, topId)) {
			return;
		}

		const additive = event.shiftKey || event.ctrlKey || event.metaKey;
		// Selecting inside a group (shared `group-drill`): the first press selects
		// the group, the next the member under the pointer. A modifier press keeps
		// toggling top-level elements.
		const id = topId && !additive ? resolvePressTarget(topId, event) : topId;

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
		if (id) {
			const ids = options.selectedElementIds.value;
			const wasSelected = !additive && ids.length === 1 && ids[0] === id;
			if (!wasSelected) {
				options.selectElement(id, additive);
			} else {
				// A release without a drag opens the inline editor: its caret goes
				// where this press landed (PowerPoint), not after the last word.
				setPendingCaretPoint(event);
			}
			// Drive move (drag) + inline-edit entry from the element itself. A tap
			// without drag on an already-selected element enters inline edit.
			//
			// A `noMove` shape still arms this: the press may be the second tap of a
			// click-to-edit, which PowerPoint allows on a pinned shape. `useElementDrag`
			// resolves the move lock at drag start and never travels a pinned element,
			// so nothing here has to know about it.
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
