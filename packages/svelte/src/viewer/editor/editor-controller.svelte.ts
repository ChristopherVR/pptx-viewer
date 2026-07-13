import type { PptxElement } from 'pptx-viewer-core';
import type { InteractionBox, ResizeHandleId, SnapLine, SnapSibling } from 'pptx-viewer-shared';

import { createGestureController } from './editor-gestures';
import type { GestureController } from './editor-gestures';
import { createInkGestureController } from './editor-ink-gesture';
import type { InkGestureController } from './editor-ink-gesture';
import { createEditorKeydownHandler } from './editor-keyboard';
import type { EditorState } from './editor-state.svelte';
import { resolveTopLevelElementId } from './element-hit';
import { canInlineEditElement } from './inline-text';
import type { OverlayBox } from './types';

/**
 * The editing orchestrator for the Svelte viewer: wires the selection overlay,
 * pointer gestures, inline text editing, and the editing keyboard to the
 * history-tracked {@link EditorState}. The Svelte counterpart of the vanilla
 * binding's `editor-controller`, but reactive: `overlayBox`, `snapLines`, and
 * `editingElement` are runes-backed so the overlay/inline components rerender
 * automatically. All pure editing math lives in `pptx-viewer-shared`; this
 * class owns only the DOM/event plumbing.
 */
export interface EditorControllerDeps {
	/** Current stage scale (screen px per element px). */
	getScale(): number;
	/** Active slide index (0-based). */
	getCurrent(): number;
	/** True while the viewer is presenting (fullscreen); editing is suppressed. */
	getPresenting(): boolean;
	/** The `.pptx-svelte-stage` element for hit-testing (or null before mount). */
	getStageRoot(): Element | null;
	/** The stage holder element, for mapping rotation pointer to slide origin. */
	getHolderEl(): HTMLElement | null;
	/** Notified with slide-space coordinates on stage pointer move (collaboration cursor broadcast). */
	onCursorMove?(x: number, y: number): void;
	/** Opens the selected element's edit context menu at the pointer position. */
	onContextMenu?(x: number, y: number): void;
}

function toOverlayBox(el: PptxElement): OverlayBox {
	return { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 };
}

export class EditorController {
	readonly #editor: EditorState;
	readonly #deps: EditorControllerDeps;
	readonly #gestures: GestureController;
	readonly #ink: InkGestureController;
	readonly #keydown: (event: KeyboardEvent) => void;

	/** Transient snap-alignment lines shown during a snap-to-shape drag. */
	snapLines = $state<readonly SnapLine[]>([]);
	/** The element id currently open in the inline text editor, or null. */
	editingId = $state<string | null>(null);

