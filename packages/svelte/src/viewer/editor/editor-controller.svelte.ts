import type { PptxElement } from 'pptx-viewer-core';
import type { ResizeHandleId, SnapLine } from 'pptx-viewer-shared';

import type { EditorControllerDeps } from './editor-controller-deps';
import {
	elementInteractionBox,
	selectionOverlayBox,
	siblingBoxes,
} from './editor-controller-geometry';
import { createGestureController } from './editor-gestures';
import type { GestureController } from './editor-gestures';
import { createInkGestureController } from './editor-ink-gesture';
import type { InkGestureController } from './editor-ink-gesture';
import { createEditorKeydownHandler } from './editor-keyboard';
import { createSelectionGestureController } from './editor-selection-gestures';
import type { EditorMarqueeRect } from './editor-selection-gestures';
import type { EditorState } from './editor-state.svelte';
import { resolveTopLevelElementId } from './element-hit';
import { canInlineEditElement } from './inline-text';

export type { EditorControllerDeps } from './editor-controller-deps';

export class EditorController {
	readonly #editor: EditorState;
	readonly #deps: EditorControllerDeps;
	readonly #gestures: GestureController;
	readonly #ink: InkGestureController;
	readonly #keydown: (event: KeyboardEvent) => void;
	readonly #selectionGestures;

	snapLines = $state<readonly SnapLine[]>([]);
	editingId = $state<string | null>(null);
	marquee = $state<EditorMarqueeRect | null>(null);

	constructor(editor: EditorState, deps: EditorControllerDeps) {
		this.#editor = editor;
		this.#deps = deps;

		this.#gestures = createGestureController({
			getScale: () => this.#deps.getScale(),
			getElementBox: (id) => elementInteractionBox(this.#currentElements(), id),
			getSiblings: () => siblingBoxes(this.#currentElements()),
			getSnapToGrid: () => this.#deps.getSnapToGrid?.() ?? false,
			getSnapToShape: () => this.#deps.getSnapToShape?.() ?? true,
			getGuides: () => this.#deps.getGuides?.() ?? [],
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
			cancelFormatPainter: () => {
				const active = this.#editor.formatPainter.active;
				this.#editor.formatPainter.cancel();
				return active;
			},
		});

		this.#selectionGestures = createSelectionGestureController({
			getScale: () => this.#deps.getScale(),
			getStageRect: () => this.#deps.getHolderEl()?.getBoundingClientRect(),
			getElements: () => this.#currentElements(),
			getSelectedIds: () => this.#editor.selection.ids,
			onStart: () => {
				this.#editor.pushHistory();
				this.#editor.interactionActive = true;
			},
			onPatch: (id, patch) => this.#editor.patchGeometry(id, patch),
			onCommit: () => {
				this.#editor.interactionActive = false;
				this.#editor.commitChange();
			},
			onSelect: (ids) => this.#editor.selection.setAll(ids),
			onMarquee: (rect) => {
				this.marquee = rect;
			},
		});
	}

	#currentElements(): PptxElement[] {
		return this.#editor.activeElements;
	}

	get overlayBox() {
		if (!this.#editor.editable || this.#deps.getPresenting()) {
			return null;
		}
		return selectionOverlayBox(this.#editor.selectedElements);
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
		const id = resolveTopLevelElementId(event.target, this.#deps.getStageRoot());
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
			if (this.#selectionGestures.beginTransform('resize', event, handle)) {
				return;
			}
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
	}
}
