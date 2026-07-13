import type {
	PptxElement,
	PptxHandler,
	PptxSlide,
	PptxSlideMaster,
	TextSegment,
} from 'pptx-viewer-core';
import type { ElementClipboardPayload, TemplateElementMap } from 'pptx-viewer-shared';
import {
	cloneTemplateElementsBySlideId,
	EditorHistory,
	isElementIdInteractive,
	partitionTemplateElements,
} from 'pptx-viewer-shared';

import { EditorAnimationController } from './editor-animation-controller';
import { EditorArrangeController } from './editor-arrange-controller';
import { EditorBackgroundController } from './editor-background-controller';
import { EditorClipboardController } from './editor-clipboard-controller';
import { EditorElementController } from './editor-element-controller';
import { EditorFormatPainterController } from './editor-format-painter-controller.svelte';
import { EditorInkController } from './editor-ink-controller.svelte';
import { EditorMasterController } from './editor-master-controller';
import type { MasterViewTarget } from './editor-master-controller';
import type { ElementBoxPatch } from './editor-mutations';
import { cloneSlides } from './editor-mutations';
import { EditorSelection } from './editor-selection.svelte';
import { EditorSlidesController } from './editor-slides-controller';
import { EditorTemplateController } from './editor-template-controller';
import { EditorTransitionController } from './editor-transition-controller';
import type { ZOrderDirection } from './editor-zorder';

/** Reactive history, selection, and active-layer state for the Svelte editor. */

const MAX_HISTORY_ENTRIES = 100;

interface EditorSnapshot {
	slides: PptxSlide[];
	templateElementsBySlideId: TemplateElementMap;
	slideMasters: PptxSlideMaster[];
}

export interface EditorStateDeps {
	getCurrent(): number;
	getHandler(): PptxHandler | null;
	onChange?: () => void;
}

export class EditorState {
	slides = $state.raw<PptxSlide[]>([]);
	templateElementsBySlideId = $state.raw<TemplateElementMap>({});
	slideMasters = $state.raw<PptxSlideMaster[]>([]);
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
	readonly arrangeOps: EditorArrangeController;
	readonly backgroundOps: EditorBackgroundController;
	readonly transitionOps: EditorTransitionController;
	readonly animationOps: EditorAnimationController;
	readonly inkOps: EditorInkController;
	readonly masterOps: EditorMasterController;
	readonly formatPainter: EditorFormatPainterController;

	constructor(deps: EditorStateDeps) {
		this.#deps = deps;
		this.clipboardOps = new EditorClipboardController(this);
		this.elementOps = new EditorElementController(this);
		this.templateOps = new EditorTemplateController(this);
		this.slidesOps = new EditorSlidesController(this);
		this.arrangeOps = new EditorArrangeController(this);
		this.backgroundOps = new EditorBackgroundController(this);
		this.transitionOps = new EditorTransitionController(this);
		this.animationOps = new EditorAnimationController(this);
		this.inkOps = new EditorInkController(this);
		this.masterOps = new EditorMasterController(this);
		this.formatPainter = new EditorFormatPainterController(this);
	}

	get canUndo(): boolean {
		return this.#canUndo;
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
		return this.selection.ids
			.map((id) => this.activeElements.find((element) => element.id === id))
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

	#syncHistoryFlags(): void {
		this.#canUndo = this.#history.canUndo;
		this.#canRedo = this.#history.canRedo;
	}

	setSlides(slides: PptxSlide[], slideMasters: PptxSlideMaster[] = []): void {
		const partition = partitionTemplateElements(slides);
		this.slides = partition.slides;
		this.templateElementsBySlideId = partition.templateElementsBySlideId;
		this.slideMasters = structuredClone(slideMasters);
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

	/** Mark dirty + notify host after a committed mutation. */
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
		return {
			slides: cloneSlides(this.slides),
			templateElementsBySlideId: cloneTemplateElementsBySlideId(this.templateElementsBySlideId),
			slideMasters: this.masterOps.cloneMasters(),
		};
	}

	#restore(snapshot: EditorSnapshot | undefined): void {
		if (!snapshot) {
			return;
		}
		this.slides = cloneSlides(snapshot.slides);
		this.templateElementsBySlideId = cloneTemplateElementsBySlideId(
			snapshot.templateElementsBySlideId,
		);
		this.slideMasters = structuredClone(snapshot.slideMasters);
		this.interactionActive = false;
		// Drop selected ids the undo/redo step removed (or that were never on
		// this snapshot), so ribbon controls gated on `selectedElementId` don't
		// stay enabled for an element that no longer exists.
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

	undo(): void {
		this.#restore(this.#history.undo(this.#snapshot())?.snapshot);
	}

	redo(): void {
		this.#restore(this.#history.redo(this.#snapshot())?.snapshot);
	}

	async save(): Promise<Uint8Array> {
		const handler = this.#deps.getHandler();
		if (!handler) {
			throw new Error('No presentation is loaded.');
		}
		const bytes =
			this.slideMasters.length > 0
				? await handler.save(this.renderedSlides, { slideMasters: this.slideMasters })
				: await handler.save(this.renderedSlides);
		this.dirty = false;
		return bytes;
	}
}
