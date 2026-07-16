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
	PptxPresentationProperties,
	PptxCustomShow,
} from 'pptx-viewer-core';
import type { TemplateElementMap } from 'pptx-viewer-shared';
import { cloneTemplateElementsBySlideId } from 'pptx-viewer-shared';

import { cloneSlides } from './editor-mutations';

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
	};
}

export async function saveEditorDocument(
	handler: PptxHandler,
	snapshot: EditorSnapshot,
	format: PptxSaveFormat = 'pptx',
): Promise<Uint8Array> {
	const metadata = {
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
	};
	const hasMasters =
		snapshot.slideMasters.length > 0 ||
		snapshot.notesMaster !== undefined ||
		snapshot.handoutMaster !== undefined;
	return hasMasters
		? handler.save(snapshot.slides, {
				slideMasters: snapshot.slideMasters,
				notesMaster: snapshot.notesMaster,
				handoutMaster: snapshot.handoutMaster,
				...metadata,
				outputFormat: format,
			})
		: handler.save(snapshot.slides, {
				...metadata,
				outputFormat: format,
			});
}
