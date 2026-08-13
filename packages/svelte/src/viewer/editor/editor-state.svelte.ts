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
	PptxSlideSize,
	PptxTheme,
	PptxPresentationProperties,
	PptxCustomShow,
	PptxTagCollection,
	TextSegment,
} from 'pptx-viewer-core';
import type {
	DeckSaveIntent,
	ElementClipboardPayload,
	FontEmbeddingDescriptor,
	TemplateElementMap,
} from 'pptx-viewer-shared';
import {
	canInteractWithElement,
	describeFontEmbedding,
	isElementIdInteractive,
} from 'pptx-viewer-shared';

import { EditorAnimationController } from './editor-animation-controller';
import { EditorArrangeController } from './editor-arrange-controller';
import { EditorBackgroundController } from './editor-background-controller';
import { EditorClipboardController } from './editor-clipboard-controller';
import type { LoadDocumentArgs } from './editor-document-lifecycle';
import {
	applyRemoteEditorSlides,
	loadEditorDocument,
	resetEditorSession,
	restoreEditorSnapshot,
	saveEditorState,
	updateEditorDocumentProperties,
	updateEditorTagCollections,
} from './editor-document-lifecycle';
import { createEditorSnapshot } from './editor-document-state';
import type { EditorSnapshot } from './editor-document-state';
import { EditorElementController } from './editor-element-controller';
import { EditorEquationController } from './editor-equation-controller.svelte';
import { EditorFormatPainterController } from './editor-format-painter-controller.svelte';
import { EditorHistoryState } from './editor-history-state.svelte';
import { EditorInkController } from './editor-ink-controller.svelte';
import { EditorMasterController } from './editor-master-controller';
import type { MasterViewTarget } from './editor-master-controller';
import type { ElementBoxPatch } from './editor-mutations';
import { EditorPresentationMetadata } from './editor-presentation-metadata.svelte';
import { EditorSectionController } from './editor-section-controller';
import { EditorSelection, resolveSelectedElements } from './editor-selection.svelte';
import { EditorSlidesController } from './editor-slides-controller';
import { EditorTemplateController } from './editor-template-controller';
import { EditorTransitionController } from './editor-transition-controller';
import type { ZOrderDirection } from './editor-zorder';
import { TableCellSelection } from './table-cell-selection.svelte';

export interface EditorStateDeps {
	getCurrent(): number;
	getHandler(): PptxHandler | null;
	/**
	 * The `p:sldSz` a save should write, resolved from the viewer's EMU slide
	 * size and its pixel canvas by the shared `resolveSlideSizeSelection`.
	 * Optional so out-of-tree mounts (and the unit tests) can omit it, in which
	 * case core re-emits the load-time dimensions verbatim.
	 */
	getSlideSize?: () => PptxSlideSize | undefined;
	onChange?: () => void;
}

