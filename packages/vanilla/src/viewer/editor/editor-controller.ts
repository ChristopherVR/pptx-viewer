import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxElement,
	PptxHandler,
	PptxHeaderFooter,
	PptxLayoutPreview,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	TextSegment,
} from 'pptx-viewer-core';
import { armEditorKeyboard, downloadBlob } from 'pptx-viewer-shared';

import { buildSharingPackage } from '../export/package-sharing';
import type { Translator } from '../i18n';
import type { DrawTool, Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { syncAlignmentGuides } from './alignment-guide-view';
import { createEditingChromeSync } from './editing-chrome-sync';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import { selectionOverlayBox } from './editor-controller-overlay';
import { createDrawModeController } from './editor-draw-mode';
import type { EditActions } from './editor-edit-ops';
import { createEditActions } from './editor-edit-ops';
import type { FindReplaceActions } from './editor-find-replace-actions';
import { createFindReplaceActions } from './editor-find-replace-actions';
import { createEditorKeydownHandler } from './editor-keyboard';
import { selectionInteractivity } from './editor-lock-gates';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import { createMotionPathController } from './motion-path-controller';
import type { SelectionOverlay } from './selection-overlay';
import { createSelectionOverlay } from './selection-overlay';
import { selectedAdjustmentDescriptor } from './shape-adjust-gesture';

export interface EditorControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	getChrome(): ViewerChrome;
	getTranslator(): Translator;
	getScale(): number;
	getHandler(): PptxHandler | null;
	/** Host `onChange` callback: fired after every committed mutation. */
	onChange?: () => void;
	/** Notified with slide-space coordinates on stage pointer move (collaboration cursor broadcast). */
	onCursorMove?: (x: number, y: number) => void;
	/** Mirror in-progress inline-editor text to collaborators (live preview). */
	onInlineTextInput?: (elementId: string, text: string) => void;
	/** Push any queued live-preview frame out before an inline commit lands. */
	flushInlineTextInput?: () => void;
}

export interface EditorController {
	/** (Re)wire listeners + overlay into the current chrome (after mount). */
	attachChrome(): void;
	detachChrome(): void;
	/** Called by the render controller after every stage render. */
	onStageRendered(): void;
	/** True while editing owns the keyboard (selection or inline editing). */
	capturesKeyboard(): boolean;
	/** Drop history/selection/dirty state (new content loaded). */
	reset(): void;
	setEditable(editable: boolean): void;
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	/** File > Options > Advanced > "Maximum number of undos". */
	setHistoryDepth(depth: number): void;
	deleteSelected(): void;
	duplicateSelected(): string | null;
	getSelectedElementId(): string | null;
	selectElements(ids: string[]): void;
	applyElementPatch(id: string, patch: Partial<PptxElement>): void;
	commitSlides(slides: PptxSlide[], currentSlide?: number): void;
	/** Switch the Draw ribbon tab's active tool (also clears selection when leaving `'select'`). */
	setDrawTool(tool: DrawTool): void;
	/** Set the pen/highlighter stroke colour used by the next committed stroke. */
	setDrawColor(color: string): void;
	/** Set the pen/highlighter stroke width used by the next committed stroke. */
	setDrawWidth(width: number): void;
	/** The formatting / insert / arrange actions for the editing chrome. */
	getEditActions(): EditActions;
	/** The Find & Replace actions for the ribbon's docked panel. */
	getFindReplaceActions(): FindReplaceActions;
	commitNotes(notes: string, notesSegments?: TextSegment[]): void;
	setHandoutSlidesPerPage(count: number): void;
	updateDocumentProperties(
		core: PptxCoreProperties,
		app: PptxAppProperties,
		custom: PptxCustomProperty[],
	): void;
	updatePresentationProperties(value: PptxPresentationProperties): void;
	/** Replace the whole section list as one undoable step (AI deck seam). */
	updateSections(value: PptxSection[]): void;
	updateHeaderFooter(value: PptxHeaderFooter): void;
	updateCustomShows(value: PptxCustomShow[]): void;
	save(format?: PptxSaveFormat): Promise<Uint8Array>;
	downloadAs(format: PptxSaveFormat, fileName?: string): Promise<void>;
	packageForSharing(fileName?: string): Promise<void>;
	downloadPptx(fileName?: string): Promise<void>;
	destroy(): void;
}

const PRESENTATION_MIME: Record<PptxSaveFormat, string> = {
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
	pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
};

