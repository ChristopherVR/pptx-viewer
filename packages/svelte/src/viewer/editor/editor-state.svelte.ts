import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxElement,
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
	TextSegment,
} from 'pptx-viewer-core';
import type { ElementClipboardPayload, TemplateElementMap } from 'pptx-viewer-shared';
import {
	EditorHistory,
	isElementIdInteractive,
	partitionTemplateElements,
} from 'pptx-viewer-shared';

import { EditorAnimationController } from './editor-animation-controller';
import { EditorArrangeController } from './editor-arrange-controller';
import { EditorBackgroundController } from './editor-background-controller';
import { EditorClipboardController } from './editor-clipboard-controller';
import { createEditorSnapshot, saveEditorDocument } from './editor-document-state';
import type { EditorSnapshot } from './editor-document-state';
import { EditorElementController } from './editor-element-controller';
import { EditorEquationController } from './editor-equation-controller.svelte';
import { EditorFormatPainterController } from './editor-format-painter-controller.svelte';
import { EditorInkController } from './editor-ink-controller.svelte';
import { EditorMasterController } from './editor-master-controller';
import type { MasterViewTarget } from './editor-master-controller';
import type { ElementBoxPatch } from './editor-mutations';
import { EditorPresentationMetadata } from './editor-presentation-metadata.svelte';
import { EditorSectionController } from './editor-section-controller';
import { EditorSelection } from './editor-selection.svelte';
import { EditorSlidesController } from './editor-slides-controller';
import { EditorTemplateController } from './editor-template-controller';
import { EditorTransitionController } from './editor-transition-controller';
import type { ZOrderDirection } from './editor-zorder';

const MAX_HISTORY_ENTRIES = 100;

export interface EditorStateDeps {
	getCurrent(): number;
	getHandler(): PptxHandler | null;
	onChange?: () => void;
}

export class EditorState {
	slides = $state.raw<PptxSlide[]>([]);
	templateElementsBySlideId = $state.raw<TemplateElementMap>({});
	slideMasters = $state.raw<PptxSlideMaster[]>([]);
	notesMaster = $state.raw<PptxNotesMaster | undefined>(undefined);
	handoutMaster = $state.raw<PptxHandoutMaster | undefined>(undefined);
	sections = $state.raw<PptxSection[]>([]);
	readonly presentationMetadata: EditorPresentationMetadata;
	coreProperties = $state.raw<PptxCoreProperties | undefined>(undefined);
	appProperties = $state.raw<PptxAppProperties | undefined>(undefined);
	customProperties = $state.raw<PptxCustomProperty[]>([]);
	masterViewTarget = $state.raw<MasterViewTarget | null>(null);
	readonly selection = new EditorSelection();
	editable = $state(false);
	dirty = $state(false);
	editTemplateMode = $state(false);
	interactionActive = $state(false);
	clipboard = $state.raw<ElementClipboardPayload | null>(null);

	#history = new EditorHistory<EditorSnapshot>({ maxDepth: MAX_HISTORY_ENTRIES });
	#canUndo = $state(false);
	#canRedo = $state(false);
	readonly #deps: EditorStateDeps;

	readonly clipboardOps: EditorClipboardController;
	readonly elementOps: EditorElementController;
	readonly templateOps: EditorTemplateController;
	readonly slidesOps: EditorSlidesController;
	readonly sectionOps: EditorSectionController;
	readonly arrangeOps: EditorArrangeController;
	readonly backgroundOps: EditorBackgroundController;
	readonly transitionOps: EditorTransitionController;
	readonly animationOps: EditorAnimationController;
	readonly inkOps: EditorInkController;
	readonly masterOps: EditorMasterController;
	readonly formatPainter: EditorFormatPainterController;
	readonly equationOps: EditorEquationController;

	constructor(deps: EditorStateDeps) {
		this.#deps = deps;
		this.presentationMetadata = new EditorPresentationMetadata(this);
		this.clipboardOps = new EditorClipboardController(this);
		this.elementOps = new EditorElementController(this);
		this.templateOps = new EditorTemplateController(this);
		this.slidesOps = new EditorSlidesController(this);
		this.sectionOps = new EditorSectionController(this);
		this.arrangeOps = new EditorArrangeController(this);
		this.backgroundOps = new EditorBackgroundController(this);
		this.transitionOps = new EditorTransitionController(this);
		this.animationOps = new EditorAnimationController(this);
		this.inkOps = new EditorInkController(this);
		this.masterOps = new EditorMasterController(this);
		this.formatPainter = new EditorFormatPainterController(this);
		this.equationOps = new EditorEquationController(this);
	}