export class EditorState {
	slides = $state.raw<PptxSlide[]>([]);
	templateElementsBySlideId = $state.raw<TemplateElementMap>({});
	slideMasters = $state.raw<PptxSlideMaster[]>([]);
	notesMaster = $state.raw<PptxNotesMaster | undefined>(undefined);
	handoutMaster = $state.raw<PptxHandoutMaster | undefined>(undefined);
	sections = $state.raw<PptxSection[]>([]);
	readonly presentationMetadata = new EditorPresentationMetadata(this);
	coreProperties = $state.raw<PptxCoreProperties | undefined>(undefined);
	appProperties = $state.raw<PptxAppProperties | undefined>(undefined);
	customProperties = $state.raw<PptxCustomProperty[]>([]);
	/**
	 * The deck's `ppt/tags/*.xml` name/value metadata. Seeded from the load via
	 * {@link adoptTagCollections} and edited by the inspector's Tags section;
	 * carried through the undo snapshot and re-emitted on save.
	 */
	tagCollections = $state.raw<PptxTagCollection[]>([]);
	/**
	 * The deck's active theme, kept here so the Home tab's font dropdown can
	 * lead with the theme fonts. Set by the viewer once a deck is loaded;
	 * deliberately outside {@link EditorSnapshot} because it is not content the
	 * undo stack owns.
	 */
	theme = $state.raw<PptxTheme | undefined>(undefined);
	/**
	 * Families the deck embeds, offered as their own font-dropdown group. Write
	 * through {@link adoptEmbeddedFontFamilies} so {@link embedFonts} is reseeded
	 * with them.
	 */
	embeddedFontFamilies = $state.raw<readonly string[]>([]);
	/**
	 * File > Fonts > "Embed fonts in the file". Session state like
	 * {@link savePassword}, not document content, so undo never restores it.
	 * Seeded from the loaded deck (see {@link adoptEmbeddedFontFamilies}): a deck
	 * that arrived with embedded fonts keeps them on save, so the switch has to
	 * start "on" or turning it off would be the only way to describe what save
	 * already does. Read by `saveEditorDocument`.
	 */
	embedFonts = $state(true);
	/**
	 * Families the user registered from a local font file this session
	 * (File > Options > Fonts, off by default). Session state, never persisted:
	 * the font binary is the user's, not ours to store.
	 */
	customFontFamilies = $state.raw<readonly string[]>([]);
	masterViewTarget = $state.raw<MasterViewTarget | null>(null);
	readonly selection = new EditorSelection();
	/** The block of table cells marquee'd inside the selected table, if any. */
	readonly tableCells = new TableCellSelection();
	editable = $state(false);
	dirty = $state(false);
	editTemplateMode = $state(false);
	interactionActive = $state(false);
	clipboard = $state.raw<ElementClipboardPayload | null>(null);
	/**
	 * File ▸ Info ▸ Protect Presentation state. Deliberately NOT part of
	 * {@link EditorSnapshot}: the secret is session state, not document content,
	 * so undo must never restore or clear it. {@link saveIntent} feeds it to the
	 * shared `planDeckSave`, which routes a protected save through
	 * `saveEncrypted` (an OLE2 container) instead of `save` (a plain ZIP).
	 */
	passwordProtected = $state(false);
	savePassword = $state<string | null>(null);

	/** Undo/redo stack; the `canUndo` / `canRedo` getters below mirror it. */
	readonly history = new EditorHistoryState();
	readonly #deps: EditorStateDeps;

	// Each sub-controller only stores this reference, so a field initializer is
	// safe here even though `#deps` is not assigned until the constructor body.
	readonly clipboardOps = new EditorClipboardController(this);
	readonly elementOps = new EditorElementController(this);
	readonly templateOps = new EditorTemplateController(this);
	readonly slidesOps = new EditorSlidesController(this);
	readonly sectionOps = new EditorSectionController(this);
	readonly arrangeOps = new EditorArrangeController(this);
	readonly backgroundOps = new EditorBackgroundController(this);
	readonly transitionOps = new EditorTransitionController(this);
	readonly animationOps = new EditorAnimationController(this);
	readonly inkOps = new EditorInkController(this);
	readonly masterOps = new EditorMasterController(this);
	readonly formatPainter = new EditorFormatPainterController(this);
	readonly equationOps = new EditorEquationController(this);

	constructor(deps: EditorStateDeps) {
		this.#deps = deps;
	}

