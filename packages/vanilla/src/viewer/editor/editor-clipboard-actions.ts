import { buildElementClipboardPayload, cloneElementForPaste } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { appendElementOnSlide } from './editor-mutations';
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
				slides: appendElementOnSlide(state.slides, state.currentSlide, clone),
				selectedElementId: clone.id,
			});
			ops.commitChange();
		},
	};
}
