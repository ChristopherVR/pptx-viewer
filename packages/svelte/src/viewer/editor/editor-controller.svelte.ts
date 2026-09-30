import type { PptxElement } from 'pptx-viewer-core';
import type {
	ConnectorEndpointKind,
	GestureController,
	ResizeHandleId,
	ShapeAdjustmentHandleDescriptor,
	SnapLine,
	InlineTextEditSnapshot,
	InlineListController,
	CollaborationInlineEditor,
} from 'pptx-viewer-shared';
import {
	armEditorKeyboard,
	collectConnectorSiteCandidates,
	drillSelectionForClick,
	drillSelectionForDoubleClick,
	findConnectorSiteNear,
	findElementPath,
	inlineListBodyText,
	isEnterableGroup,
	isGroupMember,
	memberChainAtPoint,
	overlayInlineTextSnapshot,
	parentSelection,
	publishLiveInlineText,
	resolveConnectorEndpointUpdate,
	resolveContextMenuElementId,
	setPendingCaretPoint,
	slideSpaceElement,
	withConnectorEndpointUpdate,
} from 'pptx-viewer-shared';

import { readTableCellTarget } from './context-menu-dispatch';
import type { AdjustGestureController } from './editor-adjust-gesture';
import type { EditorControllerDeps } from './editor-controller-deps';
import { selectionOverlayBox } from './editor-controller-geometry';
import {
	createAdjustGestures,
	createEditorKeydown,
	createInkGestures,
	createSelectionGestures,
	createTransformGestures,
} from './editor-controller-wiring';
import type { EditorControllerHost } from './editor-controller-wiring';
import { isInsideCropOverlay } from './editor-crop-controller.svelte';
import { createHandleHandlers } from './editor-handle-handlers';
import type { HandleHandlers } from './editor-handle-handlers';
import type { InkGestureController } from './editor-ink-gesture';
import type { EditorMarqueeRect } from './editor-selection-gestures';
import { canMoveElement, selectionInteractivity } from './editor-selection-interactivity';
import type { SelectionInteractivity } from './editor-selection-interactivity';
import type { EditorState } from './editor-state.svelte';
import { resolveEditTargetElementId, resolveTopLevelElementId } from './element-hit';
import { canInlineEditElement } from './inline-text';
import { applyTableCellPointer } from './table-cell-pointer';

export type { EditorControllerDeps } from './editor-controller-deps';

/** Max gap between two taps for them to count as a double-tap. */
const DOUBLE_TAP_MS = 400;
/** px tolerance for matching the second tap after a selection-induced reflow. */
const TAP_DISTANCE = 40;
/** Max pointer travel (px) for a press on the selected member to count as a click. */
const CLICK_SLOP = 4;

export class EditorController {
	readonly #editor: EditorState;
	readonly #deps: EditorControllerDeps;
	readonly #gestures: GestureController;
	readonly #ink: InkGestureController;
	readonly #keydown: (event: KeyboardEvent) => void;
	readonly #selectionGestures;
	readonly #adjust: AdjustGestureController;
	readonly #handles: HandleHandlers;
	#inlineSource?: { nonce: number; slideId?: string };

	// Touch double-tap detection (mirrors React/Vue/Angular canvas-level
	// detection). On mobile, native `dblclick` is not reliably synthesised from
	// two quick taps, so the last tap's element id and coordinates are tracked
	// by hand. Plain mutable state, never rendered, so it is not a rune.
	#lastTap: { id: string | undefined; time: number; x: number; y: number } | null = null;

	// A press on the group member that was ALREADY selected (shared `group-drill`):
	// if it ends as a click, not a drag, the member's text opens for editing with
	// the caret where the click landed (PowerPoint). Plain state, never rendered.
	#pressEdit: { id: string; x: number; y: number } | null = null;

	snapLines = $state<readonly SnapLine[]>([]);
	editingId = $state<string | null>(null);
	marquee = $state<EditorMarqueeRect | null>(null);
	/**
	 * The hyperlink dialog, opened by Ctrl+K or the Insert-tab/context-menu
	 * buttons. Lives here (not on the always-mounted `ViewerStage`) so the
	 * keyboard shortcut has one flag to flip regardless of which of those two
	 * pre-existing triggers a host renders.
	 */
	hyperlinkOpen = $state(false);

