import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
} from 'pptx-viewer-core';
import { partitionTemplateElements } from 'pptx-viewer-shared';

import { createEditorSnapshot, saveEditorDocument } from './editor-document-state';
import type { EditorSnapshot } from './editor-document-state';
import type { EditorState } from './editor-state.svelte';

/**
 * Deck-level lifecycle for {@link EditorState}: adopting a freshly loaded
 * document, resetting, taking a remote (collaboration) snapshot, restoring an
 * undo snapshot, editing document metadata, and serialising back to bytes.
 *
 * These are free functions over the state rather than methods because
 * `EditorState` is already a facade over thirteen focused controllers, and
 * document lifecycle is simply the fourteenth concern; keeping it here is what
 * holds that file within the repo's file-size budget.
 */

/**
 * Everything a load hands the editor, in the order `PptxHandler` produces it.
 * Declared once here as a labelled tuple so `EditorState.setSlides` can forward
 * it verbatim without restating eleven parameters (and their defaults).
 */
export type LoadDocumentArgs = [
	slides: PptxSlide[],
	slideMasters?: PptxSlideMaster[],
	notesMaster?: PptxNotesMaster,
	handoutMaster?: PptxHandoutMaster,
	sections?: PptxSection[],
	coreProperties?: PptxCoreProperties,
	appProperties?: PptxAppProperties,
	customProperties?: PptxCustomProperty[],
	headerFooter?: PptxHeaderFooter,
	presentationProperties?: PptxPresentationProperties,
	customShows?: PptxCustomShow[],
];

/**
 * Install a loaded deck as the editor's working document. Everything is
 * deep-cloned so later edits never write through to the loader's parse result,
 * and the editing session (selection, history, dirty flag, ink tool) is reset.
 */
export function loadEditorDocument(state: EditorState, ...args: LoadDocumentArgs): void {
	const [
		slides,
		slideMasters = [],
		notesMaster,
		handoutMaster,
		sections = [],
		coreProperties,
		appProperties,
		customProperties = [],
		headerFooter = {},
		presentationProperties = {},
		customShows = [],
	] = args;
	const partition = partitionTemplateElements(slides);
	state.slides = partition.slides;
	state.templateElementsBySlideId = partition.templateElementsBySlideId;
	state.slideMasters = structuredClone(slideMasters);
	state.notesMaster = structuredClone(notesMaster);
	state.handoutMaster = structuredClone(handoutMaster);
	state.sections = structuredClone(sections);
	state.coreProperties = structuredClone(coreProperties);
	state.appProperties = structuredClone(appProperties);
	state.customProperties = structuredClone(customProperties);
	// Cleared here, then seeded by `adoptTagCollections` once the loader has
	// parsed the tag parts; a freshly created deck legitimately has none.
	state.tagCollections = [];
	state.presentationMetadata.set(headerFooter, presentationProperties, customShows);
	resetEditorSession(state);
}

/** Clear the editing session (selection, history, dirty flag) without touching content. */
export function resetEditorSession(state: EditorState): void {
	state.masterViewTarget = null;
	state.selection.clear();
	state.editTemplateMode = false;
	state.dirty = false;
	state.interactionActive = false;
	state.history.clear();
	state.elementOps.resetNudge();
	state.inkOps.setTool('select');
}

/**
 * Replace the working slides with a remote (collaboration) snapshot without
 * recording an undo step or touching the dirty flag: the granular reconcile
 * already merged the peer's change, and treating an incoming remote edit as
 * a local mutation would both pollute the undo stack and re-broadcast it.
 *
 * Selection is preserved when the selected element still exists so a remote
 * edit does not yank the local user's selection out from under them. Local
 * undo history is intentionally kept (see the collaboration module JSDoc):
 * shared defines no collaborative-undo semantics, so, matching React/Vue,
 * local undo may fight a concurrent remote edit.
 */
export function applyRemoteEditorSlides(state: EditorState, slides: PptxSlide[]): void {
	const partition = partitionTemplateElements(slides);
	state.slides = partition.slides;
	state.templateElementsBySlideId = partition.templateElementsBySlideId;
	state.selection.prune((id) => state.activeElements.some((element) => element.id === id));
}

/**
 * Restore an undo/redo snapshot. The snapshot is re-cloned on the way in so the
 * stacked entry stays pristine and can be restored again (redo, then undo).
 */
export function restoreEditorSnapshot(
	state: EditorState,
	snapshot: EditorSnapshot | undefined,
): void {
	if (!snapshot) {
		return;
	}
	const restored = createEditorSnapshot(snapshot);
	state.slides = restored.slides;
	state.templateElementsBySlideId = restored.templateElementsBySlideId;
	state.slideMasters = restored.slideMasters;
	state.notesMaster = restored.notesMaster;
	state.handoutMaster = restored.handoutMaster;
	state.sections = restored.sections;
	state.coreProperties = restored.coreProperties;
	state.appProperties = restored.appProperties;
	state.customProperties = restored.customProperties;
	state.tagCollections = restored.tagCollections;
	state.presentationMetadata.set(
		restored.headerFooter,
		restored.presentationProperties,
		restored.customShows,
	);
	state.interactionActive = false;
	state.selection.prune((id) => state.activeElements.some((element) => element.id === id));
	state.commitChange();
}

/** Replace the document properties (File > Info) as one undoable edit. */
export function updateEditorDocumentProperties(
	state: EditorState,
	core: PptxCoreProperties,
	app: PptxAppProperties,
	custom: PptxCustomProperty[],
): void {
	if (!state.editable) {
		return;
	}
	state.pushHistory();
	state.coreProperties = { ...core };
	state.appProperties = { ...app };
	state.customProperties = custom.map((property) => ({ ...property }));
	state.commitChange();
}

/** Replace the tag collections as one undoable edit (inspector Tags section). */
export function updateEditorTagCollections(
	state: EditorState,
	next: readonly PptxTagCollection[],
): void {
	if (!state.editable) {
		return;
	}
	state.pushHistory();
	state.tagCollections = next.map((collection) => ({
		...collection,
		tags: collection.tags.map((tag) => ({ ...tag })),
	}));
	state.commitChange();
}

/**
 * Serialise the edited document to `.pptx` bytes. Saves `renderedSlides` (the
 * slides with their inherited template elements folded back in), not the
 * partitioned working array, so master/layout edits persist.
 */
export async function saveEditorState(
	state: EditorState,
	format: PptxSaveFormat = 'pptx',
): Promise<Uint8Array> {
	const handler = state.getHandler();
	if (!handler) {
		throw new Error('No presentation is loaded.');
	}
	const bytes = await saveEditorDocument(
		handler,
		{ ...state.snapshot(), slides: state.renderedSlides },
		format,
	);
	state.dirty = false;
	return bytes;
}
