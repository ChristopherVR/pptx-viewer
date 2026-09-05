/**
 * buildDeckSaveOptions: the ONE assembler for the `PptxHandlerSaveOptions`
 * object every binding's main "download / getContent" path passes to
 * `handler.save(...)` / `saveDeckWithPassword(...)`.
 *
 * Before this module existed, React's `useSerialize`, Vue's `useLoadContent`,
 * Angular's `LoadContentService`, Svelte's `saveEditorDocument`, and Vanilla's
 * `editor-operations` each hand-assembled this object independently. They
 * agreed field-for-field by convention, not by construction, which is exactly
 * the kind of drift Rule 2 in CLAUDE.md exists to prevent: a future save
 * option added to one binding and forgotten in the other four would silently
 * ship. Routing every binding's main save path through this single function
 * makes that drift structurally impossible.
 *
 * `DeckSaveState` is the plain-value snapshot every binding already holds
 * (React/Angular in component state/signals, Vue/Svelte/Vanilla in refs or a
 * reactive store) at the moment it serialises. Slide-size RESOLUTION
 * (`resolveSlideSizeSelection`) stays a binding-side concern, since it needs
 * the live canvas size alongside the EMU value; callers pass the already
 * resolved `slideSize` here.
 *
 * @module render/deck-save-options
 */
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxHandlerSaveOptions,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlideMaster,
	PptxSlideSize,
	PptxTagCollection,
	PptxViewProperties,
} from 'pptx-viewer-core';

import { embeddedFontSaveOptions } from './font-embedding';
import { tableStyleSaveOptions } from './table-style-map-edits';
import type { TableStyleSaveOptionsState } from './table-style-map-edits';

/** The plain-value snapshot a binding's main serialize path assembles from. */
export interface DeckSaveState {
	headerFooter: PptxHeaderFooter | undefined;
	presentationProperties: PptxPresentationProperties;
	/** `ppt/viewProps.xml` (grid/snap/guides toggles, grid spacing). */
	viewProperties?: PptxViewProperties | undefined;
	customShows: readonly PptxCustomShow[];
	sections: readonly PptxSection[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	customProperties: readonly PptxCustomProperty[];
	tagCollections: readonly PptxTagCollection[];
	slideMasters: readonly PptxSlideMaster[] | undefined;
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	/** Already-resolved `p:sldSz`; omit to preserve the load-time dimensions. */
	slideSize?: PptxSlideSize | undefined;
	/** Target output format. Omit to keep core's own default (`'pptx'`). */
	outputFormat?: PptxSaveFormat | undefined;
	/** File > Fonts > "Embed fonts in the file". Defaults to `true`. */
	embedFonts?: boolean | undefined;
	tableStyleMap: TableStyleSaveOptionsState['tableStyleMap'];
	tableStylesDefaultId: TableStyleSaveOptionsState['tableStylesDefaultId'];
	tableStylesToDelete: TableStyleSaveOptionsState['tableStylesToDelete'];
}

/**
 * Assemble the full `PptxHandlerSaveOptions` for a binding's main save path.
 * Array-valued fields are omitted (not passed as an empty array) when empty,
 * matching every binding's pre-existing convention and the option docs on
 * `PptxHandlerSaveOptions` itself (an omitted field round-trips the original
 * part verbatim; an empty array would instead clear it).
 */
export function buildDeckSaveOptions(state: DeckSaveState): PptxHandlerSaveOptions {
	return {
		headerFooter: state.headerFooter,
		presentationProperties: state.presentationProperties,
		viewProperties: state.viewProperties,
		customShows: state.customShows.length > 0 ? [...state.customShows] : undefined,
		sections: state.sections.length > 0 ? [...state.sections] : undefined,
		coreProperties: state.coreProperties,
		appProperties: state.appProperties,
		customProperties: state.customProperties.length > 0 ? [...state.customProperties] : undefined,
		tags: state.tagCollections.length > 0 ? [...state.tagCollections] : undefined,
		slideMasters: state.slideMasters ? [...state.slideMasters] : [],
		notesMaster: state.notesMaster,
		handoutMaster: state.handoutMaster,
		slideSize: state.slideSize,
		outputFormat: state.outputFormat,
		...tableStyleSaveOptions({
			tableStyleMap: state.tableStyleMap,
			tableStylesDefaultId: state.tableStylesDefaultId,
			tableStylesToDelete: state.tableStylesToDelete,
		}),
		...embeddedFontSaveOptions(state.embedFonts ?? true),
	};
}
