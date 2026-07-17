import type { PptxHandler, PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';

import type { Store, ViewerState } from '../state';
import { updateSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';

/**
 * Deck-level mutations driven by the no-selection inspector Properties tab
 * (React's `PresentationPropertiesPanel`): presentation show settings, theme
 * apply-by-path, per-slide patches (theme override), and slide-canvas resize.
 * The vanilla counterpart of Vue's `useInspectorDeckActions` plus the
 * presentation-settings piece of its `PresentationSettingsCard` wiring.
 */
export interface DeckActions {
	/** Merge a patch into the presentation-level show/print settings. */
	updatePresentationSettings(patch: Partial<PptxPresentationProperties>): void;
	/** Apply a packaged theme part by archive path (React's `handleApplyTheme`). */
	applyThemeByPath(themePath: string, allMasters: boolean): void;
	/** Patch the active slide (inspector THEME OVERRIDE card). */
	updateActiveSlide(patch: Partial<PptxSlide>): void;
	/** Resize the slide canvas (inspector SLIDE SIZE card). */
	updateCanvasSize(size: { width: number; height: number }): void;
}

export interface DeckActionsDeps {
	store: Store<ViewerState>;
	ops: Pick<EditorOps, 'pushHistory' | 'commitChange' | 'updatePresentationProperties'>;
	getHandler(): PptxHandler | null;
}

export function createDeckActions(deps: DeckActionsDeps): DeckActions {
	const { store, ops } = deps;
	return {
		updatePresentationSettings(patch) {
			// Editable guard + history + dirty all live in the underlying op.
			ops.updatePresentationProperties({ ...store.get().presentationProperties, ...patch });
		},

		applyThemeByPath(themePath, allMasters) {
			const handler = deps.getHandler();
			if (!handler || !themePath || !store.get().editable) {
				return;
			}
			void (async () => {
				await handler.setPresentationTheme(themePath, allMasters);
				// A fresh masters array re-renders the stage via the state-sync
				// listener; commitChange marks dirty + notifies the host.
				store.set({
					slideMasters: store
						.get()
						.slideMasters.map((master, index) =>
							allMasters || index === 0 ? { ...master, themePath } : master,
						),
				});
				ops.commitChange();
			})();
		},

		updateActiveSlide(patch) {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			ops.pushHistory();
			store.set({ slides: updateSlide(state.slides, state.currentSlide, patch) });
			ops.commitChange();
		},

		updateCanvasSize(size) {
			if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
				return;
			}
			if (!store.get().editable) {
				return;
			}
			store.set({
				canvasSize: {
					width: Math.max(1, Math.round(size.width)),
					height: Math.max(1, Math.round(size.height)),
				},
			});
			ops.commitChange();
		},
	};
}
