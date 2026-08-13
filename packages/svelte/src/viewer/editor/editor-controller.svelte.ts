import type { PptxElement } from 'pptx-viewer-core';
import type {
	ConnectorEndpointKind,
	ResizeHandleId,
	ShapeAdjustmentHandleDescriptor,
	SnapLine,
} from 'pptx-viewer-shared';
import {
	armEditorKeyboard,
	collectConnectorSiteCandidates,
	findConnectorSiteNear,
	publishLiveInlineText,
	resolveConnectorEndpointUpdate,
	resolveContextMenuElementId,
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
import type { GestureController } from './editor-gestures';
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

export class EditorController {
	readonly #editor: EditorState;
	readonly #deps: EditorControllerDeps;
	readonly #gestures: GestureController;
	readonly #ink: InkGestureController;
	readonly #keydown: (event: KeyboardEvent) => void;
	readonly #selectionGestures;
	readonly #adjust: AdjustGestureController;
	readonly #handles: HandleHandlers;

	snapLines = $state<readonly SnapLine[]>([]);
	editingId = $state<string | null>(null);
	marquee = $state<EditorMarqueeRect | null>(null);

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
		if (!this.#editor.editable || this.#deps.getPresenting()) {
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
		return this.editingId
			? this.#currentElements().find((e) => e.id === this.editingId)
			: undefined;
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
		const id = resolveTopLevelElementId(event.target, this.#deps.getStageRoot());
		if (!id || !this.#editor.isElementInteractive(id)) {
			this.#editor.formatPainter.cancel();
			this.#selectionGestures.beginMarquee(event);
			return;
		}
		// A click in a table cell (re)anchors the cell range; a Shift-click inside
		// the selected table stretches it and CONSUMES the event, so it never
		// reaches the element-level Shift toggle below.
		if (applyTableCellPointer(this.#editor, id, event.target, event.shiftKey)) {
			event.preventDefault();
			return;
		}
		if (event.shiftKey || event.ctrlKey || event.metaKey) {
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
			if (this.#editor.equationOps.open(id)) {
				return;
			}
			this.enterInlineEdit(id);
		}
	};

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
		if (!id || !this.#editor.isElementInteractive(id)) {
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
	#stagePoint(event: PointerEvent): { x: number; y: number } {
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
		this.#keydown(event);
	};

	/** Open the inline text editor over `id` when the element carries text. */
	enterInlineEdit(id: string): void {
		if (this.editingId) {
			return;
		}
		const el = this.#currentElements().find((e) => e.id === id);
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

	/** Commit the inline editor's text onto the element and close it. */
	commitInline(id: string, text: string): void {
		// Flush any queued interim frame first so it cannot land after the
		// committed (AutoCorrected) text and revert it.
		this.#deps.getLivePatcher?.()?.flush();
		this.#editor.commitInlineText(id, this.#deps.transformCommittedText?.(text) ?? text);
	}

	/** Close the inline editor without further mutation. */
	closeInline(): void {
		this.editingId = null;
	}

	/** Tear down window listeners (component destroy). */
	destroy(): void {
		this.#gestures.dispose();
		this.#selectionGestures.dispose();
		this.#ink.dispose();
		this.#adjust.dispose();
	}
}
