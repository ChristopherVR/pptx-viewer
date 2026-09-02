import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxElement,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxHandler,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	TextSegment,
} from 'pptx-viewer-core';
import { duplicateElement } from 'pptx-viewer-core';
import type { ElementBoxPatch } from 'pptx-viewer-shared';
import {
	applyFormatToElement,
	buildSaveSlides,
	cloneSlides,
	cloneTemplateElementsBySlideId,
	copyFormatFromElement,
	EditorHistory,
	embeddedFontSaveOptions,
	resolveSlideSizeSelection,
	saveDeckWithPassword,
	updateSlideNotes,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import {
	findActiveElement,
	getActiveElements,
	replaceActiveElements,
} from './editor-active-elements';
import { setHandoutSlidesPerPage } from './editor-master-actions';
import { selectionState } from './editor-selection-state';
import { createStructuredEditorOperations } from './editor-structured-operations';
import { remapInlineText, resolveInlineTextAutoFitHeight } from './inline-text-editor';

/**
 * History-tracked editing operations over the viewer store: the vanilla
 * counterpart of Vue's `useEditorOperations` + `useEditorHistory`, built on
 * the shared `EditorHistory` stack and the pure `editor-mutations` helpers.
 *
 * Operations snapshot, mutate immutably, mark dirty, and notify the host.
 */
export interface EditorOpsDeps {
	store: Store<ViewerState>;
	getHandler(): PptxHandler | null;
	/** Host `onChange` callback: fired after every committed mutation. */
	onChange?: () => void;
	/** Fired whenever canUndo/canRedo may have changed (toolbar refresh). */
	onHistoryChange(): void;
	/** Options > Proofing > AutoCorrect, applied to committed inline-edit text. */
	transformCommittedText?: (text: string) => string;
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
	/** Change the handout master layout with full undo/save integration. */
	setHandoutSlidesPerPage(count: number): void;
	applyFormatPainter(sourceId: string, targetId: string): boolean;
	commitTableCell(id: string, row: number, column: number, text: string): void;
	updateEquation(id: string, omml: Record<string, unknown>): void;
	updateDocumentProperties(
		core: PptxCoreProperties,
		app: PptxAppProperties,
		custom: PptxCustomProperty[],
	): void;
	updatePresentationProperties(value: PptxPresentationProperties): void;
	/** Replace the whole section list as one undoable step (AI deck seam). */
	updateSections(value: PptxSection[]): void;
	updateHeaderFooter(value: PptxHeaderFooter): void;
	updateCustomShows(value: PptxCustomShow[]): void;
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	clearHistory(): void;
	/** File > Options > Advanced > "Maximum number of undos". */
	setHistoryDepth(depth: number): void;
	save(format?: PptxSaveFormat): Promise<Uint8Array>;
}

interface EditorSnapshot {
	slides: PptxSlide[];
	sections: PptxSection[];
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties: PptxCustomProperty[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	slideMasters: PptxSlideMaster[];
	notesMaster?: PptxNotesMaster;
	handoutMaster?: PptxHandoutMaster;
	handoutSlidesPerPage: number;
	presentationProperties: PptxPresentationProperties;
	headerFooter: PptxHeaderFooter;
	customShows: PptxCustomShow[];
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
		store.set(selectionState(id, ids));
	const snapshot = (): EditorSnapshot => ({
		slides: cloneSlides(store.get().slides),
		sections: structuredClone(store.get().sections),
		coreProperties: structuredClone(store.get().coreProperties),
		appProperties: structuredClone(store.get().appProperties),
		customProperties: structuredClone(store.get().customProperties),
		templateElementsBySlideId: cloneTemplateElementsBySlideId(
			store.get().templateElementsBySlideId,
		),
		slideMasters: structuredClone(store.get().slideMasters),
		notesMaster: structuredClone(store.get().notesMaster),
		handoutMaster: structuredClone(store.get().handoutMaster),
		handoutSlidesPerPage: store.get().handoutSlidesPerPage,
		presentationProperties: structuredClone(store.get().presentationProperties),
		headerFooter: structuredClone(store.get().headerFooter),
		customShows: structuredClone(store.get().customShows),
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
			sections: structuredClone(next.sections),
			coreProperties: structuredClone(next.coreProperties),
			appProperties: structuredClone(next.appProperties),
			customProperties: structuredClone(next.customProperties),
			templateElementsBySlideId: cloneTemplateElementsBySlideId(next.templateElementsBySlideId),
			slideMasters: structuredClone(next.slideMasters),
			notesMaster: structuredClone(next.notesMaster),
			handoutMaster: structuredClone(next.handoutMaster),
			handoutSlidesPerPage: next.handoutSlidesPerPage,
			presentationProperties: structuredClone(next.presentationProperties),
			headerFooter: structuredClone(next.headerFooter),
			customShows: structuredClone(next.customShows),
			interactionActive: false,
		});
		commitChange();
	};
	const structured = createStructuredEditorOperations({
		store,
		pushHistory,
		commitChange,
		transformCommittedText: deps.transformCommittedText,
	});

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

		commitInlineText(id, rawText) {
			const state = store.get();
			const target = findActiveElement(state, id);
			if (!target) {
				return;
			}
			const text = deps.transformCommittedText ? deps.transformCommittedText(rawText) : rawText;
			pushHistory();
			// `a:spAutoFit`: grow/shrink the shape to the text's natural content
			// height, the way PowerPoint does. See `resolveInlineTextAutoFitHeight`
			// for why the editor DOM node is still resolvable here.
			const editorEl =
				typeof document !== 'undefined'
					? document.querySelector<HTMLElement>('[data-inline-editor]')
					: null;
			const newHeight = resolveInlineTextAutoFitHeight(target, editorEl);
			store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === id
							? ({
									...element,
									...remapInlineText(target, text),
									...(newHeight !== undefined ? { height: newHeight } : {}),
								} as PptxElement)
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

		setHandoutSlidesPerPage(count) {
			setHandoutSlidesPerPage({ store, pushHistory, commitChange }, count);
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

		...structured,

		updateDocumentProperties(core, app, custom) {
			if (!store.get().editable) {
				return;
			}
			pushHistory();
			store.set({
				coreProperties: structuredClone(core),
				appProperties: structuredClone(app),
				customProperties: structuredClone(custom),
			});
			commitChange();
		},

		updatePresentationProperties(value) {
			if (!store.get().editable) {
				return;
			}
			pushHistory();
			store.set({ presentationProperties: structuredClone(value) });
			commitChange();
		},

		updateSections(value) {
			if (!store.get().editable) {
				return;
			}
			pushHistory();
			store.set({ sections: structuredClone(value) });
			commitChange();
		},

		updateHeaderFooter(value) {
			if (!store.get().editable) {
				return;
			}
			pushHistory();
			store.set({ headerFooter: structuredClone(value) });
			commitChange();
		},

		updateCustomShows(value) {
			if (!store.get().editable) {
				return;
			}
			pushHistory();
			store.set({ customShows: structuredClone(value) });
			commitChange();
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
		setHistoryDepth(depth) {
			history.setMaxDepth(depth);
		},

		async save(format: PptxSaveFormat = 'pptx') {
			const handler = deps.getHandler();
			if (!handler) {
				throw new Error('No presentation is loaded.');
			}
			const state = store.get();
			// File > Info > Protect Presentation: the shared decision routes a
			// protected deck through `saveEncrypted`, so the downloaded file is an
			// encrypted OLE2 container rather than a plain ZIP.
			const bytes = await saveDeckWithPassword(
				handler,
				buildSaveSlides(state.slides, state.templateElementsBySlideId),
				{
					sections: state.sections.length > 0 ? state.sections : undefined,
					coreProperties: state.coreProperties,
					appProperties: state.appProperties,
					customProperties: state.customProperties.length > 0 ? state.customProperties : undefined,
					headerFooter: state.headerFooter,
					presentationProperties: state.presentationProperties,
					// Deck view preferences (grid/snap/guide toggles, `p:viewPr`): without
					// this the serialiser fell back to whatever `ppt/viewProps.xml` said
					// at load time, so a toggle flipped in the ribbon never reached a
					// saved file (see `viewPropertiesPatchFromPreferences` write-back in
					// `editor-edit-ops.ts`'s `toggleViewOption`).
					viewProperties: state.viewProperties,
					customShows: state.customShows.length ? state.customShows : undefined,
					tags: state.tagCollections.length > 0 ? state.tagCollections : undefined,
					slideMasters: state.slideMasters,
					notesMaster: state.notesMaster,
					handoutMaster: state.handoutMaster,
					outputFormat: format,
					// Design > Slide Size. Omitting the option makes core re-emit the
					// load-time `p:sldSz` verbatim, so a preset or orientation pick made
					// in the inspector never reached the written file. The EMU state
					// wins wherever it still agrees with the pixel canvas (a pixel
					// round-trip would cost Ledger its preset identity); once the raw
					// W/H inputs disagree, the pixels win.
					slideSize: resolveSlideSizeSelection({
						current: state.slideSize,
						canvas: state.canvasSize,
					}).size,
					// File > Fonts > "Embed fonts in the file": off strips the deck's
					// embedded font data from the written package. The toggle reached
					// no save call at all before this, so it changed nothing.
					...embeddedFontSaveOptions(state.embedFonts),
				},
				{
					password: state.presentationPassword,
					passwordProtected: state.presentationPassword !== null,
				},
			);
			store.set({ dirty: false });
			return bytes;
		},
	};
}
