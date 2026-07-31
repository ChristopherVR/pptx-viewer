import { EditorHistory } from 'pptx-viewer-shared';

import type { EditorSnapshot } from './editor-document-state';

/** PowerPoint's own default for File > Options > Advanced > "maximum number of undos". */
export const MAX_HISTORY_ENTRIES = 100;

/**
 * The editor's undo/redo stack, wrapped so `canUndo` / `canRedo` are runes the
 * chrome can read directly.
 *
 * The shared {@link EditorHistory} is a plain (non-reactive) structure, so
 * every mutation has to be followed by a flag re-read; doing that in one place
 * here is what stops a missed `#syncHistoryFlags()` call leaving the ribbon's
 * Undo button greyed out after a real edit. Extracted from `EditorState` to
 * keep that file within the repo's file-size budget.
 */
export class EditorHistoryState {
	#history = new EditorHistory<EditorSnapshot>({ maxDepth: MAX_HISTORY_ENTRIES });
	#depth = MAX_HISTORY_ENTRIES;
	#canUndo = $state(false);
	#canRedo = $state(false);

	get canUndo(): boolean {
		return this.#canUndo;
	}

	get canRedo(): boolean {
		return this.#canRedo;
	}

	/** Re-read the stack's availability flags onto the reactive mirrors. */
	sync(): void {
		this.#canUndo = this.#history.canUndo;
		this.#canRedo = this.#history.canRedo;
	}

	/**
	 * Apply the File > Options "maximum number of undos" value. Recreates the
	 * stack when the depth changes (PowerPoint likewise applies the new maximum
	 * going forward; existing entries are dropped).
	 */
	setDepth(depth: number): void {
		if (depth === this.#depth) {
			return;
		}
		this.#depth = depth;
		this.#history = new EditorHistory<EditorSnapshot>({ maxDepth: depth });
		this.sync();
	}

	record(snapshot: EditorSnapshot): void {
		this.#history.record(snapshot, '');
		this.sync();
	}

	clear(): void {
		this.#history.clear();
		this.sync();
	}

	undo(current: EditorSnapshot): EditorSnapshot | undefined {
		return this.#history.undo(current)?.snapshot;
	}

	redo(current: EditorSnapshot): EditorSnapshot | undefined {
		return this.#history.redo(current)?.snapshot;
	}
}
