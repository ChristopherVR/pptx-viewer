import type { PptxElement } from 'pptx-viewer-core';
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import {
	applyPasteSpecialFormat,
	buildElementClipboardPayload,
	cloneElementForPaste,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * Cut/copy/paste actions for the ribbon's Home > Clipboard group, backed by
 * the shared `element-clipboard.ts` codec. The in-memory clipboard payload
 * lives on `ViewerState.clipboardPayload` (not a module-level variable) so
 * the ribbon's selection sync can reactively enable/disable the Paste button.
 */
export interface ClipboardActions {
	copy(): void;
	cut(): void;
	paste(): void;
	/** Paste Special (Ctrl+Alt+V) / the dialog's OK: paste with `format` applied. */
	pasteWithFormat(format: PasteSpecialFormat): string | null;
	/**
	 * Re-derive an already-pasted element (the Paste Options toolbar) from its
	 * own pristine source clone. Non-cumulative: every choice starts over from
	 * that clone, matching PowerPoint's own toolbar. "Picture" is handled by
	 * the caller (it needs a DOM rasterize step this module does not perform)
	 * via `replaceElement`.
	 */
	reformatPasted(elementId: string, sourceClone: PptxElement, format: PasteSpecialFormat): void;
	/** Replace one element by id, e.g. after rasterizing it to a picture. */
	replaceElement(elementId: string, next: PptxElement): void;
}

export interface ClipboardActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createClipboardActions(deps: ClipboardActionsDeps): ClipboardActions {
	const { store, ops } = deps;

	return {
		copy() {
			const el = ops.selectedElement(store.get());
			if (!el) {
				return;
			}
			store.set({ clipboardPayload: buildElementClipboardPayload(el, false) });
		},

		cut() {
			const state = store.get();
			const el = ops.selectedElement(state);
			if (!state.editable || !el) {
				return;
			}
			store.set({ clipboardPayload: buildElementClipboardPayload(el, false) });
			ops.deleteSelected();
		},

		paste() {
			const state = store.get();
			const payload = state.clipboardPayload;
			if (!state.editable || !payload || !state.slides[state.currentSlide]) {
				return;
			}
			const clone = cloneElementForPaste(payload.element);
			ops.pushHistory();
			store.set({
				...replaceActiveElements(state, [...getActiveElements(state), clone]),
				selectedElementId: clone.id,
				selectedElementIds: [clone.id],
				// A plain paste IS "Keep Source Formatting": the clone is its own
				// pristine source, so the Paste Options toolbar's later choices
				// always re-derive from it, never from an already-transformed
				// element.
				pasteOptionsToolbar: [{ id: clone.id, sourceClone: clone }],
			});
			ops.commitChange();
		},

		pasteWithFormat(format) {
			const state = store.get();
			const payload = state.clipboardPayload;
			if (!state.editable || !payload || !state.slides[state.currentSlide]) {
				return null;
			}
			const sourceClone = cloneElementForPaste(payload.element);
			// "Picture" is inserted as the plain clone first (there is nothing to
			// rasterize before it is mounted); every other format applies immediately.
			const inserted =
				format === 'picture' ? sourceClone : applyPasteSpecialFormat(sourceClone, format);
			ops.pushHistory();
			store.set({
				...replaceActiveElements(state, [...getActiveElements(state), inserted]),
				selectedElementId: inserted.id,
				selectedElementIds: [inserted.id],
				pasteOptionsToolbar: [{ id: inserted.id, sourceClone }],
			});
			ops.commitChange();
			return inserted.id;
		},

		reformatPasted(elementId, sourceClone, format) {
			if (format === 'picture') {
				return;
			}
			replaceElement(store, ops, elementId, applyPasteSpecialFormat(sourceClone, format));
		},

		replaceElement(elementId, next) {
			replaceElement(store, ops, elementId, next);
		},
	};
}

/** Replace one element by id on the active slide/template store, e.g. after rasterizing it to a picture. */
function replaceElement(
	store: Store<ViewerState>,
	ops: EditorOps,
	elementId: string,
	next: PptxElement,
): void {
	const state = store.get();
	ops.pushHistory();
	store.set(
		replaceActiveElements(
			state,
			getActiveElements(state).map((el) => (el.id === elementId ? next : el)),
		),
	);
	ops.commitChange();
}
