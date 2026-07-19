import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import type { ViewerMode } from 'pptx-viewer-shared';
/**
 * useViewerIntegration: Wires pointer handling, content lifecycle,
 * I/O, annotations, recovery, imperative handle, parent callbacks,
 * and keyboard shortcuts into the viewer orchestrator.
 */
import { useEffect, useImperativeHandle, useState } from 'react';
import type { Dispatch, ForwardedRef, RefObject, SetStateAction } from 'react';

import { MIN_ZOOM_SCALE, MAX_ZOOM_SCALE } from '../constants';
import type { PowerPointViewerHandle } from '../types';
import type { AnnotationHandlersResult } from './useAnnotationHandlers';
import { useAnnotationHandlers } from './useAnnotationHandlers';
import type { AutosaveStatus } from './useAutosave';
import { useContentLifecycle } from './useContentLifecycle';
import type { EditorHistoryResult } from './useEditorHistory';
import type { EditorOperationsResult } from './useEditorOperations';
import type { IOHandlersResult } from './useIOHandlers';
import { useIOHandlers } from './useIOHandlers';
import { useKeyboardShortcutWiring } from './useKeyboardShortcutWiring';
import { usePointerHandlers } from './usePointerHandlers';
import type { PresentationSetupResult } from './usePresentationSetup';
import { useRecoveryDetection } from './useRecoveryDetection';
import type { ViewerState } from './useViewerState';
import type { UseZoomViewportResult } from './useZoomViewport';
import type { ViewerDialogsResult } from './viewer-dialog-types';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseViewerIntegrationInput {
	state: ViewerState;
	zoom: UseZoomViewportResult;
	history: EditorHistoryResult;
	presentation: PresentationSetupResult['presentation'];
	annotations: PresentationSetupResult['annotations'];
	actionSoundHandlerRef: PresentationSetupResult['actionSoundHandlerRef'];
	editorOps: EditorOperationsResult;
	dialogs: ViewerDialogsResult;
	gridSpacingPx: number;
	content: ArrayBuffer | Uint8Array | null;
	filePath: string | undefined;
	/** AutoSave toggle state from the title bar. */
	autosaveEnabled: boolean;
	canEdit: boolean;
	mode: ViewerState['mode'];
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	canvasSize: ViewerState['canvasSize'];
	loading: boolean;
	error: string | null;
	ref: ForwardedRef<PowerPointViewerHandle>;
	setContent: Dispatch<SetStateAction<ArrayBuffer | Uint8Array | null>>;
	onContentChange: ((content: Uint8Array) => void) | undefined;
	onDirtyChange: ((dirty: boolean) => void) | undefined;
	onActiveSlideChange: ((index: number) => void) | undefined;
	onModeChange: ((mode: ViewerMode) => void) | undefined;
	onZoomChange: ((zoom: number) => void) | undefined;
	onSelectionChange: ((ids: string[]) => void) | undefined;
	onSlideCountChange: ((count: number) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface ViewerIntegrationResult {
	exportHandlers: IOHandlersResult['exportHandlers'];
	printHandlers: IOHandlersResult['printHandlers'];
	themeHandlers: IOHandlersResult['themeHandlers'];
	propertyHandlers: IOHandlersResult['propertyHandlers'];
	showKeepAnnotationsDialog: AnnotationHandlersResult['showKeepAnnotationsDialog'];
	handleSetMode: AnnotationHandlersResult['handleSetMode'];
	handleKeepAnnotations: AnnotationHandlersResult['handleKeepAnnotations'];
	handleDiscardAnnotations: AnnotationHandlersResult['handleDiscardAnnotations'];
	handleEnterPresenterView: AnnotationHandlersResult['handleEnterPresenterView'];
	handleEnterRehearsalMode: AnnotationHandlersResult['handleEnterRehearsalMode'];
	autosaveStatus: AutosaveStatus;
	isEncryptedDialogOpen: boolean;
	setIsEncryptedDialogOpen: Dispatch<SetStateAction<boolean>>;
	/** The loaded core handler, exposed for the AI bridge (`getHandler`). */
	handlerRef: RefObject<PptxHandler | null>;
	/**
	 * Bumped each time the load pipeline finishes applying parsed content to
	 * viewer state. Collaboration watches it to re-adopt the shared doc's
	 * slides when a local load lands mid-session (see useYjsDocumentSync).
	 */
	loadVersion: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewerIntegration(input: UseViewerIntegrationInput): ViewerIntegrationResult {
	const {
		state,
		zoom,
		history,
		presentation,
		annotations,
		actionSoundHandlerRef,
		editorOps,
		dialogs,
		gridSpacingPx,
		content,
		filePath,
		autosaveEnabled,
		canEdit,
		mode,
		slides,
		activeSlide,
		activeSlideIndex,
		canvasSize,
		loading,
		error,
		ref,
		setContent,
		onContentChange,
		onDirtyChange,
		onActiveSlideChange,
		onModeChange,
		onZoomChange,
		onSelectionChange,
		onSlideCountChange,
	} = input;

	// ── Global pointer handlers for drag / resize / adjustment ────
	usePointerHandlers({
		editorScale: zoom.editorScale,
		canvasStageRef: zoom.canvasStageRef,
		canvasSize,
		activeSlide,
		activeSlideIndex,
		gridSpacingPx,
		dragStateRef: state.dragStateRef,
		resizeStateRef: state.resizeStateRef,
		shapeAdjustmentDragStateRef: state.shapeAdjustmentDragStateRef,
		marqueeStateRef: state.marqueeStateRef,
		editTemplateMode: state.editTemplateMode,
		snapToGrid: state.snapToGrid,
		snapToShape: state.snapToShape,
		guides: state.guides,
		templateElements: state.templateElements,
		elementLookup: state.elementLookup,
		setMarqueeSelectionState: state.setMarqueeSelectionState,
		setSnapLines: state.setSnapLines,
		setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
		setPointerCommitNonce: state.setPointerCommitNonce,
		effectiveSelectedIds: state.effectiveSelectedIds,
		applySelection: editorOps.ops.applySelection,
		clearSelection: editorOps.ops.clearSelection,
		updateSlides: editorOps.ops.updateSlides,
		updateElementById: editorOps.ops.updateElementById,
		markDirty: history.markDirty,
	});

	// ── Content lifecycle (load, font, serialize, autosave) ───────
	const [isEncryptedDialogOpen, setIsEncryptedDialogOpen] = useState(false);
	const [loadVersion, setLoadVersion] = useState(0);
	const { handlerRef, serializeSlides, autosaveStatus } = useContentLifecycle({
		content,
		filePath,
		autosaveEnabled,
		slides,
		state,
		history,
		ops: editorOps.ops,
		actionSoundHandlerRef,
		setIsEncryptedDialogOpen,
		password: dialogs.presentationPassword ?? undefined,
		onContentApplied: () => setLoadVersion((v) => v + 1),
	});

	// ── I/O handlers (export, print, theme, properties) ───────────
	const { exportHandlers, printHandlers, themeHandlers, propertyHandlers } = useIOHandlers({
		state,
		slides,
		activeSlideIndex,
		canvasSize,
		filePath,
		history,
		ops: editorOps.ops,
		zoom,
		handlerRef,
		serializeSlides,
		setContent,
		onContentChange,
		password: dialogs.presentationPassword ?? undefined,
	});

	// ── Mode switching with annotation awareness ──────────────────
	const {
		showKeepAnnotationsDialog,
		handleSetMode,
		handleKeepAnnotations,
		handleDiscardAnnotations,
		handleEnterPresenterView,
		handleEnterRehearsalMode,
	} = useAnnotationHandlers({
		mode,
		presentation,
		annotations,
		history,
		setMode: state.setMode,
		setSlides: state.setSlides,
	});

	// ── Recovery detection ────────────────────────────────────────
	useRecoveryDetection({
		filePath,
		loading,
		error,
		slideCount: slides.length,
		openVersionHistory: () => propertyHandlers.setIsVersionHistoryOpen(true),
	});

	// ── Imperative handle ─────────────────────────────────────────
	useImperativeHandle(
		ref,
		() => ({
			async getContent() {
				const data = await serializeSlides();
				if (data && onContentChange) {
					onContentChange(data);
				}
				return data ?? new Uint8Array(0);
			},
			goTo(index: number) {
				if (index >= 0 && index < slides.length) {
					state.setActiveSlideIndex(index);
				}
			},
			goPrev() {
				const next = activeSlideIndex - 1;
				if (next >= 0) {
					state.setActiveSlideIndex(next);
				}
			},
			goNext() {
				const next = activeSlideIndex + 1;
				if (next < slides.length) {
					state.setActiveSlideIndex(next);
				}
			},
			undo() {
				history.handleUndo();
			},
			redo() {
				history.handleRedo();
			},
			canUndo() {
				return history.canUndo;
			},
			canRedo() {
				return history.canRedo;
			},
			getZoom() {
				return zoom.scale;
			},
			setZoom(level: number) {
				zoom.setScale(Math.min(Math.max(level, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE));
			},
			zoomIn() {
				zoom.handleZoomIn();
			},
			zoomOut() {
				zoom.handleZoomOut();
			},
			zoomReset() {
				zoom.handleResetZoom();
			},
			getMode() {
				return mode;
			},
			setMode(newMode) {
				state.setMode(newMode);
			},
			getActiveSlideIndex() {
				return activeSlideIndex;
			},
			getSlideCount() {
				return slides.length;
			},
			isDirty() {
				return state.isDirty;
			},
			getSelectedElementIds() {
				return state.selectedElementIds;
			},
			selectElements(ids: string[]) {
				state.setSelectedElementIds(ids);
				state.setSelectedElementId(ids[0] ?? null);
			},
			clearSelection() {
				state.setSelectedElementIds([]);
				state.setSelectedElementId(null);
			},
			// -- Active slide (alias) --
			setActiveSlideIndex(index: number) {
				if (index >= 0 && index < slides.length) {
					state.setActiveSlideIndex(index);
				}
			},
			// -- Slide access --
			getSlides() {
				return slides;
			},
			getSlide(index: number) {
				return slides[index];
			},
			getActiveSlide() {
				return slides[activeSlideIndex];
			},
			// -- Slide manipulation --
			addSlide(_afterIndex?: number) {
				editorOps.slideOps.handleAddSlide();
			},
			deleteSlides(indexes: number[]) {
				editorOps.slideOps.handleDeleteSlides(indexes);
			},
			duplicateSlides(indexes: number[]) {
				editorOps.slideOps.handleDuplicateSlides(indexes);
			},
			moveSlide(fromIndex: number, toIndex: number) {
				editorOps.slideOps.handleMoveSlide(fromIndex, toIndex);
			},
			toggleHideSlides(indexes: number[]) {
				editorOps.slideOps.handleToggleHideSlides(indexes);
			},
			// -- Element access --
			getElements(slideIndex?: number) {
				const idx = slideIndex ?? activeSlideIndex;
				const s = slides[idx];
				return s?.elements ?? [];
			},
			getElementById(elementId: string, slideIndex?: number) {
				const idx = slideIndex ?? activeSlideIndex;
				const s = slides[idx];
				return s?.elements.find((e) => e.id === elementId);
			},
			// -- Element manipulation --
			updateElement(elementId: string, updates: Partial<PptxElement>) {
				editorOps.ops.updateElementById(elementId, updates);
			},
			deleteElements(elementIds: string[]) {
				state.setSelectedElementIds(elementIds);
				state.setSelectedElementId(elementIds[0] ?? null);
				editorOps.manipulation.handleDelete();
			},
			duplicateElement(elementId: string) {
				state.setSelectedElementIds([elementId]);
				state.setSelectedElementId(elementId);
				editorOps.manipulation.handleDuplicate();
				return state.selectedElementIds[0];
			},
		}),
		[
			serializeSlides,
			onContentChange,
			slides,
			activeSlideIndex,
			state,
			history,
			zoom,
			mode,
			editorOps,
		],
	);

	// ── Notify parent callbacks ───────────────────────────────────
	useEffect(() => {
		if (onDirtyChange) {
			onDirtyChange(state.isDirty);
		}
	}, [state.isDirty, onDirtyChange]);

	useEffect(() => {
		if (onActiveSlideChange) {
			onActiveSlideChange(activeSlideIndex);
		}
	}, [activeSlideIndex, onActiveSlideChange]);

	useEffect(() => {
		state.activeSlideIndexRef.current = activeSlideIndex;
	}, [activeSlideIndex, state.activeSlideIndexRef]);

	useEffect(() => {
		if (onModeChange) {
			onModeChange(mode);
		}
	}, [mode, onModeChange]);

	useEffect(() => {
		if (onZoomChange) {
			onZoomChange(zoom.scale);
		}
	}, [zoom.scale, onZoomChange]);

	useEffect(() => {
		if (onSelectionChange) {
			onSelectionChange(state.selectedElementIds);
		}
	}, [state.selectedElementIds, onSelectionChange]);

	useEffect(() => {
		if (onSlideCountChange) {
			onSlideCountChange(slides.length);
		}
	}, [slides.length, onSlideCountChange]);

	// ── Keyboard shortcuts ────────────────────────────────────────
	useKeyboardShortcutWiring({
		state,
		mode,
		canEdit,
		slides,
		activeSlide,
		ops: editorOps.ops,
		manipulation: editorOps.manipulation,
		history,
	});

	return {
		exportHandlers,
		printHandlers,
		themeHandlers,
		propertyHandlers,
		showKeepAnnotationsDialog,
		handleSetMode,
		handleKeepAnnotations,
		handleDiscardAnnotations,
		handleEnterPresenterView,
		handleEnterRehearsalMode,
		autosaveStatus,
		isEncryptedDialogOpen,
		setIsEncryptedDialogOpen,
		handlerRef,
		loadVersion,
	};
}
