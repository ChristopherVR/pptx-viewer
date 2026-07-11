import type { PptxHandler } from 'pptx-viewer-core';
import { downloadBlob } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { createEditingChromeSync } from './editing-chrome-sync';
import type { EditActions } from './editor-edit-ops';
import { createEditActions } from './editor-edit-ops';
import type { FindReplaceActions } from './editor-find-replace-actions';
import { createFindReplaceActions } from './editor-find-replace-actions';
import { createEditorKeydownHandler } from './editor-keyboard';
import { createEditorOps } from './editor-operations';
import { createStageInteractions } from './editor-stage-interactions';
import type { SelectionOverlay } from './selection-overlay';
import { createSelectionOverlay } from './selection-overlay';

/**
 * The editing orchestrator for the vanilla viewer: wires the selection
 * overlay, pointer gestures (see `editor-stage-interactions`), inline text
 * editing, and the editing keyboard to the history-tracked operations in
 * `editor-operations`. All pure editing math lives in `pptx-viewer-shared`;
 * this module is DOM/event plumbing only.
 */
export interface EditorControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	getChrome(): ViewerChrome;
	getTranslator(): Translator;
	getScale(): number;
	getHandler(): PptxHandler | null;
	/** Host `onChange` callback: fired after every committed mutation. */
	onChange?: () => void;
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
	/** The formatting / insert / arrange actions for the editing chrome. */
	getEditActions(): EditActions;
	/** The Find & Replace actions for the ribbon's docked panel. */
	getFindReplaceActions(): FindReplaceActions;
	/** Commit the speaker-notes textarea's plain text onto the current slide. */
	commitNotes(notes: string): void;
	save(): Promise<Uint8Array>;
	downloadPptx(fileName?: string): Promise<void>;
	destroy(): void;
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function createEditorController(deps: EditorControllerDeps): EditorController {
	const { doc, store } = deps;
	let overlay: SelectionOverlay | null = null;
	let attachedWrap: HTMLElement | null = null;
	let attachedRoot: HTMLElement | null = null;

	const updateToolbar = (): void => {
		deps.getChrome().ribbon?.setEditState({
			editable: store.get().editable,
			canUndo: ops.canUndo(),
			canRedo: ops.canRedo(),
		});
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
	});

	const syncOverlay = (): void => {
		// The format toolbar + inspector track selection even before the overlay
		// layer is mounted, so refresh them regardless of the overlay guard.
		syncEditingChrome();
		if (!overlay) {
			return;
		}
		const state = store.get();
		const el = state.editable && !state.presenting ? ops.selectedElement(state) : undefined;
		overlay.setBox(
			el
				? { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 }
				: null,
			deps.getScale(),
		);
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
		nudgeSelected: (dx, dy) => ops.nudgeSelected(dx, dy),
		undo: () => ops.undo(),
		redo: () => ops.redo(),
	});

	const detachChrome = (): void => {
		interactions.closeInline(true);
		attachedWrap?.removeEventListener('pointerdown', interactions.onStagePointerDown);
		attachedWrap?.removeEventListener('dblclick', interactions.onStageDblClick);
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
			state.slides !== previous.slides &&
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
			attachedWrap.addEventListener('pointerdown', interactions.onStagePointerDown);
			attachedWrap.addEventListener('dblclick', interactions.onStageDblClick);
			attachedRoot.addEventListener('keydown', onKeyDown);
			overlay.mount(attachedWrap);
			updateToolbar();
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
			ops.clearHistory();
			store.set({ selectedElementId: null, dirty: false, interactionActive: false });
			updateToolbar();
		},
		setEditable(editable) {
			store.set({ editable });
		},
		undo: () => ops.undo(),
		redo: () => ops.redo(),
		canUndo: () => ops.canUndo(),
		canRedo: () => ops.canRedo(),
		deleteSelected: () => ops.deleteSelected(),
		duplicateSelected: () => ops.duplicateSelected(),
		getSelectedElementId: () => store.get().selectedElementId,
		getEditActions: () => editActions,
		getFindReplaceActions: () => findReplaceActions,
		commitNotes: (notes) => ops.commitNotes(notes),
		save: () => ops.save(),
		async downloadPptx(fileName = 'presentation.pptx') {
			const bytes = await ops.save();
			downloadBlob(new Blob([bytes as unknown as BlobPart], { type: PPTX_MIME }), fileName);
		},
		destroy() {
			unsubscribe();
			interactions.dispose();
			detachChrome();
		},
	};
}
