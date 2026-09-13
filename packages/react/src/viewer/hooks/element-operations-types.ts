import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
	ShapeStyle,
	TextStyle,
} from 'pptx-viewer-core';
import type { InlineTextEditSnapshot, MasterViewTarget } from 'pptx-viewer-shared';

import type { ChangeCaseMode } from '../utils/text-case-transform';
import type { EditorHistoryResult } from './useEditorHistory';

/**
 * View > Slide Master routing.
 *
 * The master view paints a part that is not in `slides`, so an edit made
 * there has to be written back into the master / layout / notes / handout
 * model instead. React previously keyed a pseudo-slide on the master's
 * archive path and pushed edits into `templateElementsBySlideId`, where
 * `buildSaveSlides` looks parts up by real slide id and so never found them:
 * the change showed on screen and vanished on save.
 */
export interface MasterViewRouting {
	target: MasterViewTarget | null;
	slideMasters: PptxSlideMaster[];
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
	setNotesMaster: React.Dispatch<React.SetStateAction<PptxNotesMaster | undefined>>;
	setHandoutMaster: React.Dispatch<React.SetStateAction<PptxHandoutMaster | undefined>>;
}

export interface UseElementOperationsInput {
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	selectedElementId: string | null;
	/** When true, element operations target the template store, not slide.elements. */
	editTemplateMode: boolean;
	/** Template (master/layout) elements for the active slide. */
	templateElements: PptxElement[];
	/** Set while View > Slide Master is open; routes writes to the master part. */
	masterView?: MasterViewRouting | undefined;
	history: EditorHistoryResult;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	setTemplateElementsBySlideId: React.Dispatch<React.SetStateAction<Record<string, PptxElement[]>>>;
	setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
	setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
	setInlineEditingElementId: React.Dispatch<React.SetStateAction<string | null>>;
	/**
	 * The element currently being inline-edited and its uncommitted text.
	 * `InlineTextEditor`'s contentEditable is uncontrolled: the DOM owns text
	 * between keystrokes and blur, publishing text and a semantic snapshot for
	 * supported list sessions. `selectedElement.textSegments` on the model can
	 * be stale relative to what's on screen while the user is still typing.
	 * A toolbar style click (Bold, etc.) doesn't blur first (see the toolbar
	 * buttons' `onMouseDown` + `preventDefault`), so it can land while that gap
	 * exists. `updateSelectedTextStyle`/`updateSelectedTextCase` reconcile
	 * against these before touching segments, so a style change always applies
	 * to what the user actually sees, not stale pre-keystroke content.
	 */
	inlineEditingElementId: string | null;
	inlineEditingText: string;
	inlineEditingSnapshotRef?: React.MutableRefObject<InlineTextEditSnapshot | undefined>;
	setContextMenuState: React.Dispatch<
		React.SetStateAction<import('../types').ElementContextMenuState | null>
	>;
}

export interface ElementOperations {
	applySelection: (primaryId: string | null, ids?: string[]) => void;
	clearSelection: () => void;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
	updateSelectedElement: (updates: Partial<PptxElement>) => void;
	updateSelectedShapeStyle: (updates: Partial<ShapeStyle>) => void;
	updateSelectedTextStyle: (updates: Partial<TextStyle>) => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	updateSelectedTextCase: (mode: ChangeCaseMode) => void;
	updateSlides: (updater: (s: PptxSlide[]) => PptxSlide[]) => void;
	/**
	 * The element list currently being edited: the template store for the active
	 * slide while edit-template mode is on, otherwise the active slide's elements.
	 */
	activeElements: PptxElement[];
	/**
	 * Replace the active element list (template store or slide.elements depending
	 * on edit-template mode). Does not mark the document dirty; callers do.
	 */
	updateActiveElements: (updater: (els: PptxElement[]) => PptxElement[]) => void;
	serializeSlides: () => Promise<Uint8Array | null>;
}
