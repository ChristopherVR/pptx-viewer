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
import {
	armEditorKeyboard,
	cycleSelectableElement,
	downloadBlob,
	mapCustomizedEditorKey,
	mapInlineTextFormatKey,
	moveGuide,
	removeGuide,
	savedPresentationFileName,
} from 'pptx-viewer-shared';
import type {
	FreeformToolKind,
	ResolvedCustomization,
	ResolvedKeyboardCustomization,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { DrawTool, Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { rasterizePastedElementAsPicture } from '../ui/context-menu-format-actions';
import { openHyperlinkEditDialog } from '../ui/hyperlink-edit-dialog';
import { openPasteSpecialDialog } from '../ui/paste-special-dialog';
import { syncAlignmentGuides } from './alignment-guide-view';
import { createChartQuickActionsOverlay } from './chart-quick-actions-overlay';
import type { ChartQuickActionsOverlay } from './chart-quick-actions-overlay';
import { createConnectorEndpointOverlay } from './connector-endpoint-overlay';
import type { ConnectorEndpointOverlay } from './connector-endpoint-overlay';
import { createEditingChromeSync } from './editing-chrome-sync';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import { selectionOverlayBox } from './editor-controller-overlay';
import { createDrawModeController } from './editor-draw-mode';
import type { EditActions } from './editor-edit-ops';
import { createEditActions } from './editor-edit-ops';
import type { FindReplaceActions } from './editor-find-replace-actions';
import { createFindReplaceActions } from './editor-find-replace-actions';
import { attachCanvasImagePaste } from './editor-image-paste';
import { createEditorKeydownHandler } from './editor-keyboard';
import { selectionInteractivity } from './editor-lock-gates';
import { createEditorOps } from './editor-operations';
import { recordRecentColor } from './editor-recent-colors';
import { createStageInteractions } from './editor-stage-interactions';
import { createMotionPathController } from './motion-path-controller';
import { createOutlineAuthoringController } from './outline-authoring-controller';
import type { SelectionOverlay } from './selection-overlay';
import { createSelectionOverlay } from './selection-overlay';
import { selectedAdjustmentDescriptors } from './shape-adjust-gesture';

export interface EditorControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	getChrome(): ViewerChrome;
	getTranslator(): Translator;
	getScale(): number;
	getLivePatcher?(): import('pptx-viewer-shared').CollaborationLivePatcher | undefined;
	getHandler(): PptxHandler | null;
	/** Adopt a handler produced by an in-session mutation (Slide Master view CRUD). */
	setHandler(handler: PptxHandler): void;
	/** Options > General > "User name" override for new comment/reply authorship. */
	getUserName?: () => string | undefined;
	/** Options > Proofing > AutoCorrect, applied to committed inline-edit text. */
	transformCommittedText?: (text: string) => string;
	/** Host `onChange` callback: fired after every committed mutation. */
	onChange?: () => void;
	/** Notified with slide-space coordinates on stage pointer move (collaboration cursor broadcast). */
	onCursorMove?: (x: number, y: number) => void;
	/** Mirror in-progress inline-editor text to collaborators (live preview). */
	onInlineTextInput?: (elementId: string, text: string) => void;
	/** Push any queued live-preview frame out before an inline commit lands. */
	flushInlineTextInput?: () => void;
	/** The host's keyboard customisation, read on every key press. */
	getKeyboardCustomization?: () => ResolvedKeyboardCustomization | undefined;
	/** The host's resolved UI customisation (Edit Points gating, hidden commands). */
	getCustomization?: () => ResolvedCustomization | undefined;
}

export interface EditorController {
	hasActivePointerInteraction(): boolean;
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
	commitElementUpdates(slides: PptxSlide[], label?: string): void;
	/** Switch the Draw ribbon tab's active tool (also clears selection when leaving `'select'`). */
	setDrawTool(tool: DrawTool): void;
	/** Set the pen/highlighter stroke colour used by the next committed stroke. */
	setDrawColor(color: string): void;
	/** Set the pen/highlighter stroke width used by the next committed stroke. */
	setDrawWidth(width: number): void;
	/** Start Edit Points on `id` (context menu); false when it cannot be edited. */
	startEditPoints(id: string): boolean;
	/** Arm (or, with null, disarm) the Freeform: Shape / Curve drawing tool. */
	armFreeformTool(tool: FreeformToolKind | null): void;
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
	downloadPptx(fileName?: string): Promise<void>;
	destroy(): void;
}

const PRESENTATION_MIME: Record<PptxSaveFormat, string> = {
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
	pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
	ppt: 'application/vnd.ms-powerpoint',
};

export function createEditorController(deps: EditorControllerDeps): EditorController {
	const { doc, store } = deps;
	let overlay: SelectionOverlay | null = null;
	let connectorEndpoints: ConnectorEndpointOverlay | null = null;
	let chartQuickActions: ChartQuickActionsOverlay | null = null;
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
		transformCommittedText: deps.transformCommittedText,
		getPendingInlineTextEdit: () => interactions.readPendingInlineTextEdit?.(),
		readInlineList: () => interactions.readInlineList?.(),
		formatInlineList: (snapshot) => interactions.formatInlineList?.(snapshot) ?? false,
		cancelInlineList: () => interactions.closeInline(false),
	});

	const editActions = createEditActions({
		doc,
		getTranslator: deps.getTranslator,
		store,
		ops,
		getHandler: deps.getHandler,
		setHandler: deps.setHandler,
		getUserName: deps.getUserName,
	});
	const findReplaceActions = createFindReplaceActions({ store, ops });

	/** Shared by the `hyperlink` keyboard action and the public `applyElementPatch`. */
	const applyElementPatch = (id: string, patch: Partial<PptxElement>): void => {
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
	};

	/** Ctrl+K: open the hyperlink dialog for the currently selected element. */
	const openHyperlinkForSelection = (): void => {
		const state = store.get();
		const element = getActiveElements(state).find((el) => el.id === state.selectedElementId);
		if (!element) {
			return;
		}
		openHyperlinkEditDialog(doc, deps.getTranslator(), element, (patch) =>
			applyElementPatch(element.id, patch),
		);
	};

	/** Ctrl+Shift+V, or paste-format fired from inside the inline editor. */
	const pasteFormatOntoSelection = (): void => {
		const state = store.get();
		if (state.formatPainterSourceId && state.selectedElementId) {
			ops.applyFormatPainter(state.formatPainterSourceId, state.selectedElementId);
		}
	};

	/**
	 * Live-format keyboard shortcuts fired from inside the inline text editor.
	 *
	 * The editor's own keydown listener stops propagation on every key (so
	 * ordinary viewer shortcuts never fire mid-edit), which means this handler,
	 * not `createEditorKeydownHandler`'s root switch, is the only place that
	 * ever sees these chords while text is under active edit. Bold/italic/
	 * underline are resolved separately from the shared keymap (they are
	 * deliberately not part of `mapEditorKey`); the rest reuse the exact same
	 * `mapEditorKey` decision the root handler makes elsewhere, with
	 * `isEditingText: true` forced since that is always true by construction
	 * here.
	 */
	const onInlineLiveFormatKey = (event: KeyboardEvent): boolean => {
		const boldItalicUnderline = mapInlineTextFormatKey(event);
		if (boldItalicUnderline === 'bold') {
			editActions.toggleBold();
			return true;
		}
		if (boldItalicUnderline === 'italic') {
			editActions.toggleItalic();
			return true;
		}
		if (boldItalicUnderline === 'underline') {
			editActions.toggleUnderline();
			return true;
		}
		const { action } = mapCustomizedEditorKey(
			event,
			{ isEditingText: true, canEdit: true, hasSelection: true },
			deps.getKeyboardCustomization?.(),
		);
		switch (action) {
			case 'alignLeft':
				editActions.setTextAlign('left');
				return true;
			case 'alignCenter':
				editActions.setTextAlign('center');
				return true;
			case 'alignRight':
				editActions.setTextAlign('right');
				return true;
			case 'alignJustify':
				editActions.setTextAlign('justify');
				return true;
			case 'increaseFontSize':
				editActions.stepFontSize('increase');
				return true;
			case 'decreaseFontSize':
				editActions.stepFontSize('decrease');
				return true;
			case 'copyFormat':
				editActions.toggleFormatPainter();
				return true;
			case 'pasteFormat':
				pasteFormatOntoSelection();
				return true;
			case 'hyperlink':
				openHyperlinkForSelection();
				return true;
			case 'clearFormatting':
				editActions.clearFormatting();
				return true;
			case 'find':
			case 'findReplace':
				deps.getChrome().ribbon?.toggleFindReplace();
				return true;
			default:
				return false;
		}
	};

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
		getLivePatcher: deps.getLivePatcher,
		getStageRoot: () => attachedWrap?.querySelector('.pptxv-stage') ?? null,
		onCursorMove: deps.onCursorMove,
		onInlineTextInput: deps.onInlineTextInput,
		flushInlineTextInput: deps.flushInlineTextInput,
		onEditEquation: (id, omml) => deps.getChrome().ribbon?.openEquationEditor(id, omml),
		onEyedropper: (color) => editActions.setShapeFill(color),
		onInlineLiveFormatKey,
	});

	// Draw mode owns stage gestures while a pen, highlighter, or eraser is active.
	const drawMode = createDrawModeController({
		doc,
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

	// Edit Points and the Freeform: Shape / Curve tools, also inside the stage.
	const outlineAuthoring = createOutlineAuthoringController({
		doc,
		store,
		getTranslator: deps.getTranslator,
		getScale: deps.getScale,
		getStageWrap: () => attachedWrap,
		getCustomization: deps.getCustomization,
		applyElementPatch: (id, patch) => applyElementPatch(id, patch),
		insertElement: (element) => editActions.insertElement(element),
	});

	const syncOverlay = (): void => {
		// The format toolbar + inspector track selection even before the overlay
		// layer is mounted, so refresh them regardless of the overlay guard.
		syncEditingChrome();
		motionPath.sync();
		outlineAuthoring.sync();
		if (!overlay) {
			return;
		}
		const state = store.get();
		const selected =
			state.editable && !state.presenting
				? getActiveElements(state).filter(
						(element) =>
							state.selectedElementIds.includes(element.id) &&
							// A shape in Edit Points mode shows its vertices, not its box.
							!outlineAuthoring.isEditingPoints(element.id),
					)
				: [];
		overlay.setBox(selectionOverlayBox(selected), deps.getScale());
		// The chrome must only offer what the selection's `a:spLocks` allow: a
		// `noResize` shape shows no resize handles, a `noRotation` one no knob.
		const allowed = selectionInteractivity(state);
		overlay.setHandleVisibility({ resizable: allowed.resizable, rotatable: allowed.rotatable });
		overlay.setAdjustHandles(selectedAdjustmentDescriptors(state), deps.getScale());
		connectorEndpoints?.sync();
		chartQuickActions?.sync();
		// View > Guides hides the overlay, never the model: `state.guides` stays
		// whole so snapping and saving still see every guide.
		syncAlignmentGuides(
			doc,
			overlay.root,
			state.showGuides ? state.guides : [],
			deps.getScale(),
			// Draggable + double-click-removable only while editing gestures apply
			// at all; a read-only or presenting viewer shows static lines, same as
			// every other on-canvas interaction.
			state.editable && !state.presenting
				? {
						onMoveGuide: (id, position) => {
							const current = store.get();
							store.set({ guides: moveGuide(current.guides, id, position, current.canvasSize) });
						},
						onRemoveGuide: (id) => {
							store.set({ guides: removeGuide(store.get().guides, id) });
						},
					}
				: undefined,
		);
	};

	const onKeyDown = createEditorKeydownHandler({
		getKeyboardCustomization: deps.getKeyboardCustomization,
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
		canPaste: () => {
			const state = store.get();
			return Boolean(state.clipboardPayload && state.slides[state.currentSlide]);
		},
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
		// Same action as Home > Editing > Find. Null when the host disabled the
		// ribbon, in which case there is no find panel to open and the chord
		// correctly does nothing.
		toggleFind: () => deps.getChrome().ribbon?.toggleFindReplace(),
		closeShortcuts: () => {
			const panel = deps.getChrome().shortcuts;
			if (!panel.isOpen()) {
				return false;
			}
			panel.close();
			return true;
		},
		setTextAlign: (align) => editActions.setTextAlign(align),
		stepFontSize: (direction) => editActions.stepFontSize(direction),
		copyFormat: () => editActions.toggleFormatPainter(),
		pasteFormat: pasteFormatOntoSelection,
		addSlide: () => editActions.addSlide(),
		openHyperlink: openHyperlinkForSelection,
		toggleFindReplace: () => deps.getChrome().ribbon?.toggleFindReplace(),
		clearFormatting: () => editActions.clearFormatting(),
		cycleSelection: (direction) => {
			const state = store.get();
			const ids = getActiveElements(state).map((element) => element.id);
			const nextId = cycleSelectableElement(ids, state.selectedElementId, direction);
			if (nextId) {
				ops.select(nextId, [nextId]);
			}
		},
		onPasteSpecial: () => {
			if (!store.get().clipboardPayload) {
				return;
			}
			openPasteSpecialDialog(doc, deps.getTranslator(), {
				onConfirm: (format) => {
					const id = editActions.pasteWithFormat(format);
					if (!id || format !== 'picture') {
						return;
					}
					const sourceClone = store
						.get()
						.pasteOptionsToolbar?.find((entry) => entry.id === id)?.sourceClone;
					if (!sourceClone) {
						return;
					}
					requestAnimationFrame(() => {
						void rasterizePastedElementAsPicture(doc, id, sourceClone).then((picture) => {
							if (picture) {
								editActions.replaceElement(id, picture);
							}
							return undefined;
						});
					});
				},
			});
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

	let detachImagePaste: (() => void) | undefined;
	const detachChrome = (): void => {
		detachImagePaste?.();
		detachImagePaste = undefined;
		interactions.closeInline(true);
		interactions.closeInline(false);
		attachedWrap?.removeEventListener('pointerdown', onStagePointerDown);
		attachedWrap?.removeEventListener('pointermove', interactions.onStagePointerMove);
		attachedWrap?.removeEventListener('dblclick', drawMode.onStageDblClick);
		attachedRoot?.removeEventListener('keydown', onKeyDown);
		attachedWrap = null;
		attachedRoot = null;
		overlay?.destroy();
		overlay = null;
		connectorEndpoints?.dispose();
		connectorEndpoints = null;
		chartQuickActions?.dispose();
		chartQuickActions = null;
		motionPath.detach();
		outlineAuthoring.detach();
	};

	// -- Store subscription: keep selection/overlay/toolbar consistent -------------

	const unsubscribe = store.subscribe((state, previous) => {
		if (previous.editable && !state.editable) {
			interactions.retainAcceptedInlineText?.();
		}
		interactions.readInlineList?.();
		if (state.loading && !previous.loading) {
			interactions.closeInline(false);
		}
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
				onAdjustPointerDown(event, descriptor) {
					interactions.beginAdjustGesture(event, descriptor);
				},
			});
			connectorEndpoints = createConnectorEndpointOverlay({
				doc,
				store,
				ops,
				getScale: deps.getScale,
				label: (kind) =>
					deps.getTranslator()(
						kind === 'start'
							? 'pptx.canvas.connectorEndpointStart'
							: 'pptx.canvas.connectorEndpointEnd',
					),
			});
			chartQuickActions = createChartQuickActionsOverlay({
				doc,
				t: deps.getTranslator(),
				store,
				ops,
				getScale: deps.getScale,
			});
			motionPath.attach();
			attachedWrap = chrome.stageWrap;
			attachedRoot = chrome.root;
			detachImagePaste = attachCanvasImagePaste(attachedRoot, attachedWrap, {
				store,
				getHandler: deps.getHandler,
				isEditing: interactions.inlineActive,
				insertElement: editActions.insertElement,
			});
			attachedWrap.addEventListener('pointerdown', onStagePointerDown);
			attachedWrap.addEventListener('pointermove', interactions.onStagePointerMove);
			attachedWrap.addEventListener('dblclick', drawMode.onStageDblClick);
			attachedRoot.addEventListener('keydown', onKeyDown);
			overlay.mount(attachedWrap);
			connectorEndpoints.mount(attachedWrap);
			chartQuickActions.mount(attachedWrap);
			updateToolbar();
			drawMode.syncCursor(attachedWrap);
			syncOverlay();
		},
		detachChrome,
		onStageRendered() {
			if (overlay && attachedWrap) {
				overlay.mount(attachedWrap);
				connectorEndpoints?.mount(attachedWrap);
				chartQuickActions?.mount(attachedWrap);
				syncOverlay();
			}
		},
		hasActivePointerInteraction: () =>
			interactions.hasActivePointerInteraction() ||
			drawMode.isActive() ||
			Boolean(connectorEndpoints?.isActive()),
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
				editPointsElementId: null,
				freeformTool: null,
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
		applyElementPatch,
		commitElementUpdates(slides, label) {
			ops.pushHistory(label);
			store.set({ slides });
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
		setDrawColor: (color) => {
			recordRecentColor(store, color);
			drawMode.setColor(color);
		},
		setDrawWidth: (width) => drawMode.setWidth(width),
		startEditPoints: (id) => outlineAuthoring.startEditPoints(id),
		armFreeformTool: (tool) => outlineAuthoring.armFreeformTool(tool),
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
		// Every name below goes through the shared save-name decision, so a host
		// that passes the deck it opened (`report.ppt`) gets `report.pptx` back
		// rather than a `.ppt` whose bytes are an OpenXML package.
		async downloadAs(format, fileName) {
			const bytes = await ops.save(format);
			downloadBlob(
				new Blob([bytes as unknown as BlobPart], { type: PRESENTATION_MIME[format] }),
				savedPresentationFileName(fileName, format),
			);
		},
		async downloadPptx(fileName) {
			await this.downloadAs('pptx', fileName);
		},
		destroy() {
			unsubscribe();
			interactions.dispose();
			drawMode.dispose();
			detachChrome();
		},
	};
}
