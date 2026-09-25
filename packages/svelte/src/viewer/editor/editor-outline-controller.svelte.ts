import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import type { EditPointsElementPatch, FreeformToolKind } from 'pptx-viewer-shared';
import { canEditElementPoints } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/**
 * EditorOutlineController: state for the two outline-authoring modes, Edit
 * Points on one shape and the armed Freeform: Shape / Curve drawing tool
 * (Svelte counterpart of React's `useEditPointsState` + `useOutlineAuthoring`).
 * At most one is active: arming a tool ends Edit Points and starting Edit
 * Points disarms the tool. Every behaviour (hit targets, drags, the vertex /
 * segment menu, the element patch) lives in the shared sessions; this only
 * holds which mode is on and routes their results through `EditorState`, so
 * each commit is one undo step. Instantiated as `EditorState.outlineOps`.
 */
export class EditorOutlineController {
	readonly #editor: EditorState;

	/** The shape in Edit Points mode, or null. */
	editPointsId = $state<string | null>(null);
	/** The armed click-to-place drawing tool, or null. */
	freeformTool = $state<FreeformToolKind | null>(null);

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	/** The shape being edited, while it still exists on the active layer. */
	get editPointsElement(): PptxElement | undefined {
		const id = this.editPointsId;
		return id ? this.#editor.activeElements.find((element) => element.id === id) : undefined;
	}

	/** Enter Edit Points on `id` when the shape allows it (not `noEditPoints`). */
	startEditPoints(id: string): void {
		const element = this.#editor.activeElements.find((candidate) => candidate.id === id);
		if (!this.#editor.editable || !canEditElementPoints(element)) {
			return;
		}
		this.freeformTool = null;
		this.editPointsId = id;
	}

	exitEditPoints(): void {
		this.editPointsId = null;
	}

	/** Apply one Edit Points edit as one undo step. */
	commitEditPoints(id: string, patch: EditPointsElementPatch): void {
		this.#editor.applyElementPatch(id, patch as Partial<PptxElement>);
	}

	/** Arm (or, with null, disarm) a drawing tool. */
	armFreeformTool(tool: FreeformToolKind | null): void {
		this.freeformTool = tool;
		if (tool) {
			this.editPointsId = null;
			if (this.#editor.inkOps.tool !== 'select') {
				this.#editor.inkOps.setTool('select');
			}
		}
	}

	/** Insert a drawn freeform (selected, one undo step) and disarm. */
	commitFreeform(shape: ShapePptxElement): void {
		this.freeformTool = null;
		this.#editor.insertElement(shape);
	}
}
