import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	cancelCropUpdate,
	canCropElement,
	cropFill,
	cropFit,
	cropFrameOf,
	cropSessionChanged,
	cropToAspectRatio,
	readCropInsets,
	startCropSession,
} from 'pptx-viewer-shared';
import type { CropElementUpdate, NaturalImageSize } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * Picture Format > Crop: the on-canvas crop mode lifecycle plus the one-click
 * crops under the Crop dropdown. The decisions (what may be cropped, what a
 * drag or preset does, whether anything changed) are the shared
 * `picture-crop` module; this file owns only the store/history wiring.
 *
 * History contract: every live frame during crop mode is written WITHOUT
 * history. Committing leaves exactly one undo step whose undo restores the
 * pre-crop picture; cancelling writes the snapshot back and leaves none.
 */
export interface CropActions {
	/** Ribbon Crop button: enter crop mode, or commit it when already on. */
	toggleCropMode(): void;
	/** Enter crop mode on the single selected croppable picture. */
	enterCropMode(): void;
	/** Keep the crop (one undo step when anything changed) and leave crop mode. */
	commitCropMode(): void;
	/** Restore the pre-crop picture and leave crop mode with no undo step. */
	cancelCropMode(): void;
	/** Apply a crop drag frame live, without history. */
	previewCrop(update: CropElementUpdate): void;
	cropToAspect(ratioWidth: number, ratioHeight: number): void;
	cropFill(): void;
	cropFit(): void;
}

export interface CropActionsDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
}

/** The element anywhere in the deck (a slide change may already have moved the view on). */
function findElementAnywhere(state: ViewerState, id: string): PptxElement | undefined {
	const active = getActiveElements(state).find((element) => element.id === id);
	if (active) {
		return active;
	}
	for (const slide of state.slides) {
		const found = slide.elements.find((element) => element.id === id);
		if (found) {
			return found;
		}
	}
	return undefined;
}

const applyUpdate = (element: PptxElement, update: CropElementUpdate): PptxElement =>
	({ ...element, ...update }) as PptxElement;

/** The state patch writing `update` onto element `id`, wherever it lives. */
function patchElement(
	state: ViewerState,
	id: string,
	update: CropElementUpdate,
): Partial<ViewerState> {
	const active = getActiveElements(state);
	if (active.some((element) => element.id === id)) {
		return replaceActiveElements(
			state,
			active.map((element) => (element.id === id ? applyUpdate(element, update) : element)),
		);
	}
	return {
		slides: state.slides.map((slide): PptxSlide =>
			slide.elements.some((element) => element.id === id)
				? {
						...slide,
						elements: slide.elements.map((element) =>
							element.id === id ? applyUpdate(element, update) : element,
						),
					}
				: slide,
		),
	};
}

/** The picture's current box + insets, as a crop update. */
const currentCrop = (element: PptxElement): CropElementUpdate => ({
	...cropFrameOf(element),
	...readCropInsets(element),
});

/** The rendered bitmap's natural size, when the picture is on screen and decoded. */
function naturalSizeOf(doc: Document, id: string): NaturalImageSize | undefined {
	const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
	const img = doc.querySelector<HTMLImageElement>(`[data-element-id="${escaped}"] img`);
	return img && img.naturalWidth > 0 && img.naturalHeight > 0
		? { width: img.naturalWidth, height: img.naturalHeight }
		: undefined;
}

export function createCropActions(deps: CropActionsDeps): CropActions {
	const { doc, store, ops } = deps;

	const selectedCroppable = (state: ViewerState): PptxElement | undefined => {
		if (!state.editable || state.selectedElementIds.length !== 1) {
			return undefined;
		}
		const element = ops.selectedElement(state);
		return canCropElement(element) ? element : undefined;
	};

	/**
	 * A one-click crop: live while crop mode is on (so it joins that session's
	 * single undo step), otherwise one undoable update of its own.
	 */
	const applyOneShot = (build: (element: PptxElement) => CropElementUpdate): void => {
		const state = store.get();
		const session = state.cropSession;
		const element = session
			? findElementAnywhere(state, session.elementId)
			: selectedCroppable(state);
		if (!element) {
			return;
		}
		const update = build(element);
		if (session) {
			store.set(patchElement(state, element.id, update));
			return;
		}
		ops.pushHistory();
		store.set(patchElement(state, element.id, update));
		ops.commitChange();
	};

	const enterCropMode = (): void => {
		const state = store.get();
		if (state.cropSession) {
			return;
		}
		const session = startCropSession(selectedCroppable(state));
		if (session) {
			store.set({ cropSession: session });
		}
	};

	const commitCropMode = (): void => {
		const state = store.get();
		const session = state.cropSession;
		if (!session) {
			return;
		}
		const element = findElementAnywhere(state, session.elementId);
		if (!element || !cropSessionChanged(session, element)) {
			store.set({ cropSession: null });
			return;
		}
		const now = currentCrop(element);
		// Put the snapshot back silently so the history entry records the
		// PRE-crop picture, then write the final crop as the one undoable step.
		store.set({
			...patchElement(state, session.elementId, cancelCropUpdate(session)),
			cropSession: null,
		});
		ops.pushHistory();
		store.set(patchElement(store.get(), session.elementId, now));
		ops.commitChange();
	};

	const cancelCropMode = (): void => {
		const state = store.get();
		const session = state.cropSession;
		if (!session) {
			return;
		}
		store.set({
			...patchElement(state, session.elementId, cancelCropUpdate(session)),
			cropSession: null,
			interactionActive: false,
		});
	};

	return {
		toggleCropMode() {
			if (store.get().cropSession) {
				commitCropMode();
			} else {
				enterCropMode();
			}
		},
		enterCropMode,
		commitCropMode,
		cancelCropMode,
		previewCrop(update) {
			const state = store.get();
			if (state.cropSession) {
				store.set(patchElement(state, state.cropSession.elementId, update));
			}
		},
		cropToAspect: (ratioWidth, ratioHeight) =>
			applyOneShot((element) => cropToAspectRatio(element, ratioWidth, ratioHeight)),
		cropFill: () => applyOneShot((element) => cropFill(element, naturalSizeOf(doc, element.id))),
		cropFit: () => applyOneShot((element) => cropFit(element, naturalSizeOf(doc, element.id))),
	};
}
