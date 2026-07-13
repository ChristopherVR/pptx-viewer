import type {
	PptxElement,
	PptxHandler,
	PptxSlide,
	PptxSlideMaster,
	TextSegment,
} from 'pptx-viewer-core';
import { duplicateElement } from 'pptx-viewer-core';
import {
	applyFormatToElement,
	buildSaveSlides,
	cloneTemplateElementsBySlideId,
	copyFormatFromElement,
	EditorHistory,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import {
	findActiveElement,
	getActiveElements,
	replaceActiveElements,
} from './editor-active-elements';
import type { ElementBoxPatch } from './editor-mutations';
import { cloneSlides, updateSlideNotes } from './editor-mutations';
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
	select(id: string | null, ids?: string[]): void;
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
	applyFormatPainter(sourceId: string, targetId: string): boolean;
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	clearHistory(): void;
	save(): Promise<Uint8Array>;
}

interface EditorSnapshot {
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	slideMasters: PptxSlideMaster[];
}

const MAX_HISTORY_ENTRIES = 100;
/** Consecutive arrow-key nudges within this window share one history entry. */
const NUDGE_COALESCE_MS = 800;

export function createEditorOps(deps: EditorOpsDeps): EditorOps {
	const { store } = deps;
	const history = new EditorHistory<EditorSnapshot>({ maxDepth: MAX_HISTORY_ENTRIES });
	let lastNudgeAt = 0;

	const selectedElement = (state: ViewerState = store.get()): PptxElement | undefined =>
		state.selectedElementId ? findActiveElement(state, state.selectedElementId) : undefined;

	const select = (id: string | null, ids = id ? [id] : []): void =>
		store.set({ selectedElementId: id, selectedElementIds: ids });
	const snapshot = (): EditorSnapshot => ({
		slides: cloneSlides(store.get().slides),
		templateElementsBySlideId: cloneTemplateElementsBySlideId(
			store.get().templateElementsBySlideId,
		),
		slideMasters: structuredClone(store.get().slideMasters),
	});

	const pushHistory = (): void => {
		history.record(snapshot(), '');
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
		const elements = getActiveElements(state).map((element) =>
			element.id === id ? ({ ...element, ...box } as PptxElement) : element,
		);
		store.set(replaceActiveElements(state, elements));
	};

	const restore = (next: EditorSnapshot | undefined): void => {
		if (!next) {
			return;
		}
		store.set({
			slides: cloneSlides(next.slides),
			templateElementsBySlideId: cloneTemplateElementsBySlideId(next.templateElementsBySlideId),
			slideMasters: structuredClone(next.slideMasters),
			interactionActive: false,
		});
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
				...replaceActiveElements(
					state,
					getActiveElements(state).filter(
						(element) => !state.selectedElementIds.includes(element.id),
					),
				),
				selectedElementId: null,
				selectedElementIds: [],
			});
			commitChange();
		},

		duplicateSelected() {
			const state = store.get();
			const id = state.selectedElementId;
			if (!state.editable || !id) {
				return null;
			}
			const source = selectedElement(state);
			if (!source) {
				return null;
			}
			const copy = duplicateElement(source);
			copy.x += 20;
			copy.y += 20;
			pushHistory();
			store.set({
				...replaceActiveElements(state, [...getActiveElements(state), copy]),
				selectedElementId: copy.id,
				selectedElementIds: [copy.id],
			});
			commitChange();
			return copy.id;
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
			store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === id
							? ({ ...element, x: el.x + dx, y: el.y + dy } as PptxElement)
							: element,
					),
				),
			);
			commitChange();
		},

		commitInlineText(id, text) {
			const state = store.get();
			const target = findActiveElement(state, id);
			if (!target) {
				return;
			}
			pushHistory();
			store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === id
							? ({ ...element, ...remapInlineText(target, text) } as PptxElement)
							: element,
					),
				),
			);
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

		applyFormatPainter(sourceId, targetId) {
			const state = store.get();
			const source = findActiveElement(state, sourceId);
			const target = findActiveElement(state, targetId);
			if (!state.editable || !source || !target || sourceId === targetId) {
				return false;
			}
			pushHistory();
			store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === targetId
							? applyFormatToElement(element, copyFormatFromElement(source))
							: element,
					),
				),
			);
			commitChange();
			return true;
		},

		undo() {
			restore(history.undo(snapshot())?.snapshot);
		},
		redo() {
			restore(history.redo(snapshot())?.snapshot);
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
			const state = store.get();
			const bytes = await handler.save(
				buildSaveSlides(state.slides, state.templateElementsBySlideId),
				{
					slideMasters: state.slideMasters,
				},
			);
			store.set({ dirty: false });
			return bytes;
		},
	};
}
