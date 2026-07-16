import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandoutMaster,
	PptxHandler,
	PptxNotesMaster,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
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
	const hasMasters =
		snapshot.slideMasters.length > 0 ||
		snapshot.notesMaster !== undefined ||
		snapshot.handoutMaster !== undefined;
	return hasMasters
		? handler.save(snapshot.slides, {
				slideMasters: snapshot.slideMasters,
				notesMaster: snapshot.notesMaster,
				handoutMaster: snapshot.handoutMaster,
				sections: snapshot.sections.length > 0 ? snapshot.sections : undefined,
				coreProperties: snapshot.coreProperties,
				appProperties: snapshot.appProperties,
				customProperties:
					snapshot.customProperties.length > 0 ? snapshot.customProperties : undefined,
				outputFormat: format,
			})
		: handler.save(snapshot.slides, {
				sections: snapshot.sections.length > 0 ? snapshot.sections : undefined,
				coreProperties: snapshot.coreProperties,
				appProperties: snapshot.appProperties,
				customProperties:
					snapshot.customProperties.length > 0 ? snapshot.customProperties : undefined,
				outputFormat: format,
			});
}
