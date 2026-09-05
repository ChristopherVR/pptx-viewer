import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxHandler,
	PptxNotesMaster,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxSlideSize,
	PptxViewProperties,
	PptxPresentationProperties,
	PptxCustomShow,
	PptxTagCollection,
} from 'pptx-viewer-core';
import type { DeckSaveIntent, TableStyleSaveOptions, TemplateElementMap } from 'pptx-viewer-shared';
import {
	buildDeckSaveOptions,
	cloneSlides,
	cloneTemplateElementsBySlideId,
	saveDeckWithPassword,
} from 'pptx-viewer-shared';

export interface EditorSnapshot {
	slides: PptxSlide[];
	templateElementsBySlideId: TemplateElementMap;
	slideMasters: PptxSlideMaster[];
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	sections: PptxSection[];
	headerFooter: PptxHeaderFooter;
	presentationProperties: PptxPresentationProperties;
	customShows: PptxCustomShow[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	customProperties: PptxCustomProperty[];
	/** `ppt/tags/*.xml` name/value metadata, editable in the inspector. */
	tagCollections: PptxTagCollection[];
}

export function createEditorSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
	return {
		slides: cloneSlides(snapshot.slides),
		templateElementsBySlideId: cloneTemplateElementsBySlideId(snapshot.templateElementsBySlideId),
		slideMasters: structuredClone(snapshot.slideMasters),
		notesMaster: structuredClone(snapshot.notesMaster),
		handoutMaster: structuredClone(snapshot.handoutMaster),
		sections: structuredClone(snapshot.sections),
		headerFooter: structuredClone(snapshot.headerFooter),
		presentationProperties: structuredClone(snapshot.presentationProperties),
		customShows: structuredClone(snapshot.customShows),
		coreProperties: structuredClone(snapshot.coreProperties),
		appProperties: structuredClone(snapshot.appProperties),
		customProperties: structuredClone(snapshot.customProperties),
		tagCollections: structuredClone(snapshot.tagCollections),
	};
}

/**
 * Serialise a document snapshot to `.pptx` bytes.
 *
 * `saveIntent` carries the File > Info > Protect Presentation state: when it
 * holds a password the deck goes through `saveEncrypted`, producing an OLE2
 * compound file (`EncryptionInfo` + `EncryptedPackage`) instead of a plain ZIP.
 * The choice is made by the shared `planDeckSave`, so all five bindings agree.
 *
 * `embedFonts` carries File > Fonts > "Embed fonts in the file" the same way:
 * `false` strips `p:embeddedFontLst`, the `/font` relationships and the
 * `.fntdata` parts, while `true` (core's default) re-embeds losslessly. Before
 * this the toggle lived in `Ribbon.svelte`'s local `$state` and reached no save
 * call at all, so the switch moved and the bytes were identical either way.
 *
 * `slideSize` carries Design > Slide Size the same way: omitting the option
 * makes core re-emit the load-time `p:sldSz` verbatim, so a preset or
 * orientation change made in the inspector never reached the written file.
 *
 * `viewProperties` carries the View > Grid/Guides/Snap toggles the same way:
 * omitting it makes core re-emit the load-time `ppt/viewProps.xml` verbatim,
 * so a toggle flipped after load never reached the written file.
 *
 * `tableStyleOptions` carries the table style DEFINITION editor's
 * `tableStyles`/`tableStylesDefaultId`/`tableStylesToDelete` (already picked
 * by the caller via `pptx-viewer-shared`'s `tableStyleSaveOptions`), the same
 * way: omitting it leaves `ppt/tableStyles.xml` untouched.
 */
export async function saveEditorDocument(
	handler: PptxHandler,
	snapshot: EditorSnapshot,
	format: PptxSaveFormat = 'pptx',
	saveIntent?: DeckSaveIntent | string | null,
	embedFonts = true,
	slideSize?: PptxSlideSize,
	viewProperties?: PptxViewProperties,
	tableStyleOptions?: TableStyleSaveOptions,
): Promise<Uint8Array> {
	const metadata = {
		...buildDeckSaveOptions({
			headerFooter: snapshot.headerFooter,
			presentationProperties: snapshot.presentationProperties,
			viewProperties,
			customShows: snapshot.customShows,
			sections: snapshot.sections,
			coreProperties: snapshot.coreProperties,
			appProperties: snapshot.appProperties,
			customProperties: snapshot.customProperties,
			tagCollections: snapshot.tagCollections,
			// Masters are handled separately below (their presence decides which
			// `saveDeckWithPassword` overload branch runs), so this call never sees
			// them; pass an empty snapshot here and let `slideMasters`/`notesMaster`/
			// `handoutMaster` below win via the outer spread.
			slideMasters: undefined,
			notesMaster: undefined,
			handoutMaster: undefined,
			// Omitted when unknown so a deck that never loaded a size is not given one.
			slideSize,
			embedFonts,
			// Table styles are handled below via the caller's already-picked
			// `tableStyleOptions` (spread after this call), not through the raw
			// map/id/delete-list shape this builder otherwise expects.
			tableStyleMap: undefined,
			tableStylesDefaultId: undefined,
			tableStylesToDelete: [],
		}),
		// The table style DEFINITION editor's already-picked
		// `tableStyles`/`tableStylesDefaultId`/`tableStylesToDelete` (via
		// `pptx-viewer-shared`'s `tableStyleSaveOptions`), spread last so it wins
		// over the (necessarily empty) table style fields `buildDeckSaveOptions`
		// computed above from no table-style state.
		...tableStyleOptions,
	};
	const hasMasters =
		snapshot.slideMasters.length > 0 ||
		snapshot.notesMaster !== undefined ||
		snapshot.handoutMaster !== undefined;
	return hasMasters
		? saveDeckWithPassword(
				handler,
				snapshot.slides,
				{
					...metadata,
					// Override the (necessarily empty) master fields `buildDeckSaveOptions`
					// computed above with the real snapshot, since masters are handled
					// here rather than inside the shared builder call.
					slideMasters: snapshot.slideMasters,
					notesMaster: snapshot.notesMaster,
					handoutMaster: snapshot.handoutMaster,
					outputFormat: format,
				},
				saveIntent,
			)
		: saveDeckWithPassword(
				handler,
				snapshot.slides,
				{
					...metadata,
					outputFormat: format,
				},
				saveIntent,
			);
}
