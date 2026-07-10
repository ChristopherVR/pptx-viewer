import type { PptxHandler } from 'pptx-viewer-core';
import type { InteractionBox, SnapSibling } from 'pptx-viewer-shared';
import { downloadBlob } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { createGestureController } from './editor-gestures';
import { createEditorKeydownHandler } from './editor-keyboard';
import { createEditorOps } from './editor-operations';
import { resolveTopLevelElementId } from './element-hit';
import type { InlineEditorSession } from './inline-text-editor';
import { canInlineEditElement, openInlineEditor } from './inline-text-editor';
import type { SelectionOverlay } from './selection-overlay';
import { createSelectionOverlay } from './selection-overlay';

/**
 * The editing orchestrator for the vanilla viewer: wires the selection
 * overlay, pointer gestures, inline text editing, and the editing keyboard
 * to the history-tracked operations in `editor-operations`. All pure editing
 * math lives in `pptx-viewer-shared`; this module is DOM/event plumbing only.
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
	save(): Promise<Uint8Array>;
	downloadPptx(fileName?: string): Promise<void>;
	destroy(): void;
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function createEditorController(deps: EditorControllerDeps): EditorController {
	const { doc, store } = deps;
	let overlay: SelectionOverlay | null = null;
	let inline: InlineEditorSession | null = null;
	let attachedWrap: HTMLElement | null = null;
	let attachedRoot: HTMLElement | null = null;

	const updateToolbar = (): void => {
		deps.getChrome().toolbar?.setEditState({
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

	const elementBox = (id: string): InteractionBox | undefined => {
		const state = store.get();
		const el = state.slides[state.currentSlide]?.elements.find((e) => e.id === id);
		return el
			? { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 }
			: undefined;
	};

	const syncOverlay = (): void => {
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

	// -- Gestures (move / resize / rotate) -------------------------------------

	const gestures = createGestureController({
		getScale: deps.getScale,
		getElementBox: elementBox,
		getSiblings(): SnapSibling[] {
			const state = store.get();
			return (state.slides[state.currentSlide]?.elements ?? []).map(
				({ id, x, y, width, height }) => ({ id, x, y, width, height }),
			);
		},
		getStageOrigin() {
			const rect = overlay?.root.getBoundingClientRect();
			return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
		},
		onStart() {
			ops.pushHistory();
			store.set({ interactionActive: true });
		},
		onPreview(transform, lines) {
			ops.patchGeometry(transform.id, transform);
			overlay?.setSnapLines(lines, deps.getScale());
		},
		onEnd(transform, moved, id) {
			overlay?.setSnapLines([], 1);
			if (transform) {
				ops.patchGeometry(id, transform);
			}
			store.set({ interactionActive: false });
			if (moved) {
				ops.commitChange();
			}
		},
	});

	// -- Inline text editing ----------------------------------------------------

	const closeInline = (commit: boolean): void => {
		const session = inline;
		inline = null;
		if (commit) {
			session?.commit();
		} else {
			session?.cancel();
		}
	};

	const enterInlineEdit = (id: string): void => {
		const state = store.get();
		const el = state.slides[state.currentSlide]?.elements.find((e) => e.id === id);
		if (!el || !canInlineEditElement(el) || !overlay || inline) {
			return;
		}
		ops.select(id);
		overlay.setEditing(true);
		inline = openInlineEditor({
			doc,
			overlayRoot: overlay.root,
			box: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 },
			scale: deps.getScale(),
			element: el,
			onCommit: (text) => ops.commitInlineText(id, text),
			onClose() {
				inline = null;
				overlay?.setEditing(false);
			},
		});
	};

	// -- Stage / keyboard listeners -----------------------------------------------

	const stageRoot = (): Element | null => attachedWrap?.querySelector('.pptxv-stage') ?? null;

	const onStagePointerDown = (event: PointerEvent): void => {
		const state = store.get();
		if (!state.editable || state.presenting || event.button !== 0 || inline) {
			return;
		}
		const id = resolveTopLevelElementId(event.target, stageRoot());
		if (!id) {
			if (state.selectedElementId) {
				ops.select(null);
			}
			return;
		}
		if (state.selectedElementId !== id) {
			ops.select(id);
		}
		gestures.begin('move', id, event);
	};

	const onStageDblClick = (event: MouseEvent): void => {
		const state = store.get();
		if (!state.editable || state.presenting) {
			return;
		}
		const id = resolveTopLevelElementId(event.target, stageRoot());
		if (id) {
			enterInlineEdit(id);
		}
	};

	const onKeyDown = createEditorKeydownHandler({
		isActive: () => {
			const state = store.get();
			return state.editable && !state.presenting && !inline;
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
		closeInline(true);
		attachedWrap?.removeEventListener('pointerdown', onStagePointerDown);
		attachedWrap?.removeEventListener('dblclick', onStageDblClick);
		attachedRoot?.removeEventListener('keydown', onKeyDown);
		attachedWrap = null;
		attachedRoot = null;
		overlay?.destroy();
		overlay = null;
	};

	// -- Store subscription: keep selection/overlay/toolbar consistent -------------

	const unsubscribe = store.subscribe((state, previous) => {
		if (state.currentSlide !== previous.currentSlide) {
			closeInline(true);
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
				closeInline(true);
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
					const id = store.get().selectedElementId;
					if (id) {
						gestures.begin('resize', id, event, handle);
					}
				},
				onRotatePointerDown(event) {
					const id = store.get().selectedElementId;
					if (id) {
						gestures.begin('rotate', id, event);
					}
				},
			});
			attachedWrap = chrome.stageWrap;
			attachedRoot = chrome.root;
			attachedWrap.addEventListener('pointerdown', onStagePointerDown);
			attachedWrap.addEventListener('dblclick', onStageDblClick);
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
			return state.editable && (state.selectedElementId !== null || inline !== null);
		},
		reset() {
			closeInline(false);
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
		save: () => ops.save(),
		async downloadPptx(fileName = 'presentation.pptx') {
			const bytes = await ops.save();
			downloadBlob(new Blob([bytes as unknown as BlobPart], { type: PPTX_MIME }), fileName);
		},
		destroy() {
			unsubscribe();
			gestures.dispose();
			detachChrome();
		},
	};
}