	get canUndo(): boolean {
		return this.#canUndo;
	}

	get headerFooter(): PptxHeaderFooter {
		return this.presentationMetadata.headerFooter;
	}

	get presentationProperties(): PptxPresentationProperties {
		return this.presentationMetadata.presentationProperties;
	}

	get customShows(): PptxCustomShow[] {
		return this.presentationMetadata.customShows;
	}

	get canRedo(): boolean {
		return this.#canRedo;
	}

	get selectedElementId(): string | null {
		return this.selection.primary;
	}

	get selectedElement(): PptxElement | undefined {
		return this.selectedElementId
			? this.activeElements.find((element) => element.id === this.selectedElementId)
			: undefined;
	}

	get selectedElements(): PptxElement[] {
		const ids = this.selection.ids;
		if (ids.length === 0) {
			return [];
		}
		const elements = this.activeElements;
		if (ids.length === 1) {
			const element = elements.find((candidate) => candidate.id === ids[0]);
			return element ? [element] : [];
		}
		const elementsById = new Map(elements.map((element) => [element.id, element]));
		return ids
			.map((id) => elementsById.get(id))
			.filter((el): el is PptxElement => el !== undefined);
	}

	get activeElements(): PptxElement[] {
		return this.templateOps.activeElements();
	}

	get renderedSlides(): PptxSlide[] {
		return this.templateOps.renderedSlides();
	}

	get hasClipboard(): boolean {
		return this.clipboard !== null;
	}

	get currentSlideIndex(): number {
		return this.#deps.getCurrent();
	}

	/** The loaded core handler, or null before a deck is open. Used by the
	 *  Slides group for layout switching (`applyLayoutToSlide`). */
	getHandler(): PptxHandler | null {
		return this.#deps.getHandler();
	}

