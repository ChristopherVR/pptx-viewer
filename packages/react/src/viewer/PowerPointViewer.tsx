import type { PptxSlide } from 'pptx-viewer-core';
/**
 * PowerPoint Viewer Plugin — Top-level Orchestrator Component.
 *
 * This is the main entry point for rendering and editing PowerPoint (.pptx) files.
 * It composes the full viewer UI from sub-components (toolbar, canvas, dialogs,
 * overlays, presentation layer) and delegates business logic to a collection of
 * custom hooks:
 *
 * - `useViewerState` -- all mutable editor state (slides, selection, mode, etc.)
 * - `useDerivedSlideState` -- computed values derived from state (visible indexes, sections)
 * - `useZoomViewport` -- zoom level and viewport DOM ref management
 * - `useEditorHistory` -- undo/redo snapshot stack
 * - `usePresentationSetup` -- slideshow mode + annotation handling
 * - `useViewerDialogs` -- dialog open/close state and callbacks
 * - `useEditorOperations` -- element manipulation, insert, canvas, find/replace
 * - `useViewerIntegration` -- I/O, export, print, pointers, clipboard, lifecycle
 *
 * The component exposes a `PowerPointViewerHandle` via `forwardRef` so host
 * applications can call `getContent()` to retrieve the current file bytes.
 */
import { forwardRef, useCallback, useEffect, useState } from 'react';

import { ViewerThemeProvider, useThemeStyle } from '../theme';
// Components
import {
	LoadingState,
	ErrorState,
	ViewerOverlays,
	ViewerBottomPanels,
	ShareDialog,
	BroadcastDialog,
} from './components';
// Collaboration
import {
	CollaborationProvider,
	useCollaboration,
	CollaborationStatusIndicator,
} from './components/collaboration';
import { MobileChromeOverlay } from './components/mobile/MobileChromeOverlay';
import { SettingsDialog } from './components/SettingsDialog';
import { ViewerDialogGroup } from './components/ViewerDialogGroup';
import { ViewerMainContent } from './components/ViewerMainContent';
import { ViewerPresentationLayer } from './components/ViewerPresentationLayer';
import { ViewerToolbarSection } from './components/ViewerToolbarSection';
import { useYjsDocumentSync, useBroadcastFollower } from './hooks/collaboration';
import { useDerivedSlideState } from './hooks/useDerivedSlideState';
import { useEditorHistory } from './hooks/useEditorHistory';
import { useEditorOperations } from './hooks/useEditorOperations';
import { useIsMobile } from './hooks/useIsMobile';
import { usePresentationSetup } from './hooks/usePresentationSetup';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useResizablePanels } from './hooks/useResizablePanels';
import { useTouchGestures } from './hooks/useTouchGestures';
import { useViewerDialogs } from './hooks/useViewerDialogs';
import { useViewerIntegration } from './hooks/useViewerIntegration';
// Hooks
import { useViewerState } from './hooks/useViewerState';
import { useZoomViewport } from './hooks/useZoomViewport';
import type { PowerPointViewerProps, PowerPointViewerHandle } from './types';
export type { PowerPointViewerProps, PowerPointViewerHandle } from './types';
export { getAnimationInitialStyle } from './utils/animation';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Root React component for the PowerPoint viewer/editor.
 *
 * Accepts binary `.pptx` content and renders a full-featured editor with
 * slide canvas, toolbar, inspector panels, presentation mode, and more.
 *
 * Uses `forwardRef` to expose a `PowerPointViewerHandle` for imperative
 * access (e.g. serialising the current content for saving).
 */
