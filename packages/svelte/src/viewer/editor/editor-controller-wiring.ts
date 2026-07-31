import type { PptxElement } from 'pptx-viewer-core';
import type { SnapLine } from 'pptx-viewer-shared';

import type { EditorControllerDeps } from './editor-controller-deps';
import { elementInteractionBox, siblingBoxes } from './editor-controller-geometry';
import { createGestureController } from './editor-gestures';
import type { GestureController } from './editor-gestures';
import { createInkGestureController } from './editor-ink-gesture';
import type { InkGestureController } from './editor-ink-gesture';
import { createEditorKeydownHandler } from './editor-keyboard';
import { createSelectionGestureController } from './editor-selection-gestures';
import type { EditorMarqueeRect } from './editor-selection-gestures';
import type { EditorState } from './editor-state.svelte';

/**
 * The slice of `EditorController` its sub-controllers need. Passing this
 * instead of the controller itself keeps the wiring below independent of the
 * class (and of its private fields), which is what lets it live outside
 * `editor-controller.svelte.ts` and hold that file within the repo's
 * file-size budget.
 */
export interface EditorControllerHost {
	editor: EditorState;
	deps: EditorControllerDeps;
	/** The elements the pointer currently acts on (slide, or master/layout). */
	currentElements(): PptxElement[];
	/** Publish the transient snap-alignment lines to the overlay. */
	setSnapLines(lines: readonly SnapLine[]): void;
	/** Publish the in-progress empty-canvas marquee rectangle. */
	setMarquee(rect: EditorMarqueeRect | null): void;
	/** The element currently open in the inline text editor, or null. */
	getEditingId(): string | null;
}

/** Every sub-controller works in stage-local coordinates off this origin. */
function stageOrigin(host: EditorControllerHost): { left: number; top: number } {
	const rect = host.deps.getHolderEl()?.getBoundingClientRect();
	return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
}

/** Move / resize / rotate gestures, including snapping and history bracketing. */
export function createTransformGestures(host: EditorControllerHost): GestureController {
	const { editor, deps } = host;
	return createGestureController({
		getScale: () => deps.getScale(),
		getElementBox: (id) => elementInteractionBox(host.currentElements(), id),
		getSiblings: () => siblingBoxes(host.currentElements()),
		getSnapToGrid: () => deps.getSnapToGrid?.() ?? false,
		getSnapToShape: () => deps.getSnapToShape?.() ?? true,
		getGuides: () => deps.getGuides?.() ?? [],
		getStageOrigin: () => stageOrigin(host),
		onStart: () => {
			editor.pushHistory();
			editor.interactionActive = true;
		},
		onPreview: (transform, lines) => {
			editor.patchGeometry(transform.id, transform);
			host.setSnapLines(lines);
		},
		onEnd: (transform, moved, id) => {
			host.setSnapLines([]);
			if (transform) {
				editor.patchGeometry(id, transform);
			}
			editor.interactionActive = false;
			if (moved) {
				editor.commitChange();
			}
		},
	});
}

/** Pen / highlighter / eraser stroke gestures. */
export function createInkGestures(host: EditorControllerHost): InkGestureController {
	const { editor, deps } = host;
	return createInkGestureController({
		getScale: () => deps.getScale(),
		getStageOrigin: () => stageOrigin(host),
		getTool: () => editor.inkOps.tool,
		onStrokeStart: () => {
			editor.interactionActive = true;
		},
		onStrokePreview: (points) => {
			editor.inkOps.previewStroke(points);
		},
		onStrokeEnd: (points) => {
			editor.interactionActive = false;
			editor.inkOps.commitStroke(points);
		},
		onErase: (point) => {
			editor.inkOps.eraseElementAt(point);
		},
	});
}

/** The editing keymap (delete / duplicate / nudge / clipboard / undo / group / ...). */
export function createEditorKeydown(host: EditorControllerHost): (event: KeyboardEvent) => void {
	const { editor, deps } = host;
	return createEditorKeydownHandler({
		isActive: () => editor.editable && !deps.getPresenting() && host.getEditingId() === null,
		getSelectedId: () => editor.selectedElementId,
		deselect: () => editor.select(null),
		deleteSelected: () => editor.deleteSelected(),
		duplicateSelected: () => void editor.duplicateSelected(),
		nudgeSelected: (dx, dy) => editor.nudgeSelected(dx, dy),
		undo: () => editor.undo(),
		redo: () => editor.redo(),
		copySelected: () => editor.clipboardOps.copySelected(),
		cutSelected: () => editor.clipboardOps.cutSelected(),
		paste: () => void editor.clipboardOps.pasteClipboard(),
		selectAll: () => {
			// Template-owned elements are only selectable while edit-template mode
			// is on, so the same interactivity rule the pointer uses applies here.
			const ids = host
				.currentElements()
				.filter((element) => editor.isElementInteractive(element.id))
				.map((element) => element.id);
			if (ids.length > 0) {
				editor.selection.setAll(ids);
			}
		},
		groupSelected: () => editor.arrangeOps.groupSelected(),
		ungroupSelected: () => editor.arrangeOps.ungroupSelected(),
		cancelFormatPainter: () => {
			const active = editor.formatPainter.active;
			editor.formatPainter.cancel();
			return active;
		},
		toggleShortcuts: () => deps.toggleShortcuts?.(),
		closeShortcuts: () => deps.closeShortcuts?.() ?? false,
	});
}

/** Multi-selection drag + the empty-canvas rubber-band marquee. */
export function createSelectionGestures(
	host: EditorControllerHost,
): ReturnType<typeof createSelectionGestureController> {
	const { editor, deps } = host;
	return createSelectionGestureController({
		getScale: () => deps.getScale(),
		getStageRect: () => deps.getHolderEl()?.getBoundingClientRect(),
		getElements: () => host.currentElements(),
		getSelectedIds: () => editor.selection.ids,
		onStart: () => {
			editor.pushHistory();
			editor.interactionActive = true;
		},
		onPatch: (id, patch) => editor.patchGeometry(id, patch),
		onCommit: () => {
			editor.interactionActive = false;
			editor.commitChange();
		},
		onSelect: (ids) => editor.selection.setAll(ids),
		onMarquee: (rect) => host.setMarquee(rect),
	});
}