export function createEditorController(deps: EditorControllerDeps): EditorController {
	const { doc, store } = deps;
	let overlay: SelectionOverlay | null = null;
	let attachedWrap: HTMLElement | null = null;
	let attachedRoot: HTMLElement | null = null;

	const updateToolbar = (): void => {
		const state = {
			editable: store.get().editable,
			canUndo: ops.canUndo(),
			canRedo: ops.canRedo(),
		};
		deps.getChrome().ribbon?.setEditState(state);
		deps.getChrome().titleBar?.setEditState(state);
		deps.getChrome().mobileToolbar?.setEditState(state);
	};

	const ops = createEditorOps({
		store,
		getHandler: deps.getHandler,
		onChange: deps.onChange,
		onHistoryChange: () => updateToolbar(),
	});

	const editActions = createEditActions({ doc, store, ops, getHandler: deps.getHandler });
	const findReplaceActions = createFindReplaceActions({ store, ops });

	/**
	 * Layout artwork for the New Slide / Layout gallery thumbnails.
	 *
	 * Fetched once a deck is present rather than during load, because parsing
	 * every layout part (and decoding the pictures it references) is only worth
	 * doing for a user who opens one of those menus. Core memoises the parse, so
	 * the second sync after it resolves is free.
	 */
	let layoutPreviews: ReadonlyMap<string, PptxLayoutPreview> = new Map();
	let layoutPreviewsPending = false;
	function ensureLayoutPreviews(): ReadonlyMap<string, PptxLayoutPreview> {
		const handler = deps.getHandler();
		if (handler && !layoutPreviewsPending && layoutPreviews.size === 0) {
			layoutPreviewsPending = true;
			void handler
				.getLayoutPreviews()
				.then((previews) => {
					layoutPreviews = new Map(previews.map((preview) => [preview.path, preview]));
					syncEditingChrome();
					return undefined;
				})
				// A layout that will not parse costs the user a name-only tile,
				// not a broken menu.
				.catch(() => undefined)
				.finally(() => {
					layoutPreviewsPending = false;
				});
		}
		return layoutPreviews;
	}

	const syncEditingChrome = createEditingChromeSync({
		store,
		getChrome: deps.getChrome,
		selectedElement: (state) => ops.selectedElement(state),
		layoutPreviews: ensureLayoutPreviews,
	});

	const interactions = createStageInteractions({
		doc,
		store,
		ops,
		getScale: deps.getScale,
		getOverlay: () => overlay,
		getStageRoot: () => attachedWrap?.querySelector('.pptxv-stage') ?? null,
		onCursorMove: deps.onCursorMove,
		onInlineTextInput: deps.onInlineTextInput,
		flushInlineTextInput: deps.flushInlineTextInput,
		onEditEquation: (id, omml) => deps.getChrome().ribbon?.openEquationEditor(id, omml),
		onEyedropper: (color) => editActions.setShapeFill(color),
	});

	// Draw mode owns stage gestures while a pen, highlighter, or eraser is active.
	const drawMode = createDrawModeController({
		store,
		editActions,
		interactions,
		getScale: deps.getScale,
		getStageOrigin() {
			const rect = overlay?.root.getBoundingClientRect();
			return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
		},
		getStageRoot: () => attachedWrap?.querySelector('.pptxv-stage') ?? null,
	});

	// The on-canvas motion-path layer; it lives inside the stage transform, so it
	// owns its own re-mount lifecycle (see `motion-path-controller.ts`).
	const motionPath = createMotionPathController({
		doc,
		store,
		getTranslator: deps.getTranslator,
		getScale: deps.getScale,
		getStageWrap: () => attachedWrap,
		getSelectedElement: (state) => ops.selectedElement(state),
		onChangePath: (path) => editActions.setMotionPathData(path),
	});

	const syncOverlay = (): void => {
		// The format toolbar + inspector track selection even before the overlay
		// layer is mounted, so refresh them regardless of the overlay guard.
		syncEditingChrome();
		motionPath.sync();
		if (!overlay) {
			return;
		}
		const state = store.get();
		const selected =
			state.editable && !state.presenting
				? getActiveElements(state).filter((element) =>
						state.selectedElementIds.includes(element.id),
					)
				: [];
		overlay.setBox(selectionOverlayBox(selected), deps.getScale());
		// The chrome must only offer what the selection's `a:spLocks` allow: a
		// `noResize` shape shows no resize handles, a `noRotation` one no knob.
		const allowed = selectionInteractivity(state);
		overlay.setHandleVisibility({ resizable: allowed.resizable, rotatable: allowed.rotatable });
		overlay.setAdjustHandle(selectedAdjustmentDescriptor(state), deps.getScale());
		// View > Guides hides the overlay, never the model: `state.guides` stays
		// whole so snapping and saving still see every guide.
		syncAlignmentGuides(doc, overlay.root, state.showGuides ? state.guides : [], deps.getScale());
	};

	const onKeyDown = createEditorKeydownHandler({
		isActive: () => {
			const state = store.get();
			return state.editable && !state.presenting && !interactions.inlineActive();
		},
		getSelectedId: () => store.get().selectedElementId,
		deselect: () => ops.select(null),
		deleteSelected: () => ops.deleteSelected(),
		duplicateSelected: () => void ops.duplicateSelected(),
		copySelected: () => editActions.copy(),
		cutSelected: () => editActions.cut(),
		paste: () => editActions.paste(),
		selectAll: () => editActions.selectAll(),
		groupSelected: () => editActions.groupSelected(),
		ungroupSelected: () => editActions.ungroupSelected(),
		nudgeSelected: (dx, dy) => ops.nudgeSelected(dx, dy),
		undo: () => ops.undo(),
		redo: () => ops.redo(),
		cancelFormatPainter: () => {
			if (!store.get().formatPainterSourceId) {
				return false;
			}
			store.set({ formatPainterSourceId: null });
			return true;
		},
		toggleShortcuts: () => deps.getChrome().shortcuts.toggle(),
		closeShortcuts: () => {
			const panel = deps.getChrome().shortcuts;
			if (!panel.isOpen()) {
				return false;
			}
			panel.close();
			return true;
		},
	});

	/**
	 * Stage pointerdown: keep the keymap armed, then run the gesture.
	 *
	 * The gesture handlers call `preventDefault()`, which suppresses the focus
	 * move the click would otherwise make. Without this the keydown listener on
	 * the viewer root never fires again after a canvas click: focus sits on
	 * `document.body` and pressing Delete on a selected shape does nothing.
	 */
	const onStagePointerDown = (event: PointerEvent): void => {
		armEditorKeyboard(attachedRoot);
		drawMode.onStagePointerDown(event);
	};

	const detachChrome = (): void => {
		interactions.closeInline(true);
		attachedWrap?.removeEventListener('pointerdown', onStagePointerDown);
		attachedWrap?.removeEventListener('pointermove', interactions.onStagePointerMove);
		attachedWrap?.removeEventListener('dblclick', drawMode.onStageDblClick);
		attachedRoot?.removeEventListener('keydown', onKeyDown);
		attachedWrap = null;
		attachedRoot = null;
		overlay?.destroy();
		overlay = null;
		motionPath.detach();
	};

	// -- Store subscription: keep selection/overlay/toolbar consistent -------------

	const unsubscribe = store.subscribe((state, previous) => {
		if (state.currentSlide !== previous.currentSlide) {
			interactions.closeInline(true);
			if (state.selectedElementId) {
				ops.select(null);
				return; // re-notifies; overlay synced on the follow-up pass
			}
		}
		if (
			(state.slides !== previous.slides ||
				state.templateElementsBySlideId !== previous.templateElementsBySlideId ||
				state.slideMasters !== previous.slideMasters ||
				state.notesMaster !== previous.notesMaster ||
				state.handoutMaster !== previous.handoutMaster) &&
			state.selectedElementId &&
			!ops.selectedElement(state)
		) {
			ops.select(null);
			return;
		}
		if (state.editable !== previous.editable) {
			if (!state.editable) {
				interactions.closeInline(true);
				if (state.selectedElementId) {
					ops.select(null);
				}
			}
			updateToolbar();
		}
		if (state.drawTool !== previous.drawTool || state.editable !== previous.editable) {
			drawMode.syncCursor(attachedWrap);
		}
		syncOverlay();
	});

	return {
		attachChrome() {
			detachChrome();
			const chrome = deps.getChrome();
			overlay = createSelectionOverlay(doc, deps.getTranslator(), {
				onHandlePointerDown(handle, event) {
					interactions.beginHandleGesture('resize', event, handle);
				},
				onRotatePointerDown(event) {
					interactions.beginHandleGesture('rotate', event);
				},
				onAdjustPointerDown(event) {
					interactions.beginAdjustGesture(event);
				},
			});
			motionPath.attach();
			attachedWrap = chrome.stageWrap;
			attachedRoot = chrome.root;
			attachedWrap.addEventListener('pointerdown', onStagePointerDown);
			attachedWrap.addEventListener('pointermove', interactions.onStagePointerMove);
			attachedWrap.addEventListener('dblclick', drawMode.onStageDblClick);
			attachedRoot.addEventListener('keydown', onKeyDown);
			overlay.mount(attachedWrap);
			updateToolbar();
			drawMode.syncCursor(attachedWrap);
			syncOverlay();
		},
		detachChrome,
		onStageRendered() {
			if (overlay && attachedWrap) {
				overlay.mount(attachedWrap);
				syncOverlay();
			}
		},
		capturesKeyboard() {
			const state = store.get();
			return state.editable && (state.selectedElementId !== null || interactions.inlineActive());
		},
		reset() {
			interactions.closeInline(false);
			drawMode.dispose();
			ops.clearHistory();
			store.set({
				selectedElementId: null,
				selectedElementIds: [],
				dirty: false,
				interactionActive: false,
				drawTool: 'select',
				formatPainterSourceId: null,
				editTemplateMode: false,
				masterViewTarget: null,
				masterViewTab: 'slides',
			});
			updateToolbar();
		},
		setEditable(editable) {
			store.set({
				editable,
				...(!editable
					? { editTemplateMode: false, selectedElementId: null, selectedElementIds: [] }
					: {}),
			});
		},
		undo: () => ops.undo(),
		redo: () => ops.redo(),
		canUndo: () => ops.canUndo(),
		canRedo: () => ops.canRedo(),
		setHistoryDepth: (depth) => ops.setHistoryDepth(depth),
		deleteSelected: () => ops.deleteSelected(),
		duplicateSelected: () => ops.duplicateSelected(),
		getSelectedElementId: () => store.get().selectedElementId,
		selectElements: (ids) => ops.select(ids.at(-1) ?? null, ids),
		applyElementPatch(id, patch) {
			const state = store.get();
			if (!state.editable || !getActiveElements(state).some((element) => element.id === id)) {
				return;
			}
			ops.pushHistory();
			store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === id ? ({ ...element, ...patch } as PptxElement) : element,
					),
				),
			);
			ops.commitChange();
		},
		commitSlides(slides, currentSlide = store.get().currentSlide) {
			if (!store.get().editable) {
				return;
			}
			ops.pushHistory();
			store.set({
				slides,
				currentSlide: Math.max(0, Math.min(currentSlide, slides.length - 1)),
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},
		setDrawTool: (tool) => drawMode.setTool(tool),
		setDrawColor: (color) => drawMode.setColor(color),
		setDrawWidth: (width) => drawMode.setWidth(width),
		getEditActions: () => editActions,
		getFindReplaceActions: () => findReplaceActions,
		commitNotes: (notes, notesSegments) => ops.commitNotes(notes, notesSegments),
		setHandoutSlidesPerPage: (count) => ops.setHandoutSlidesPerPage(count),
		updateDocumentProperties: (core, app, custom) =>
			ops.updateDocumentProperties(core, app, custom),
		updatePresentationProperties: (value) => ops.updatePresentationProperties(value),
		updateSections: (value) => ops.updateSections(value),
		updateHeaderFooter: (value) => ops.updateHeaderFooter(value),
		updateCustomShows: (value) => ops.updateCustomShows(value),
		save: (format) => ops.save(format),
		async downloadAs(format, fileName = `presentation.${format}`) {
			const bytes = await ops.save(format);
			downloadBlob(
				new Blob([bytes as unknown as BlobPart], { type: PRESENTATION_MIME[format] }),
				fileName,
			);
		},
		async downloadPptx(fileName = 'presentation.pptx') {
			await this.downloadAs('pptx', fileName);
		},
		async packageForSharing(fileName = 'presentation.pptx') {
			const bytes = await ops.save('pptx');
			const blob = await buildSharingPackage(bytes, fileName);
			downloadBlob(blob, `${fileName.replace(/\.pptx$/iu, '')}-package.zip`);
		},
		destroy() {
			unsubscribe();
			interactions.dispose();
			drawMode.dispose();
			detachChrome();
		},
	};
}