	get canUndo(): boolean {
		return this.history.canUndo;
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
		return this.history.canRedo;
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
		return resolveSelectedElements(this.selection.ids, this.activeElements);
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

	/**
	 * The `p:sldSz` the next save should write, or undefined to leave the
	 * load-time dimensions alone. Slide size lives on the loader (it is not
	 * content the undo stack owns), so it reaches the save through this dep the
	 * same way the handler does.
	 */
	getSlideSize(): PptxSlideSize | undefined {
		return this.#deps.getSlideSize?.();
	}

	/** Adopt a freshly loaded deck as the working document (see `loadEditorDocument`). */
	setSlides(...args: LoadDocumentArgs): void {
		loadEditorDocument(this, ...args);
	}

	/** Adopt a remote (collaboration) snapshot; see `applyRemoteEditorSlides`. */
	applyRemoteSlides(slides: PptxSlide[]): void {
		applyRemoteEditorSlides(this, slides);
	}

	reset(): void {
		resetEditorSession(this);
	}

	select(id: string | null): void {
		const next = id && this.isElementInteractive(id) ? id : null;
		this.selection.set(next);
		// A different element (or nothing) is selected now, so any table cell
		// range built on the previous one is stale. Fed the id we just set
		// rather than re-reading `selection.primary`: the host's editable
		// effect calls this AND writes the selection, so reading it back here
		// closed a read-write cycle that tripped `effect_update_depth_exceeded`
		// and took the whole viewer down.
		this.tableCells.syncElement(next);
	}

	/** The element with `id` on the surface the pointer acts on, or undefined. */
	elementById(id: string): PptxElement | undefined {
		return this.activeElements.find((element) => element.id === id);
	}

	/**
	 * May the pointer act on `id` at all? Two gates, both of which must pass:
	 * the template rule (an inherited master/layout node is inert unless
	 * edit-template mode is on) and the element's own authored `a:spLocks`. The
	 * lock half was missing entirely, which is why a `noSelect` shape from a
	 * real deck was as selectable and draggable as any other.
	 */
	isElementInteractive(id: string): boolean {
		if (!isElementIdInteractive(id, this.editTemplateMode)) {
			return false;
		}
		return canInteractWithElement(this.elementById(id), 'select');
	}

	setTemplateEditing(enabled: boolean): void {
		if (this.editTemplateMode === enabled) {
			return;
		}
		this.editTemplateMode = enabled;
		this.selection.clear();
		this.tableCells.clear();
	}

	/** Apply the File > Options "maximum number of undos" value. */
	setHistoryDepth(depth: number): void {
		this.history.setDepth(depth);
	}

	pushHistory(): void {
		this.history.record(this.snapshot());
		this.elementOps.resetNudge();
	}

	commitChange(): void {
		this.dirty = true;
		this.history.sync();
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

	/** A deep clone of the whole editable document (one undo entry, or save input). */
	snapshot(): EditorSnapshot {
		return createEditorSnapshot(this);
	}

	/**
	 * Adopt the families a freshly loaded deck embeds, and reseed
	 * {@link embedFonts} to the position that describes the file save would write
	 * right now. Deliberately not an undo step: the parsed font list is not a
	 * user edit.
	 */
	adoptEmbeddedFontFamilies(families: readonly string[]): void {
		this.embeddedFontFamilies = families;
		this.embedFonts = describeFontEmbedding(families).initialEnabled;
	}

	/** How File > Fonts should render its toggle for the loaded deck. */
	get fontEmbedding(): FontEmbeddingDescriptor {
		return describeFontEmbedding(this.embeddedFontFamilies);
	}

	/** The Protect-Presentation state every save path hands to `planDeckSave`. */
	saveIntent(): DeckSaveIntent {
		return { password: this.savePassword, passwordProtected: this.passwordProtected };
	}

	/** File ▸ Info ▸ Protect Presentation: arm password encryption for saves. */
	setSavePassword(password: string): void {
		this.savePassword = password;
		this.passwordProtected = true;
	}

	/** File ▸ Info ▸ Protect Presentation: back to saving in the clear. */
	clearSavePassword(): void {
		this.savePassword = null;
		this.passwordProtected = false;
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
		updateEditorDocumentProperties(this, core, app, custom);
	}

	/**
	 * Seed the deck's tag parts straight after a load. Deliberately NOT an undo
	 * step: the load already cleared history, and treating the parsed value as
	 * a user edit would mark a pristine deck dirty.
	 */
	adoptTagCollections(tags: readonly PptxTagCollection[]): void {
		this.tagCollections = structuredClone(tags as PptxTagCollection[]);
	}

	/** Replace the tag collections as one undoable edit (inspector Tags section). */
	updateTagCollections(next: readonly PptxTagCollection[]): void {
		updateEditorTagCollections(this, next);
	}

	undo(): void {
		restoreEditorSnapshot(this, this.history.undo(this.snapshot()));
	}

	redo(): void {
		restoreEditorSnapshot(this, this.history.redo(this.snapshot()));
	}

	save(format: PptxSaveFormat = 'pptx'): Promise<Uint8Array> {
		return saveEditorState(this, format);
	}
}
