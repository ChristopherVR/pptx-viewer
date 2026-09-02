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
import type { DeckSaveIntent, TemplateElementMap } from 'pptx-viewer-shared';
import {
	cloneSlides,
	cloneTemplateElementsBySlideId,
	embeddedFontSaveOptions,
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
 */
export async function saveEditorDocument(
	handler: PptxHandler,
	snapshot: EditorSnapshot,
	format: PptxSaveFormat = 'pptx',
	saveIntent?: DeckSaveIntent | string | null,
	embedFonts = true,
	slideSize?: PptxSlideSize,
	viewProperties?: PptxViewProperties,
): Promise<Uint8Array> {
	const metadata = {
		...embeddedFontSaveOptions(embedFonts),
		// Omitted when unknown so a deck that never loaded a size is not given one.
		...(slideSize ? { slideSize } : {}),
		...(viewProperties ? { viewProperties } : {}),
		...(snapshot.sections.length > 0 ? { sections: snapshot.sections } : {}),
		...(Object.keys(snapshot.headerFooter).length > 0
			? { headerFooter: snapshot.headerFooter }
			: {}),
		...(Object.keys(snapshot.presentationProperties).length > 0
			? { presentationProperties: snapshot.presentationProperties }
			: {}),
		...(snapshot.customShows.length > 0 ? { customShows: snapshot.customShows } : {}),
		...(snapshot.coreProperties ? { coreProperties: snapshot.coreProperties } : {}),
		...(snapshot.appProperties ? { appProperties: snapshot.appProperties } : {}),
		...(snapshot.customProperties.length > 0
			? { customProperties: snapshot.customProperties }
			: {}),
		// Omitted when empty so a deck with no tag parts is not given one.
		...(snapshot.tagCollections.length > 0 ? { tags: snapshot.tagCollections } : {}),
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
					slideMasters: snapshot.slideMasters,
					notesMaster: snapshot.notesMaster,
					handoutMaster: snapshot.handoutMaster,
					...metadata,
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