export const PowerPointViewer = forwardRef<PowerPointViewerHandle, PowerPointViewerProps>(
	function PowerPointViewer(props, ref) {
		const {
			content: incomingContent,
			filePath,
			canEdit = false,
			onContentChange,
			onDirtyChange,
			onActiveSlideChange,
			theme,
			authorName,
			collaboration,
			onStartCollaboration,
			onStopCollaboration,
			shareDefaults,
		} = props;

		const themeStyle = useThemeStyle(theme);

		// Local content state -- synced from incoming prop but may diverge during editing.
		const [content, setContent] = useState<ArrayBuffer | Uint8Array | null>(incomingContent);
		// Re-sync when the parent provides a new content buffer (e.g. file reload).
		useEffect(() => {
			setContent(incomingContent);
		}, [incomingContent]);

		// ── Settings dialog ─────────────────────────────────────────
		const [isSettingsOpen, setIsSettingsOpen] = useState(false);

		// ── Share dialog ────────────────────────────────────────────
		const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

		// ── Share dialog defaults (provided by host app via shareDefaults prop) ──

		// ── Reduced motion ──────────────────────────────────────────
		const { reducedMotion, toggleReducedMotion } = useReducedMotion();

		// ── Mobile / responsive detection ──────────────────────────────
		// Initialized early because `containerRef` comes from `state` below,
		// but useIsMobile also works with a viewport-width fallback before
		// the ref is attached. We re-create the hook input after state init.

		// ── All state via custom hook ─────────────────────────────────
		const state = useViewerState({ content, canEdit });
		const {
			containerRef,
			mode,
			slides,
			canvasSize,
			loading,
			error,
			activeSlideIndex,
			selectedElementId,
			selectedElementIds,
			templateElementsBySlideId,
			activeSlide,
			selectedElement,
		} = state;

		// ── Mobile / responsive ─────────────────────────────────────
		const mobile = useIsMobile({ containerRef });
		const { isMobile, isTouchDevice, isVirtualKeyboardOpen } = mobile;

		// ── Resizable panels ──────────────────────────────────────
		const resizablePanels = useResizablePanels();

		// ── Derived computed values ───────────────────────────────────
		const { gridSpacingPx, visibleSlideIndexes, slideSectionGroups, masterPseudoSlide } =
			useDerivedSlideState({
				slides,
				sections: state.sections,
				customShows: state.customShows,
				activeCustomShowId: state.activeCustomShowId,
				mode,
				activeLayout: state.activeLayout,
				activeMaster: state.activeMaster,
				presentationGridSpacing: state.presentationProperties.gridSpacing,
			});

		// ── Core hooks ────────────────────────────────────────────────
		// Returns true when a drag, resize, marquee, adjustment, or drawing
		// interaction is in progress. Used by the history hook to defer
		// snapshot capture until the interaction completes.
		const hasActivePointerInteraction = useCallback(
			() =>
				Boolean(
					state.dragStateRef.current ||
					state.resizeStateRef.current ||
					state.marqueeStateRef.current ||
					state.shapeAdjustmentDragStateRef.current ||
					state.isDrawingRef.current,
				),
			[
				state.dragStateRef,
				state.resizeStateRef,
				state.marqueeStateRef,
				state.shapeAdjustmentDragStateRef,
				state.isDrawingRef,
			],
		);

		const zoom = useZoomViewport({
			canvasSize,
			selectedElements: state.selectedElements,
		});

		const history = useEditorHistory({
			slides,
			canvasSize,
			activeSlideIndex,
			templateElementsBySlideId,
			selectedElementId,
			selectedElementIds,
			editTemplateMode: state.editTemplateMode,
			headerFooter: state.headerFooter,
			loading,
			error,
			hasActivePointerInteraction,
			pointerCommitNonce: state.pointerCommitNonce,
			setSlides: state.setSlides,
			setCanvasSize: state.setCanvasSize,
			setActiveSlideIndex: state.setActiveSlideIndex,
			setTemplateElementsBySlideId: state.setTemplateElementsBySlideId,
			setSelectedElementId: state.setSelectedElementId,
			setSelectedElementIds: state.setSelectedElementIds,
			setEditTemplateMode: state.setEditTemplateMode,
			setHeaderFooter: state.setHeaderFooter,
		});

		// ── Presentation mode + annotations ───────────────────────────
		const { presentation, annotations, actionSoundHandlerRef } = usePresentationSetup({
			mode,
			slides,
			visibleSlideIndexes,
			activeSlideIndex,
			containerRef,
			content,
			mediaDataUrls: state.mediaDataUrls,
			presentationProperties: state.presentationProperties,
			setMode: state.setMode,
			setActiveSlideIndex: state.setActiveSlideIndex,
			setSlides: state.setSlides,
			history,
		});

		// ── Touch gestures — pinch-to-zoom on canvas viewport ──────
		useTouchGestures({
			targetRef: zoom.canvasViewportRef,
			currentScale: zoom.scale,
			callbacks: {
				onPinchZoom: (newScale) => zoom.setScale(newScale),
				onSwipe:
					mode === 'present'
						? (direction) => presentation.movePresentationSlide(direction === 1 ? -1 : 1)
						: undefined,
				onLongPress: (clientX, clientY) => {
					if (mode !== 'edit' || !canEdit) {
						return;
					}
					if (!state.selectedElementId) {
						return;
					}
					state.setContextMenuState({
						x: clientX,
						y: clientY,
						elementId: state.selectedElementId,
					});
				},
			},
			enabled: isTouchDevice,
		});

		// ── Dialogs ───────────────────────────────────────────────────
		const dialogs = useViewerDialogs({
			mode,
			slides,
			activeSlide,
			activeSlideIndex,
			canvasSize,
			containerRef,
			customShows: state.customShows,
			activeCustomShowId: state.activeCustomShowId,
			setCustomShows: state.setCustomShows,
			setActiveCustomShowId: state.setActiveCustomShowId,
			setGuides: state.setGuides,
			setPresentationProperties: state.setPresentationProperties,
			setAccessibilityIssues: state.setAccessibilityIssues as unknown as React.Dispatch<
				React.SetStateAction<
					Array<{
						slideIndex: number;
						elementId: string;
						severity: 'error' | 'warning' | 'info';
						message: string;
					}>
				>
			>,
			setIsAccessibilityPanelOpen: state.setIsAccessibilityPanelOpen,
			setMode: state.setMode,
			setPreMasterMode: state.setPreMasterMode,
			setActiveMasterIndex: state.setActiveMasterIndex,
			setActiveLayoutIndex: state.setActiveLayoutIndex,
			setSelectedElementId: state.setSelectedElementId,
			setSelectedElementIds: state.setSelectedElementIds,
			preMasterMode: state.preMasterMode,
			hasDigitalSignatures: state.hasDigitalSignatures,
			isDirty: state.isDirty,
			history,
		});

		// ── Editor operations (element ops, canvas, insert, etc.) ─────
		// ── Clear selection on slide change ──────────────────────────
		useEffect(() => {
			state.setSelectedElementId(null);
			state.setSelectedElementIds([]);
			state.setInlineEditingElementId(null);
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [activeSlideIndex]);

		const editorOps = useEditorOperations({
			state,
			history,
			zoom,
			mode,
			canEdit,
			slides,
			activeSlide,
			activeSlideIndex,
			selectedElement,
			selectedElementId,
			selectedElementIds,
			canvasSize,
			dialogs,
			presentation,
			userName: authorName ?? collaboration?.userName,
			handlerRef: actionSoundHandlerRef,
		});

		// ── Integration (pointers, lifecycle, I/O, annotations, etc.) ─
		const {
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
		} = useViewerIntegration({
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
		});

		// ── Early returns ─────────────────────────────────────────────
		if (loading) {
			return <LoadingState />;
		}
		if (error) {
			return <ErrorState error={error} />;
		}

		// On mobile, the slides pane is hidden by default (shown as overlay via
		// separate mobile UI). On tablet+, it follows the existing isNarrowViewport logic.
		const showSlidesPane =
			mode === 'edit' && !isMobile && !dialogs.isNarrowViewport && state.isSlidesPaneOpen;
		const showMasterPane = mode === 'master' && !isMobile && state.isSlidesPaneOpen;

		// ── JSX ───────────────────────────────────────────────────────
		const viewerContent = (
			<div
				ref={containerRef}
				// oxlint-disable-next-line no-noninteractive-tabindex
				tabIndex={0}
				style={themeStyle}
				data-pptx-viewer=''
				className='h-full w-full bg-background text-foreground flex flex-col relative overflow-hidden outline-none'
			>
				{/* Clean background — no decorative gradient */}

				{mode !== 'present' && (
					<ViewerToolbarSection
						mode={mode}
						canEdit={canEdit}
						state={state}
						selectedElement={selectedElement}
						activeSlide={activeSlide}
						zoom={zoom}
						history={history}
						findReplace={editorOps.findReplace}
						manipulation={editorOps.manipulation}
						insertHandlers={editorOps.insertHandlers}
						exportHandlers={exportHandlers}
						printHandlers={printHandlers}
						propertyHandlers={propertyHandlers}
						dialogs={dialogs}
						slideOps={editorOps.slideOps}
						ops={editorOps.ops}
						onSetMode={handleSetMode}
						onEnterPresenterView={handleEnterPresenterView}
						onEnterRehearsalMode={handleEnterRehearsalMode}
						onOpenSettings={() => setIsSettingsOpen(true)}
						onOpenShareDialog={() => setIsShareDialogOpen(true)}
					/>
				)}

				<ViewerMainContent
					mode={mode}
					canEdit={canEdit}
					slides={slides}
					activeSlide={activeSlide}
					masterPseudoSlide={masterPseudoSlide}
					activeSlideIndex={activeSlideIndex}
					canvasSize={canvasSize}
					gridSpacingPx={gridSpacingPx}
					slideSectionGroups={slideSectionGroups}
					showSlidesPane={showSlidesPane}
					showMasterPane={showMasterPane}
					selectedElement={selectedElement}
					state={state}
					editorOps={editorOps}
					dialogs={dialogs}
					presentation={presentation}
					annotations={annotations}
					propertyHandlers={propertyHandlers}
					themeHandlers={themeHandlers}
					history={history}
					comments={editorOps.comments}
					zoom={zoom}
					isMobile={isMobile}
					isTouchDevice={isTouchDevice}
					onEndPresentation={() => handleSetMode('edit')}
					leftPanelWidth={isMobile ? undefined : resizablePanels.leftWidth}
					onResizeLeft={isMobile ? undefined : resizablePanels.onResizeLeft}
					rightPanelWidth={isMobile ? undefined : resizablePanels.rightWidth}
					onResizeRight={isMobile ? undefined : resizablePanels.onResizeRight}
				/>

				{mode !== 'present' && !isVirtualKeyboardOpen && (
					<ViewerBottomPanels
						activeSlide={activeSlide}
						allSlides={slides}
						isSlideNotesCollapsed={state.isSlideNotesCollapsed}
						canEdit={canEdit}
						slideCount={slides.length}
						activeSlideIndex={activeSlideIndex}
						isDirty={state.isDirty}
						autosaveStatus={autosaveStatus}
						onToggleNotes={() => state.setIsSlideNotesCollapsed((p) => !p)}
						onUpdateNotes={propertyHandlers.handleUpdateNotes}
						collaborationSlot={collaboration ? <CollaborationStatusStrip /> : undefined}
						notesPanelHeight={isMobile ? undefined : resizablePanels.bottomHeight}
						onResizeBottom={isMobile ? undefined : resizablePanels.onResizeBottom}
						scale={zoom.scale}
						onZoomIn={zoom.handleZoomIn}
						onZoomOut={zoom.handleZoomOut}
						onZoomToFit={zoom.handleZoomToFit}
						mode={mode}
						onSetMode={handleSetMode}
						onToggleSlideSorter={() => state.setShowSlideSorter((p) => !p)}
						hideStatusBar={isMobile}
					/>
				)}

				{mode !== 'present' && isMobile && (
					<MobileChromeOverlay
						state={state}
						editorOps={editorOps}
						presentation={presentation}
						slides={slides}
						activeSlideIndex={activeSlideIndex}
						canvasSize={canvasSize}
						slideSectionGroups={slideSectionGroups}
						canEdit={canEdit}
						commentCount={activeSlide?.comments?.length ?? 0}
					/>
				)}

				<ViewerDialogGroup
					dialogs={dialogs}
					insertHandlers={editorOps.insertHandlers}
					exportHandlers={exportHandlers}
					printHandlers={printHandlers}
					propertyHandlers={propertyHandlers}
					annotations={annotations}
					slides={slides}
					activeSlideIndex={activeSlideIndex}
					canvasSize={canvasSize}
					filePath={filePath}
					coreProperties={state.coreProperties}
					customProperties={state.customProperties}
					appProperties={state.appProperties}
					embeddedFonts={state.embeddedFonts}
					hasDigitalSignatures={state.hasDigitalSignatures}
					digitalSignatureCount={state.digitalSignatureCount}
					presentationProperties={state.presentationProperties}
					customShows={state.customShows}
					selectedElements={state.selectedElements}
					isEncryptedDialogOpen={isEncryptedDialogOpen}
					setIsEncryptedDialogOpen={setIsEncryptedDialogOpen}
					showKeepAnnotationsDialog={showKeepAnnotationsDialog}
					onKeepAnnotations={handleKeepAnnotations}
					onDiscardAnnotations={handleDiscardAnnotations}
				/>

				<SettingsDialog
					isOpen={isSettingsOpen}
					onClose={() => setIsSettingsOpen(false)}
					spellCheckEnabled={state.spellCheckEnabled}
					onSetSpellCheckEnabled={state.setSpellCheckEnabled}
					showGrid={state.showGrid}
					onSetShowGrid={state.setShowGrid}
					showRulers={state.showRulers}
					onSetShowRulers={state.setShowRulers}
					snapToGrid={state.snapToGrid}
					onSetSnapToGrid={state.setSnapToGrid}
					reducedMotion={reducedMotion}
					onToggleReducedMotion={toggleReducedMotion}
				/>

				<ShareDialog
					open={isShareDialogOpen}
					onClose={() => setIsShareDialogOpen(false)}
					activeCollaboration={collaboration}
					onStartCollaboration={onStartCollaboration}
					onStopCollaboration={onStopCollaboration}
					preconfigured={Boolean(collaboration)}
					defaultRoomId={shareDefaults?.roomId}
					defaultUserName={shareDefaults?.userName}
					defaultServerUrl={shareDefaults?.serverUrl}
				/>

				<BroadcastDialog
					open={dialogs.isBroadcastDialogOpen}
					onClose={() => dialogs.setIsBroadcastDialogOpen(false)}
					onStartBroadcast={onStartCollaboration}
					onStopBroadcast={onStopCollaboration}
					onStartPresenting={() => handleSetMode('present')}
					defaultRoomId={shareDefaults?.roomId}
					defaultUserName={shareDefaults?.userName}
					defaultServerUrl={shareDefaults?.serverUrl}
				/>

				<ViewerOverlays
					isShortcutHelpOpen={state.isShortcutHelpOpen}
					isAccessibilityPanelOpen={state.isAccessibilityPanelOpen}
					showSlideSorter={state.showSlideSorter}
					accessibilityIssues={state.accessibilityIssues}
					slides={slides}
					activeSlideIndex={activeSlideIndex}
					canvasSize={canvasSize}
					canEdit={canEdit}
					sectionGroups={slideSectionGroups}
					onCloseShortcuts={() => state.setIsShortcutHelpOpen(false)}
					onCloseAccessibility={() => state.setIsAccessibilityPanelOpen(false)}
					onSelectSlide={(i) => {
						state.setActiveSlideIndex(i);
						state.setShowSlideSorter(false);
					}}
					onMoveSlide={editorOps.slideOps.handleMoveSlide}
					onDeleteSlides={editorOps.slideOps.handleDeleteSlides}
					onDuplicateSlides={editorOps.slideOps.handleDuplicateSlides}
					onToggleHideSlides={editorOps.slideOps.handleToggleHideSlides}
					onCloseSorter={() => state.setShowSlideSorter(false)}
					reducedMotion={reducedMotion}
					onToggleReducedMotion={toggleReducedMotion}
				/>

				<ViewerPresentationLayer
					mode={mode}
					slides={slides}
					canvasSize={canvasSize}
					templateElements={state.templateElements}
					presentation={presentation}
					onExitPresentation={() => handleSetMode('edit')}
				/>
			</div>
		);

		return (
			<ViewerThemeProvider theme={theme}>
				{collaboration ? (
					<CollaborationProvider
						config={collaboration}
						canvasWidth={canvasSize.width}
						canvasHeight={canvasSize.height}
					>
						<CollaborationDocumentSync slides={slides} setSlides={state.setSlides} />
						<BroadcastFollowerSync
							activeSlideIndex={activeSlideIndex}
							setActiveSlideIndex={state.setActiveSlideIndex}
							slideCount={slides.length}
						/>
						{viewerContent}
					</CollaborationProvider>
				) : (
					viewerContent
				)}
			</ViewerThemeProvider>
		);
	},
);

PowerPointViewer.displayName = 'PowerPointViewer';

/* ------------------------------------------------------------------ */
/*  Collaboration sub-components (only rendered when collab is active) */
/* ------------------------------------------------------------------ */

/**
 * Renders the `CollaborationStatusIndicator` for the status bar.
 * Must be rendered inside a `CollaborationProvider`.
 */
function CollaborationStatusStrip() {
	const collab = useCollaboration();
	if (!collab) {
		return null;
	}
	return (
		<CollaborationStatusIndicator
			status={collab.status}
			connectedCount={collab.connectedCount}
			onRetry={collab.retry}
		/>
	);
}

/**
 * Handles syncing slide state with the Yjs document when collaboration is active.
 * Must be rendered inside a `CollaborationProvider`.
 */
function CollaborationDocumentSync({
	slides,
	setSlides,
}: {
	slides: PptxSlide[];
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
}) {
	const collab = useCollaboration();
	useYjsDocumentSync({
		doc: collab?.doc ?? null,
		slides,
		setSlides,
		isConnected: collab?.status === 'connected',
	});
	return null;
}

/**
 * Auto-follows the broadcaster's active slide when the local user is a viewer.
 * Must be rendered inside a `CollaborationProvider`.
 */
function BroadcastFollowerSync({
	activeSlideIndex,
	setActiveSlideIndex,
	slideCount,
}: {
	activeSlideIndex: number;
	setActiveSlideIndex: (index: number) => void;
	slideCount: number;
}) {
	const collab = useCollaboration();
	useBroadcastFollower({
		collab,
		activeSlideIndex,
		setActiveSlideIndex,
		slideCount,
	});
	return null;
}