	constructor(editor: EditorState, deps: EditorControllerDeps) {
		this.#editor = editor;
		this.#deps = deps;

		// One host object, four sub-controllers: the wiring lives in
		// `editor-controller-wiring.ts` so this class stays the pointer/keyboard
		// event surface rather than a construction script.
		const host: EditorControllerHost = {
			editor,
			deps,
			currentElements: () => this.#currentElements(),
			setSnapLines: (lines) => {
				this.snapLines = lines;
			},
			setMarquee: (rect) => {
				this.marquee = rect;
			},
			getEditingId: () => this.editingId,
			openHyperlink: () => this.openHyperlink(),
		};
		this.#gestures = createTransformGestures(host);
		this.#ink = createInkGestures(host);
		this.#keydown = createEditorKeydown(host);
		this.#selectionGestures = createSelectionGestures(host);
		this.#adjust = createAdjustGestures(host);
		this.#handles = createHandleHandlers({
			getSelectedId: () => editor.selectedElementId,
			getSelectedElement: () => editor.selectedElement,
			getInteractivity: () => this.interactivity,
			gestures: this.#gestures,
			beginCollectiveTransform: (kind, event, handle) =>
				this.#selectionGestures.beginTransform(kind, event, handle),
			adjust: this.#adjust,
		});
	}

	#currentElements(): PptxElement[] {
		return this.#editor.activeElements;
	}

	/** The elements the pointer acts on (slide, or master/layout), for overlays. */
	get activeElements(): PptxElement[] {
		return this.#editor.activeElements;
	}

	get overlayBox() {
		// Crop mode draws its own handles over the picture instead.
		if (!this.#editor.editable || this.#deps.getPresenting() || this.#editor.cropOps.active) {
			return null;
		}
		// Edit Points replaces the resize / rotate chrome with vertex handles.
		const editPointsId = this.#editor.outlineOps.editPointsId;
		if (editPointsId && this.#editor.selectedElements.some((el) => el.id === editPointsId)) {
			return null;
		}
		return selectionOverlayBox(this.#editor.selectedElements);
	}

	/**
	 * Which selection chrome the authored `a:spLocks` still permit, plus the
	 * shape-adjustment descriptor. The overlay only ever sees an `OverlayBox`,
	 * so the element-level verdict is computed here and passed down as a prop.
	 */
	get interactivity(): SelectionInteractivity {
		return selectionInteractivity(this.#editor.selectedElements);
	}

	get editing(): boolean {
		return this.editingId !== null;
	}

	get selectionCount(): number {
		return this.#editor.selection.size;
	}

	get editingElement(): PptxElement | undefined {
		// A group member resolves in slide space, so the inline editor's box lands
		// over the member rather than at its group-relative offset.
		return this.editingId ? this.#editor.elementById(this.editingId) : undefined;
	}

	/**
	 * The group the selection has drilled into (shared `parentSelection`), in
	 * slide space, for its dashed frame; null when the selection is top-level.
	 */
	get enteredGroup(): PptxElement | null {
		const selectedId = this.#editor.selectedElementId;
		if (!this.#editor.editable || this.#deps.getPresenting() || !selectedId) {
			return null;
		}
		const elements = this.#currentElements();
		const parentId = parentSelection(elements, selectedId);
		return parentId ? slideSpaceElement(elements, parentId) : null;
	}

	/**
	 * The ids under the pointer inside the top-level group `topId`, innermost
	 * first (shared `memberChainAtPoint`, geometric because grouped children are
	 * `pointer-events: none`); null when `topId` is not an enterable group.
	 */
	#drillChain(topId: string, event: { clientX: number; clientY: number }): string[] | null {
		const elements = this.#currentElements();
		const top = elements.find((element) => element.id === topId);
		if (!top || !isEnterableGroup(top)) {
			return null;
		}
		return memberChainAtPoint(elements, topId, this.#stagePoint(event));
	}

	/**
	 * What a press on the top-level element `topId` selects, PowerPoint-style:
	 * a group first, then (once it is selected) the member under the pointer,
	 * and another member of the entered group moves the selection to it.
	 */
	#resolvePressTarget(topId: string, event: PointerEvent): string {
		const chain = this.#drillChain(topId, event);
		if (!chain) {
			return topId;
		}
		const selectedId = this.#editor.selectedElementId;
		const selectedPath = selectedId ? findElementPath(this.#currentElements(), selectedId) : null;
		return drillSelectionForClick(chain, selectedPath) ?? topId;
	}

	/** True when editing owns the keyboard (a selection or inline edit is live). */
	capturesKeyboard(): boolean {
		return (
			this.#editor.editable && (this.#editor.selectedElementId !== null || this.editingId !== null)
		);
	}

	onStagePointerDown = (event: PointerEvent): void => {
		// The gestures below call preventDefault(), which suppresses the focus move
		// this click would otherwise make. Without repairing it here focus stays on
		// document.body, outside the root's keydown listener, and every shortcut is
		// silently dead after the most ordinary interaction there is: clicking a
		// shape and pressing Delete.
		armEditorKeyboard(this.#deps.getRootEl?.() ?? null);
		// Crop mode owns pointer-downs inside its overlay; one anywhere else
		// commits the crop and then carries on as a normal stage click.
		if (this.#editor.cropOps.active) {
			if (isInsideCropOverlay(event.target)) {
				return;
			}
			this.#editor.cropOps.commit();
		}
		if (
			!this.#editor.editable ||
			this.#deps.getPresenting() ||
			event.button !== 0 ||
			this.editing
		) {
			return;
		}
		// Draw tools (pen/highlighter/eraser) take over the gesture entirely,
		// mutually exclusive with normal selection/drag: EditorInkController
		// clears the selection when a draw tool is chosen, so the selection
		// overlay's own-pointerdown resize/rotate handles never race a stroke.
		if (this.#editor.inkOps.isDrawing) {
			this.#ink.handlePointerDown(event);
			return;
		}
		this.#pressEdit = null;
		const hitId = resolveTopLevelElementId(event.target, this.#deps.getStageRoot());
		const topId = hitId && this.#editor.isElementInteractive(hitId) ? hitId : undefined;
		// Touch only: native `dblclick` is not reliably synthesised from two quick
		// taps on mobile, so a matched second tap is handled here instead and
		// consumes the event (no select / drag / marquee for that tap).
		if (event.pointerType !== 'mouse' && this.#trackTap(event, topId)) {
			return;
		}
		if (!topId) {
			this.#editor.formatPainter.cancel();
			this.#selectionGestures.beginMarquee(event);
			return;
		}
		// A press on a group drills into it (shared `group-drill`); a modified
		// press toggles the top-level element as before.
		const modified = event.shiftKey || event.ctrlKey || event.metaKey;
		const drilled = modified ? topId : this.#resolvePressTarget(topId, event);
		const id = this.#editor.isElementInteractive(drilled) ? drilled : topId;
		if (id === this.#editor.selectedElementId && isGroupMember(this.#currentElements(), id)) {
			this.#pressEdit = { id, x: event.clientX, y: event.clientY };
		}
		// A click in a table cell (re)anchors the cell range; a Shift-click inside
		// the selected table stretches it and CONSUMES the event, so it never
		// reaches the element-level Shift toggle below.
		if (applyTableCellPointer(this.#editor, id, event.target, event.shiftKey)) {
			event.preventDefault();
			return;
		}
		if (modified) {
			this.#editor.selection.toggle(id);
			return;
		}
		if (this.#editor.formatPainter.applyTo(id)) {
			return;
		}
		if (!this.#editor.selection.has(id)) {
			this.#editor.select(id);
		}
		// A `noMove` element still SELECTS (so it can be unlocked from the
		// inspector) but arms no drag, which is exactly PowerPoint's behaviour.
		if (!canMoveElement(this.#editor.elementById(id))) {
			return;
		}
		if (this.#selectionGestures.beginTransform('move', event)) {
			return;
		}
		// Shared `GestureController.begin` takes a plain `PointerLike` and no
		// longer calls `preventDefault`/`stopPropagation` itself (a plain object
		// has no such methods), so the caller must consume the event first.
		event.preventDefault();
		event.stopPropagation();
		this.#gestures.begin('move', id, event);
	};

	onStagePointerMove = (event: PointerEvent): void => {
		if (!this.#deps.onCursorMove) {
			return;
		}
		const rect = this.#deps.getHolderEl()?.getBoundingClientRect();
		const scale = this.#deps.getScale();
		if (!rect || !(scale > 0)) {
			return;
		}
		this.#deps.onCursorMove(
			(event.clientX - rect.left) / scale,
			(event.clientY - rect.top) / scale,
		);
	};

	/**
	 * A click that ends a press on the already-selected group member (see
	 * `#pressEdit`) opens its text, caret where the click landed. A drag (the
	 * pointer travelled) or any other click does nothing here.
	 */
	onStageClick = (event: MouseEvent): void => {
		const press = this.#pressEdit;
		this.#pressEdit = null;
		if (
			!press ||
			!this.#editor.editable ||
			this.#deps.getPresenting() ||
			this.editing ||
			Math.abs(event.clientX - press.x) > CLICK_SLOP ||
			Math.abs(event.clientY - press.y) > CLICK_SLOP ||
			this.#editor.selectedElementId !== press.id
		) {
			return;
		}
		setPendingCaretPoint(event);
		this.#requestElementEdit(press.id);
	};

	onStageDblClick = (event: MouseEvent): void => {
		if (!this.#editor.editable || this.#deps.getPresenting() || this.#editor.inkOps.isDrawing) {
			return;
		}
		// `resolveEditTargetElementId`, not the plain hit-test: on touch the
		// finger-sized resize handles can cover a small shape's body, so the
		// second tap of a double-tap lands on selection chrome.
		const id = resolveEditTargetElementId(
			event.target,
			this.#deps.getStageRoot(),
			this.#editor.selectedElementId,
		);
		if (id && this.#editor.isElementInteractive(id)) {
			// Caret at the END, as for any double-click (typing appends).
			this.#requestElementEdit(this.#doubleClickTarget(id, event));
		}
	};

	/**
	 * A double-click on a group goes straight to the innermost member under the
	 * pointer (shared `drillSelectionForDoubleClick`), so its text can be edited
	 * without ungrouping, as in PowerPoint. Anything else keeps `id`.
	 */
	#doubleClickTarget(id: string, event: { clientX: number; clientY: number }): string {
		const chain = this.#drillChain(id, event);
		const innermost = chain ? drillSelectionForDoubleClick(chain) : null;
		return innermost && this.#editor.isElementInteractive(innermost) ? innermost : id;
	}

	/** Select the right-clicked element and expose the edit context menu. */
	onStageContextMenu = (event: MouseEvent): void => {
		if (!this.#editor.editable || this.#deps.getPresenting() || this.#editor.inkOps.isDrawing) {
			return;
		}
		// The inline text editor is an overlay beside the elements, not a child of
		// the one it edits, so a right-click inside it hit-tests to nothing. Fall
		// back to the element being edited rather than swallowing the menu on the
		// element the user just clicked.
		const id = resolveContextMenuElementId(
			resolveTopLevelElementId(event.target, this.#deps.getStageRoot()),
			event.target,
			this.editingId,
		);
		if (!id) {
			// Empty canvas: offer Paste/Layout/Reset/Format Background/Grid/Ruler
			// instead of leaving this a no-op (the browser's own menu used to win).
			if (this.#deps.onCanvasContextMenu) {
				event.preventDefault();
				this.#deps.onCanvasContextMenu(event.clientX, event.clientY);
			}
			return;
		}
		if (!this.#editor.isElementInteractive(id)) {
			return;
		}
		event.preventDefault();
		// Only when the right-click landed OUTSIDE the current selection. An
		// unconditional select collapsed a multi-selection to the one element
		// under the cursor, so right-clicking either of two rubber-banded shapes
		// left the menu with nothing to Group, which is how Svelte shipped.
		if (!this.#editor.selection.has(id)) {
			this.#editor.select(id);
		}
		// The right-clicked table cell (if any) rides along: the menu's row /
		// column / merge commands act on the cell under the pointer.
		this.#deps.onContextMenu?.(event.clientX, event.clientY, readTableCellTarget(event.target));
	};

	// Resize handle / rotate knob / adjustment diamond: see `editor-handle-handlers`.
	onHandlePointerDown = (handle: ResizeHandleId, event: PointerEvent): void =>
		this.#handles.onHandlePointerDown(handle, event);

	onRotatePointerDown = (event: PointerEvent): void => this.#handles.onRotatePointerDown(event);

	onAdjustPointerDown = (event: PointerEvent, descriptor: ShapeAdjustmentHandleDescriptor): void =>
		this.#handles.onAdjustPointerDown(event, descriptor);

	// ── Connector endpoint authoring ─────────────────────────────────────────

	hasActivePointerInteraction(): boolean {
		return (
			this.#gestures.isActive() ||
			this.#ink.isActive() ||
			this.#selectionGestures.isActive() ||
			this.#adjust.isActive() ||
			this.connectorEndpointDrag !== null
		);
	}

	/** Live connector-endpoint drag position in SLIDE px, or null when idle. */
	connectorEndpointDrag = $state<{ kind: ConnectorEndpointKind; x: number; y: number } | null>(
		null,
	);

	/** The selected connector, when exactly one connector is selected. */
	get selectedConnector(): PptxElement | null {
		if (!this.#editor.editable || this.#deps.getPresenting() || this.editingId !== null) {
			return null;
		}
		const selected = this.#editor.selectedElements;
		return selected.length === 1 && selected[0].type === 'connector' ? selected[0] : null;
	}

	/** Pointer position in SLIDE px (this overlay layer is unscaled). */
	#stagePoint(event: { clientX: number; clientY: number }): { x: number; y: number } {
		const rect = this.#deps.getStageRoot()?.getBoundingClientRect();
		const scale = this.#deps.getScale() || 1;
		return {
			x: (event.clientX - (rect?.left ?? 0)) / scale,
			y: (event.clientY - (rect?.top ?? 0)) / scale,
		};
	}

	onConnectorEndpointPointerDown = (kind: ConnectorEndpointKind, event: PointerEvent): void => {
		if (!this.selectedConnector) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.connectorEndpointDrag = { kind, ...this.#stagePoint(event) };
		const onMove = (moveEvent: PointerEvent): void => {
			if (this.connectorEndpointDrag) {
				this.connectorEndpointDrag = {
					kind: this.connectorEndpointDrag.kind,
					...this.#stagePoint(moveEvent),
				};
			}
		};
		const onUp = (upEvent: PointerEvent): void => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			const drag = this.connectorEndpointDrag;
			this.connectorEndpointDrag = null;
			const connector = this.selectedConnector;
			if (!drag || !connector) {
				return;
			}
			const point = this.#stagePoint(upEvent);
			const elements = this.#currentElements();
			const target = findConnectorSiteNear(
				collectConnectorSiteCandidates(elements.filter((el) => el.id !== connector.id)),
				point.x,
				point.y,
			);
			const update = resolveConnectorEndpointUpdate(connector, elements, drag.kind, point, target);
			const next = withConnectorEndpointUpdate(connector, update);
			this.#editor.pushHistory();
			this.#editor.replaceActiveElements(
				elements.map((element) => (element.id === connector.id ? next : element)),
			);
			this.#editor.commitChange();
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	};

	onKeyDown = (event: KeyboardEvent): void => {
		// Enter/Escape commit/cancel crop mode, instead of their normal action.
		if (this.#editor.cropOps.handleKey(event)) {
			return;
		}
		this.#keydown(event);
	};

	/**
	 * Route a tap / double-click that should open an element for editing: an
	 * equation element opens the equation editor (inline text editing would
	 * only see the "[Equation]" placeholder and destroy the OMML on commit),
	 * everything else enters ordinary inline text editing.
	 */
	#requestElementEdit(id: string): void {
		if (this.#editor.equationOps.open(id)) {
			return;
		}
		this.enterInlineEdit(id);
	}

	/**
	 * Second tap of a touch double-tap: open the tapped thing for editing. A
	 * table routes to the nearest cell (after a selection reflow
	 * `elementFromPoint` may no longer hit the `<td>` directly, so the nearest
	 * one by centre distance is used instead) by dispatching a real `dblclick`
	 * on it, which `TableView`'s own handler already turns into cell-edit mode;
	 * everything else goes through `#requestElementEdit`. Always returns true:
	 * a matched second tap is consumed either way.
	 */
	#handleDoubleTap(event: PointerEvent, doubleTapId: string | undefined): boolean {
		if (!doubleTapId) {
			return true;
		}
		const targetId = this.#doubleClickTarget(doubleTapId, event);
		const el = this.#editor.elementById(targetId);
		if (el?.type === 'table') {
			const tableHost = this.#deps.getStageRoot()?.querySelector(`[data-element-id="${targetId}"]`);
			const cells = tableHost?.querySelectorAll('td');
			let closest: HTMLElement | null = null;
			let minDist = Infinity;
			for (const cell of cells ?? []) {
				const rect = cell.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) {
					continue;
				}
				const cx = rect.left + rect.width / 2;
				const cy = rect.top + rect.height / 2;
				const dist = Math.hypot(event.clientX - cx, event.clientY - cy);
				if (dist < minDist) {
					minDist = dist;
					closest = cell;
				}
			}
			if (closest) {
				closest.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
				return true;
			}
		}
		this.#requestElementEdit(targetId);
		return true;
	}

	/**
	 * Touch/pen tap bookkeeping. Returns true when this tap completed a
	 * double-tap and the caller must stop (no selection / drag / marquee).
	 */
	#trackTap(event: PointerEvent, resolvedId: string | undefined): boolean {
		const now = event.timeStamp || Date.now();
		const last = this.#lastTap;

		// On the second tap, match against the first tap's element. Layout may
		// shift between taps (selection causing fit-scale change), so the second
		// tap might not resolve to ANY element; use proximity + the stored id.
		const isSameTarget =
			last !== null &&
			now - last.time < DOUBLE_TAP_MS &&
			(resolvedId === last.id ||
				(Math.abs(event.clientX - last.x) < TAP_DISTANCE &&
					Math.abs(event.clientY - last.y) < TAP_DISTANCE));

		if (last && isSameTarget) {
			this.#lastTap = null;
			return this.#handleDoubleTap(event, resolvedId ?? last.id);
		}
		if (resolvedId) {
			this.#lastTap = { id: resolvedId, time: now, x: event.clientX, y: event.clientY };
		} else if (!(last && now - last.time < DOUBLE_TAP_MS)) {
			// Keep the previous tap alive if no element resolved (second tap in a
			// reflowed area); the proximity check above still matches it.
			this.#lastTap = null;
		}
		return false;
	}

	/** Open the inline text editor over `id` when the element carries text. */
	enterInlineEdit(id: string): void {
		if (this.editingId) {
			return;
		}
		const el = this.#editor.elementById(id);
		if (!el || !canInlineEditElement(el)) {
			return;
		}
		this.#editor.select(id);
		this.editingId = id;
	}

	/**
	 * Mirror the in-progress inline text to collaborators. Touches no editor
	 * state or history: the commit path stays the single source of truth.
	 */
	previewInline(id: string, text: string): void {
		publishLiveInlineText(this.#deps.getLivePatcher?.(), this.#deps.getActiveSlide?.(), id, text);
	}

	/** Native editor capability stays scoped to this controller's active slide. */
	get inlineCollaboration() {
		const patcher = this.#deps.getLivePatcher?.();
		const slide = this.#deps.getActiveSlide?.();
		return patcher?.isActive() &&
			slide &&
			!this.#editor.masterViewTarget &&
			slide.elements.some((candidate) => candidate.id === this.editingId)
			? { patcher, slideId: slide.id }
			: undefined;
	}

	/** Open the hyperlink dialog for the current selection (Ctrl+K). */
	openHyperlink(): void {
		this.hyperlinkOpen = true;
	}

	/**
	 * Apply an element patch built by a formatting shortcut, mid-edit or not.
	 * `InlineTextEditor` has no access to `EditorState`, only to this
	 * controller and the element it is editing, so this is its way to reach
	 * the same `patchSelected` the root keyboard handler and the ribbon use.
	 */
	patchSelected(
		patch: Partial<PptxElement> | ((element: PptxElement) => Partial<PptxElement>),
	): void {
		this.#editor.patchSelected(patch);
	}

	/** Arm the format painter from the current selection (Ctrl+Shift+C). */
	copyFormat(): void {
		this.#editor.formatPainter.toggle();
	}

	/** Apply the copied format to the current selection (Ctrl+Shift+V). */
	pasteFormat(): void {
		const id = this.#editor.selectedElementId;
		if (id) {
			this.#editor.formatPainter.applyTo(id);
		}
	}

	/** Open the find bar (Ctrl+F), including mid-edit; see `EditorControllerDeps`. */
	toggleFind(): void {
		this.#deps.toggleFind?.();
	}

	/** Open the find bar's replace row (Ctrl+H), including mid-edit. */
	toggleFindReplace(): void {
		this.#deps.toggleFindReplace?.();
	}

	/** Commit the inline editor's text onto the element and close it. */
	commitInline(id: string, text: string, snapshot?: InlineTextEditSnapshot): void {
		// Flush any queued interim frame first so it cannot land after the
		// committed (AutoCorrected) text and revert it.
		this.#deps.getLivePatcher?.()?.flush();
		this.#editor.commitInlineText(id, this.#deps.transformCommittedText?.(text) ?? text, snapshot);
	}

	/** Register a live reader with this viewer's document and editing session. */
	registerInlineReader(
		id: string,
		controller?: InlineListController | CollaborationInlineEditor,
		cancel?: () => void,
	): void {
		const editor = this.#editor;
		editor.inlineListController = controller;
		editor.cancelInlineListEdit = cancel;
		this.#inlineSource = controller
			? { nonce: editor.seedNonce, slideId: editor.slides[editor.currentSlideIndex]?.id }
			: undefined;
		if (!controller) {
			editor.readPendingInlineTextEdit = undefined;
			return;
		}
		const nonce = editor.seedNonce;
		const body = () => {
			const element = editor.elementById(id);
			return element && 'textSegments' in element
				? inlineListBodyText(element.textSegments)
				: undefined;
		};
		let lastBody = body();
		const target = editor.masterViewTarget
			? { masterView: editor.masterViewTarget }
			: { slideId: editor.slides[editor.currentSlideIndex]?.id };
		editor.readPendingInlineTextEdit = () => {
			if (this.editingId !== id || editor.seedNonce !== nonce || !editor.editable) {
				return undefined;
			}
			if (
				'slideId' in target
					? editor.masterViewTarget ||
						editor.slides[editor.currentSlideIndex]?.id !== target.slideId
					: JSON.stringify(editor.masterViewTarget) !== JSON.stringify(target.masterView)
			) {
				cancel?.();
				return undefined;
			}
			if (
				'checkModel' in controller &&
				!controller.checkModel(editor.activeElements.find((candidate) => candidate.id === id))
			) {
				return undefined;
			}
			const result = controller.read();
			if (
				'checkModel' in controller &&
				result.kind === 'unsupported' &&
				(result.reason === 'composition-active' || result.reason === 'input-active')
			) {
				throw new Error('Finish the current text input before saving.');
			}
			const snapshot = result.kind === 'supported' ? result.snapshot : undefined;
			const currentBody = body();
			if (
				!('checkModel' in controller) &&
				currentBody !== lastBody &&
				currentBody !== snapshot?.text
			) {
				cancel?.();
				return undefined;
			}
			lastBody = currentBody;
			if (!snapshot || snapshot.elementId !== id || ('slideId' in target && !target.slideId)) {
				return undefined;
			}
			return { snapshot, target, text: editor.transformCommittedText(snapshot.text) };
		};
	}

	/** Retain authoritative accepted text before a host-only permission veto. */
	retainAcceptedInlineText(permissionLossOnly = false): boolean {
		if (permissionLossOnly && this.#deps.getEditable?.() !== false) {
			return false;
		}
		const editor = this.#editor;
		const native = editor.inlineListController;
		if (!native || !('readAccepted' in native)) {
			return false;
		}
		const controller = native as CollaborationInlineEditor;
		const slide = editor.slides[editor.currentSlideIndex];
		if (
			this.#inlineSource?.nonce !== editor.seedNonce ||
			this.#inlineSource?.slideId !== slide?.id
		) {
			return true;
		}
		const element = slide?.elements.find((candidate) => candidate.id === this.editingId);
		if (editor.masterViewTarget || !controller.checkModel(element)) {
			return true;
		}
		const snapshot = controller.readAccepted();
		if (snapshot && slide) {
			const elements = overlayInlineTextSnapshot(slide.elements, snapshot);
			if (elements !== slide.elements) {
				editor.slides = editor.slides.map((candidate) =>
					candidate === slide ? { ...slide, elements: [...elements] } : candidate,
				);
			}
		}
		return true;
	}

	/** Close the inline editor without further mutation. */
	closeInline(): void {
		this.#inlineSource = undefined;
		this.#editor.inlineListController = undefined;
		this.#editor.cancelInlineListEdit = undefined;
		this.#editor.readPendingInlineTextEdit = undefined;
		this.editingId = null;
	}

	/** Tear down window listeners (component destroy). */
	destroy(): void {
		this.#editor.cancelInlineListEdit?.();
		this.#editor.cancelInlineListEdit = undefined;
		this.#editor.inlineListController = undefined;
		this.#editor.readPendingInlineTextEdit = undefined;
		this.#gestures.dispose();
		this.#selectionGestures.dispose();
		this.#ink.dispose();
		this.#adjust.dispose();
	}
}