	constructor(editor: EditorState, deps: EditorControllerDeps) {
		this.#editor = editor;
		this.#deps = deps;

		this.#gestures = createGestureController({
			getScale: () => this.#deps.getScale(),
			getElementBox: (id) => this.#elementBox(id),
			getSiblings: () => this.#siblings(),
			getStageOrigin: () => {
				const rect = this.#deps.getHolderEl()?.getBoundingClientRect();
				return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
			},
			onStart: () => {
				this.#editor.pushHistory();
				this.#editor.interactionActive = true;
			},
			onPreview: (transform, lines) => {
				this.#editor.patchGeometry(transform.id, transform);
				this.snapLines = lines;
			},
			onEnd: (transform, moved, id) => {
				this.snapLines = [];
				if (transform) {
					this.#editor.patchGeometry(id, transform);
				}
				this.#editor.interactionActive = false;
				if (moved) {
					this.#editor.commitChange();
				}
			},
		});

		this.#ink = createInkGestureController({
			getScale: () => this.#deps.getScale(),
			getStageOrigin: () => {
				const rect = this.#deps.getHolderEl()?.getBoundingClientRect();
				return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
			},
			getTool: () => this.#editor.inkOps.tool,
			onStrokeStart: () => {
				this.#editor.interactionActive = true;
			},
			onStrokePreview: (points) => {
				this.#editor.inkOps.previewStroke(points);
			},
			onStrokeEnd: (points) => {
				this.#editor.interactionActive = false;
				this.#editor.inkOps.commitStroke(points);
			},
			onErase: (point) => {
				this.#editor.inkOps.eraseElementAt(point);
			},
		});

		this.#keydown = createEditorKeydownHandler({
			isActive: () =>
				this.#editor.editable && !this.#deps.getPresenting() && this.editingId === null,
			getSelectedId: () => this.#editor.selectedElementId,
			deselect: () => this.#editor.select(null),
			deleteSelected: () => this.#editor.deleteSelected(),
			duplicateSelected: () => void this.#editor.duplicateSelected(),
			nudgeSelected: (dx, dy) => this.#editor.nudgeSelected(dx, dy),
			undo: () => this.#editor.undo(),
			redo: () => this.#editor.redo(),
			copySelected: () => this.#editor.clipboardOps.copySelected(),
			cutSelected: () => this.#editor.clipboardOps.cutSelected(),
			paste: () => void this.#editor.clipboardOps.pasteClipboard(),
		});
	}

	#currentElements(): PptxElement[] {
		return this.#editor.activeElements;
	}

	#elementBox(id: string): InteractionBox | undefined {
		const el = this.#currentElements().find((e) => e.id === id);
		return el ? toOverlayBox(el) : undefined;
	}

	#siblings(): SnapSibling[] {
		return this.#currentElements().map(({ id, x, y, width, height }) => ({
			id,
			x,
			y,
			width,
			height,
		}));
	}

	/** The selection box in element px, or null when nothing is shown. */
	get overlayBox(): OverlayBox | null {
		if (!this.#editor.editable || this.#deps.getPresenting()) {
			return null;
		}
		const el = this.#editor.selectedElement;
		return el ? toOverlayBox(el) : null;
	}

	/** True while the inline text editor is open (selection chrome hides). */
	get editing(): boolean {
		return this.editingId !== null;
	}

	/** The element currently being inline-edited (for the inline surface). */
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

	// -- Event handlers (wired by PowerPointViewer / EditorLayer) --------------

	onStagePointerDown = (event: PointerEvent): void => {
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
			if (this.#editor.selectedElementId) {
				this.#editor.select(null);
			}
			return;
		}
		if (event.shiftKey || event.ctrlKey || event.metaKey) {
			this.#editor.selection.toggle(id);
			return;
		}
		if (this.#editor.selectedElementId !== id) {
			this.#editor.select(id);
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
		const id = resolveTopLevelElementId(event.target, this.#deps.getStageRoot());
		if (id && this.#editor.isElementInteractive(id)) {
			this.enterInlineEdit(id);
		}
	};

	/** Select the right-clicked element and expose the edit context menu. */
	onStageContextMenu = (event: MouseEvent): void => {
		if (!this.#editor.editable || this.#deps.getPresenting() || this.#editor.inkOps.isDrawing) {
			return;
		}
		const id = resolveTopLevelElementId(event.target, this.#deps.getStageRoot());
		if (!id || !this.#editor.isElementInteractive(id)) {
			return;
		}
		event.preventDefault();
		this.#editor.select(id);
		this.#deps.onContextMenu?.(event.clientX, event.clientY);
	};

	onHandlePointerDown = (handle: ResizeHandleId, event: PointerEvent): void => {
		const id = this.#editor.selectedElementId;
		if (id) {
			this.#gestures.begin('resize', id, event, handle);
		}
	};

	onRotatePointerDown = (event: PointerEvent): void => {
		const id = this.#editor.selectedElementId;
		if (id) {
			this.#gestures.begin('rotate', id, event);
		}
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

	/** Commit the inline editor's text onto the element and close it. */
	commitInline(id: string, text: string): void {
		this.#editor.commitInlineText(id, text);
	}

	/** Close the inline editor without further mutation. */
	closeInline(): void {
		this.editingId = null;
	}

	/** Tear down window listeners (component destroy). */
	destroy(): void {
		this.#gestures.dispose();
		this.#ink.dispose();
	}
}
