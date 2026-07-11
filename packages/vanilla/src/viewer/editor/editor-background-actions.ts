import type { Store, ViewerState } from '../state';
import { updateSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';

/**
 * Slide-background actions for the ribbon's Design > Format Background panel.
 * Solid-colour fill only (matches the docked panel's scope: a single colour
 * input); clearing removes every background field so the slide falls back to
 * its layout/master background. Both mutations are history-integrated,
 * mirroring `editor-slide-actions.ts`.
 */
export interface SlideBackgroundActions {
	setSlideBackgroundColor(color: string): void;
	clearSlideBackground(): void;
}

export interface SlideBackgroundActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createSlideBackgroundActions(
	deps: SlideBackgroundActionsDeps,
): SlideBackgroundActions {
	const { store, ops } = deps;

	return {
		setSlideBackgroundColor(color) {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			ops.pushHistory();
			store.set({
				slides: updateSlide(state.slides, state.currentSlide, { backgroundColor: color }),
			});
			ops.commitChange();
		},

		clearSlideBackground() {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			ops.pushHistory();
			store.set({
				slides: updateSlide(state.slides, state.currentSlide, {
					backgroundColor: undefined,
					backgroundImage: undefined,
					backgroundGradient: undefined,
					backgroundPattern: undefined,
				}),
			});
			ops.commitChange();
		},
	};
}
