import type {
	PptxHandoutMaster,
	PptxHandler,
	PptxNotesMaster,
	PptxSaveFormat,
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
}

export function createEditorSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
	return {
		slides: cloneSlides(snapshot.slides),
		templateElementsBySlideId: cloneTemplateElementsBySlideId(snapshot.templateElementsBySlideId),
		slideMasters: structuredClone(snapshot.slideMasters),
		notesMaster: structuredClone(snapshot.notesMaster),
		handoutMaster: structuredClone(snapshot.handoutMaster),
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
				outputFormat: format,
			})
		: handler.save(snapshot.slides, { outputFormat: format });
}
