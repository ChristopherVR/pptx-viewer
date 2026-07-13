import type { PptxElement, PptxHandler, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { EditorHistory } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { ElementBoxPatch } from './editor-mutations';
import {
	cloneSlides,
	duplicateElementOnSlide,
	findSlideElement,
	patchElementGeometry,
	removeElement,
	updateElement,
	updateSlideNotes,
} from './editor-mutations';
import { remapInlineText } from './inline-text-editor';

/**
 * History-tracked editing operations over the viewer store: the vanilla
 * counterpart of Vue's `useEditorOperations` + `useEditorHistory`, built on
 * the shared `EditorHistory` stack and the pure `editor-mutations` helpers.
 *
 * Every operation follows the push-before-mutate pattern: snapshot the
 * current (cloned) slides, apply the immutable mutation, commit through the
 * store, mark the document dirty, and fire the host `onChange`.
 */
export interface EditorOpsDeps {
	store: Store<ViewerState>;
	getHandler(): PptxHandler | null;
	/** Host `onChange` callback: fired after every committed mutation. */
	onChange?: () => void;
	/** Fired whenever canUndo/canRedo may have changed (toolbar refresh). */
	onHistoryChange(): void;
}

export interface EditorOps {
	/** The selected element resolved against (optionally provided) state. */
	selectedElement(state?: ViewerState): PptxElement | undefined;
	select(id: string | null): void;
	/** Snapshot the current slides onto the undo stack (before a mutation). */
	pushHistory(): void;
	/** Mark dirty + notify host after a committed mutation. */
	commitChange(): void;
	/** Patch geometry WITHOUT history (live gesture preview frames). */
	patchGeometry(id: string, box: ElementBoxPatch): void;
	deleteSelected(): void;
	duplicateSelected(): string | null;
	nudgeSelected(dx: number, dy: number): void;
	commitInlineText(id: string, text: string): void;
	/** Commit speaker notes and optional rich segments onto the current slide. */
	commitNotes(notes: string, notesSegments?: TextSegment[]): void;
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	clearHistory(): void;
	save(): Promise<Uint8Array>;
}

const MAX_HISTORY_ENTRIES = 100;
/** Consecutive arrow-key nudges within this window share one history entry. */
const NUDGE_COALESCE_MS = 800;

export function createEditorOps(deps: EditorOpsDeps): EditorOps {
	const { store } = deps;
	const history = new EditorHistory<PptxSlide[]>({ maxDepth: MAX_HISTORY_ENTRIES });
	let lastNudgeAt = 0;

	const selectedElement = (state: ViewerState = store.get()): PptxElement | undefined =>
		state.selectedElementId
			? findSlideElement(state.slides, state.currentSlide, state.selectedElementId)
			: undefined;

	const select = (id: string | null): void => store.set({ selectedElementId: id });

	const pushHistory = (): void => {
		history.record(cloneSlides(store.get().slides), '');
		lastNudgeAt = 0;
		deps.onHistoryChange();
	};

	const commitChange = (): void => {
		store.set({ dirty: true });
		deps.onHistoryChange();
		deps.onChange?.();
	};

	const patchGeometry = (id: string, box: ElementBoxPatch): void => {
		const state = store.get();
		store.set({ slides: patchElementGeometry(state.slides, state.currentSlide, id, box) });
	};

	const restore = (snapshot: PptxSlide[] | undefined): void => {
		if (!snapshot) {
			return;
		}
		store.set({ slides: cloneSlides(snapshot), interactionActive: false });
		commitChange();
	};

	return {
		selectedElement,
		select,
		pushHistory,
		commitChange,
		patchGeometry,

		deleteSelected() {
			const state = store.get();
			const id = state.selectedElementId;
			if (!state.editable || !id || !selectedElement(state)) {
				return;
			}
			pushHistory();
			store.set({
				slides: removeElement(state.slides, state.currentSlide, id),
				selectedElementId: null,
			});
			commitChange();
		},

		duplicateSelected() {
			const state = store.get();
			const id = state.selectedElementId;
			if (!state.editable || !id) {
				return null;
			}
			const result = duplicateElementOnSlide(state.slides, state.currentSlide, id);
			if (!result) {
				return null;
			}
			pushHistory();
			store.set({ slides: result.slides, selectedElementId: result.newId });
			commitChange();
			return result.newId;
		},

		nudgeSelected(dx, dy) {
			const state = store.get();
			const el = selectedElement(state);
			const id = state.selectedElementId;
			if (!el || !id) {
				return;
			}
			const now = Date.now();
			if (now - lastNudgeAt > NUDGE_COALESCE_MS) {
				pushHistory();
			}
			lastNudgeAt = now;
			store.set({
				slides: patchElementGeometry(state.slides, state.currentSlide, id, {
					x: el.x + dx,
					y: el.y + dy,
					width: el.width,
					height: el.height,
					rotation: el.rotation ?? 0,
				}),
			});
			commitChange();
		},

		commitInlineText(id, text) {
			const state = store.get();
			const target = findSlideElement(state.slides, state.currentSlide, id);
			if (!target) {
				return;
			}
			pushHistory();
			store.set({
				slides: updateElement(state.slides, state.currentSlide, id, remapInlineText(target, text)),
			});
			commitChange();
		},

		commitNotes(notes, notesSegments) {
			const state = store.get();
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !slide || (slide.notes === notes && notesSegments === undefined)) {
				return;
			}
			pushHistory();
			store.set({
				slides: updateSlideNotes(state.slides, state.currentSlide, notes, notesSegments),
			});
			commitChange();
		},

		undo() {
			restore(history.undo(cloneSlides(store.get().slides))?.snapshot);
		},
		redo() {
			restore(history.redo(cloneSlides(store.get().slides))?.snapshot);
		},
		canUndo: () => history.canUndo,
		canRedo: () => history.canRedo,
		clearHistory() {
			history.clear();
			lastNudgeAt = 0;
			deps.onHistoryChange();
		},

		async save() {
			const handler = deps.getHandler();
			if (!handler) {
				throw new Error('No presentation is loaded.');
			}
			const bytes = await handler.save(store.get().slides);
			store.set({ dirty: false });
			return bytes;
		},
	};
}