	#syncHistoryFlags(): void {
		this.#canUndo = this.#history.canUndo;
		this.#canRedo = this.#history.canRedo;
	}

	setSlides(
		slides: PptxSlide[],
		slideMasters: PptxSlideMaster[] = [],
		notesMaster?: PptxNotesMaster,
		handoutMaster?: PptxHandoutMaster,
		sections: PptxSection[] = [],
		coreProperties?: PptxCoreProperties,
		appProperties?: PptxAppProperties,
		customProperties: PptxCustomProperty[] = [],
		headerFooter: PptxHeaderFooter = {},
		presentationProperties: PptxPresentationProperties = {},
		customShows: PptxCustomShow[] = [],
	): void {
		const partition = partitionTemplateElements(slides);
		this.slides = partition.slides;
		this.templateElementsBySlideId = partition.templateElementsBySlideId;
		this.slideMasters = structuredClone(slideMasters);
		this.notesMaster = structuredClone(notesMaster);
		this.handoutMaster = structuredClone(handoutMaster);
		this.sections = structuredClone(sections);
		this.coreProperties = structuredClone(coreProperties);
		this.appProperties = structuredClone(appProperties);
		this.customProperties = structuredClone(customProperties);
		this.presentationMetadata.set(headerFooter, presentationProperties, customShows);
		this.masterViewTarget = null;
		this.selection.clear();
		this.editTemplateMode = false;
		this.dirty = false;
		this.interactionActive = false;
		this.#history.clear();
		this.elementOps.resetNudge();
		this.inkOps.setTool('select');
		this.#syncHistoryFlags();
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
	applyRemoteSlides(slides: PptxSlide[]): void {
		const partition = partitionTemplateElements(slides);
		this.slides = partition.slides;
		this.templateElementsBySlideId = partition.templateElementsBySlideId;
		this.selection.prune((id) => this.activeElements.some((element) => element.id === id));
	}

	reset(): void {
		this.selection.clear();
		this.editTemplateMode = false;
		this.masterViewTarget = null;
		this.dirty = false;
		this.interactionActive = false;
		this.#history.clear();
		this.elementOps.resetNudge();
		this.inkOps.setTool('select');
		this.#syncHistoryFlags();
	}

	select(id: string | null): void {
		this.selection.set(id && this.isElementInteractive(id) ? id : null);
	}

	isElementInteractive(id: string): boolean {
		return isElementIdInteractive(id, this.editTemplateMode);
	}

	setTemplateEditing(enabled: boolean): void {
		if (this.editTemplateMode === enabled) {
			return;
		}
		this.editTemplateMode = enabled;
		this.selection.clear();
	}

	pushHistory(): void {
		this.#history.record(this.#snapshot(), '');
		this.elementOps.resetNudge();
		this.#syncHistoryFlags();
	}

	commitChange(): void {
		this.dirty = true;
		this.#syncHistoryFlags();
		this.#deps.onChange?.();
	}

	/** Patch geometry without history for live gesture preview frames. */
	patchGeometry = (id: string, box: ElementBoxPatch): void =>
		this.elementOps.patchGeometry(id, box);

	replaceActiveElements(elements: PptxElement[]): void {
		this.templateOps.replace(elements);
	}

	/** Commit a replacement active element collection as one undo step. */
	commitActiveElements(elements: PptxElement[]): void {
		this.templateOps.commit(elements);
	}

	/**
	 * Replace the whole slide array with history (the generic multi-slide
	 * mutation entry point: slide add/duplicate/delete, arrange group ops,
	 * and find/replace all route through this so every change is a single
	 * undoable step). No-op when not editable.
	 */
	commitSlides(next: PptxSlide[]): void {
		if (!this.editable) {
			return;
		}
		this.pushHistory();
		this.slides = next;
		this.commitChange();
	}

	#snapshot(): EditorSnapshot {
		return createEditorSnapshot(this);
	}

	#restore(snapshot: EditorSnapshot | undefined): void {
		if (!snapshot) {
			return;
		}
		const restored = createEditorSnapshot(snapshot);
		this.slides = restored.slides;
		this.templateElementsBySlideId = restored.templateElementsBySlideId;
		this.slideMasters = restored.slideMasters;
		this.notesMaster = restored.notesMaster;
		this.handoutMaster = restored.handoutMaster;
		this.sections = restored.sections;
		this.coreProperties = restored.coreProperties;
		this.appProperties = restored.appProperties;
		this.customProperties = restored.customProperties;
		this.presentationMetadata.set(
			restored.headerFooter,
			restored.presentationProperties,
			restored.customShows,
		);
		this.interactionActive = false;
		this.selection.prune((id) => this.activeElements.some((element) => element.id === id));
		this.commitChange();
	}

	deleteSelected = (): void => this.elementOps.deleteSelected();
	duplicateSelected = (): string | null => this.elementOps.duplicateSelected();
	applyElementPatch = (id: string, patch: Partial<PptxElement>): void =>
		this.elementOps.applyElementPatch(id, patch);
	patchSelected = (patch: Partial<PptxElement>): void => this.elementOps.patchSelected(patch);
	insertElement = (element: PptxElement): string | null => this.elementOps.insertElement(element);
	reorderSelected = (direction: ZOrderDirection): void =>
		this.elementOps.reorderSelected(direction);
	nudgeSelected = (dx: number, dy: number): void => this.elementOps.nudgeSelected(dx, dy);
	commitInlineText = (id: string, text: string): void => this.elementOps.commitInlineText(id, text);
	commitNotes = (notes: string, notesSegments?: TextSegment[]): void =>
		this.elementOps.commitNotes(notes, notesSegments);

	updateDocumentProperties(
		core: PptxCoreProperties,
		app: PptxAppProperties,
		custom: PptxCustomProperty[],
	): void {
		if (!this.editable) {
			return;
		}
		this.pushHistory();
		this.coreProperties = { ...core };
		this.appProperties = { ...app };
		this.customProperties = custom.map((property) => ({ ...property }));
		this.commitChange();
	}

	undo(): void {
		this.#restore(this.#history.undo(this.#snapshot())?.snapshot);
	}

	redo(): void {
		this.#restore(this.#history.redo(this.#snapshot())?.snapshot);
	}

	async save(format: PptxSaveFormat = 'pptx'): Promise<Uint8Array> {
		const handler = this.#deps.getHandler();
		if (!handler) {
			throw new Error('No presentation is loaded.');
		}
		const bytes = await saveEditorDocument(
			handler,
			{
				...this.#snapshot(),
				slides: this.renderedSlides,
			},
			format,
		);
		this.dirty = false;
		return bytes;
	}
}
