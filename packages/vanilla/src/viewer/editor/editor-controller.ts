import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxElement,
	PptxHandler,
	PptxSaveFormat,
	PptxSlide,
	TextSegment,
} from 'pptx-viewer-core';
import { downloadBlob } from 'pptx-viewer-shared';

import { buildSharingPackage } from '../export/package-sharing';
import type { Translator } from '../i18n';
import type { DrawTool, Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { createEditingChromeSync } from './editing-chrome-sync';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import { selectionOverlayBox } from './editor-controller-overlay';
import { createDrawModeController } from './editor-draw-mode';
import type { EditActions } from './editor-edit-ops';
import { createEditActions } from './editor-edit-ops';
import type { FindReplaceActions } from './editor-find-replace-actions';
import { createFindReplaceActions } from './editor-find-replace-actions';
import { createEditorKeydownHandler } from './editor-keyboard';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import type { SelectionOverlay } from './selection-overlay';
import { createSelectionOverlay } from './selection-overlay';

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

	const editActions = createEditActions({ doc, store, ops });
	const findReplaceActions = createFindReplaceActions({ store, ops });

	const syncEditingChrome = createEditingChromeSync({
		store,
		getChrome: deps.getChrome,
		selectedElement: (state) => ops.selectedElement(state),
	});

	const interactions = createStageInteractions({
		doc,
		store,
		ops,
		getScale: deps.getScale,
		getOverlay: () => overlay,
		getStageRoot: () => attachedWrap?.querySelector('.pptxv-stage') ?? null,
		onCursorMove: deps.onCursorMove,
		onEditEquation: (id, omml) => deps.getChrome().ribbon?.openEquationEditor(id, omml),
	});

	// The Draw ribbon tab's pen/highlighter/eraser mode: routes each stage
	// `pointerdown` / `dblclick` to its own gesture controller or to
	// `interactions`, never both, based on `drawTool`, so freehand drawing and
	// the normal move/resize/rotate/inline-edit gestures never fight over the
	// same pointer (see `editor-draw-mode.ts`).
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

	const syncOverlay = (): void => {
		// The format toolbar + inspector track selection even before the overlay
		// layer is mounted, so refresh them regardless of the overlay guard.
		syncEditingChrome();
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
	});

	const detachChrome = (): void => {
		interactions.closeInline(true);
		attachedWrap?.removeEventListener('pointerdown', drawMode.onStagePointerDown);
		attachedWrap?.removeEventListener('pointermove', interactions.onStagePointerMove);
		attachedWrap?.removeEventListener('dblclick', drawMode.onStageDblClick);
		attachedRoot?.removeEventListener('keydown', onKeyDown);
		attachedWrap = null;
		attachedRoot = null;
		overlay?.destroy();
		overlay = null;
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
			});
			attachedWrap = chrome.stageWrap;
			attachedRoot = chrome.root;
			attachedWrap.addEventListener('pointerdown', drawMode.onStagePointerDown);
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
