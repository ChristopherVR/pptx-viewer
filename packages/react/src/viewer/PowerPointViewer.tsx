import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
/**
 * PowerPoint Viewer Plugin: Top-level Orchestrator Component.
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
import type { ViewerSettings } from 'pptx-viewer-shared';
import {
	buildUserFontFaceStyles,
	openPptxFile,
	readBackstageRecentFile,
	readStoredViewerPrefs,
	writeStoredViewerPrefs,
} from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	THEME_CATALOG,
	ViewerThemeProvider,
	resolveThemeCatalogEntry,
	useThemeStyle,
} from '../theme';
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
	FollowModeBar,
} from './components/collaboration';
import { SmartArt3DContext } from './components/elements/smart-art-3d-context';
import { HeaderFooterPanel } from './components/HeaderFooterPanel';
import { MobileChromeOverlay } from './components/mobile/MobileChromeOverlay';
import { SettingsDialog } from './components/SettingsDialog';
import { AccountAuthContext } from './components/toolbar/account-auth-context';
import { ViewerDialogGroup } from './components/ViewerDialogGroup';
import { ViewerMainContent } from './components/ViewerMainContent';
import { ViewerPresentationLayer } from './components/ViewerPresentationLayer';
import { ViewerToolbarSection } from './components/ViewerToolbarSection';
import { useYjsDocumentSync, useBroadcastFollower, useFollowMode } from './hooks/collaboration';
import type { CollaborationConfig } from './hooks/collaboration';
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
	// oxlint-disable-next-line prefer-arrow-callback -- named fn gives the forwardRef component its displayName
	function PowerPointViewer(props, ref) {
		const {
			content: incomingContent,
			fonts = [],
			filePath,
			fileName,
			canEdit = false,
			onContentChange,
			onDirtyChange,
			onActiveSlideChange,
			onModeChange,
			onZoomChange,
			onSelectionChange,
			onSlideCountChange,
			onOpenFile: hostOpenFile,
			theme,
			defaultThemeKey,
			availableThemes,
			onThemeChange,
			defaultLocale,
			availableLocales,
			onLocaleChange,
			accountAuth,
			authorName,
			collaboration,
			onStartCollaboration,
			onStopCollaboration,
			shareDefaults,
			smartArt3D = false,
			hiddenActions,
		} = props;

		useEffect(() => {
			const css = buildUserFontFaceStyles(fonts);
			if (!css) {
				return;
			}
			const style = document.createElement('style');
			style.dataset.pptxUserFonts = 'true';
			style.textContent = css;
			document.head.appendChild(style);
			return () => style.remove();
		}, [fonts]);

		// ── Theme catalog (File > Options > Appearance) ────────────────
		// `theme` always wins when the host supplies it directly (fully
		// backward compatible); otherwise the internally-managed `themeKey`
		// resolves through the catalog. Falls back to a persisted localStorage
		// choice, then the catalog's `'default'` entry (the built-in theme).
		const [themeKey, setThemeKey] = useState<string>(
			() => defaultThemeKey ?? readStoredViewerPrefs().themeKey ?? 'default',
		);
		const themeCatalog = availableThemes ?? THEME_CATALOG;
		const effectiveTheme = theme ?? resolveThemeCatalogEntry(themeKey, themeCatalog);
		const handleThemeChange = useCallback(
			(key: string) => {
				setThemeKey(key);
				if (onThemeChange) {
					onThemeChange(key);
				} else {
					writeStoredViewerPrefs({ themeKey: key });
				}
			},
			[onThemeChange],
		);

		const themeStyle = useThemeStyle(effectiveTheme);

		// ── Locale catalog (File > Options > Language) ─────────────────
		// This package never bundles an i18n instance: the host initialises
		// `react-i18next` and this component only calls `changeLanguage` on it.
		const { i18n } = useTranslation();
		const [localeCode, setLocaleCode] = useState<string>(
			() => defaultLocale ?? readStoredViewerPrefs().localeCode ?? 'en',
		);
		// A persisted non-English choice needs to actually take effect on
		// reload; only applies it ourselves when the host hasn't taken over
		// locale handling via `onLocaleChange`.
		useEffect(() => {
			if (localeCode !== 'en' && !onLocaleChange) {
				void i18n.changeLanguage(localeCode);
			}
			// Intentionally run once on mount: subsequent changes flow through
			// handleLocaleChange below, not this effect.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);
		const resolvedLocales = useMemo<LocaleCatalogEntry[]>(() => {
			if (availableLocales) {
				return availableLocales;
			}
			// Introspect what the host's i18n instance actually has dictionaries
			// for, rather than assuming every LOCALE_CATALOG entry is wired up.
			const registeredCodes = i18n.options.resources
				? Object.keys(i18n.options.resources)
				: (i18n.languages ?? ['en']);
			return registeredCodes.map(
				(code) =>
					LOCALE_CATALOG.find((entry) => entry.code === code) ?? {
						code,
						label: code,
						nativeLabel: code,
					},
			);
		}, [availableLocales, i18n]);
		const handleLocaleChange = useCallback(
			(code: string) => {
				setLocaleCode(code);
				if (onLocaleChange) {
					onLocaleChange(code);
				} else {
					void i18n.changeLanguage(code);
					writeStoredViewerPrefs({ localeCode: code });
				}
			},
			[onLocaleChange, i18n],
		);

		// Local content state -- synced from incoming prop but may diverge during editing.
		const [content, setContent] = useState<ArrayBuffer | Uint8Array | null>(incomingContent);
		// Re-sync when the parent provides a new content buffer (e.g. file reload).
		useEffect(() => {
			setContent(incomingContent);
		}, [incomingContent]);

		// File ▸ Open: let the host override (`onOpenFile` prop); otherwise fall
		// back to a built-in native picker that loads the chosen deck in place.
		const handleOpenFile = useCallback(() => {
			if (hostOpenFile) {
				hostOpenFile();
				return;
			}
			void (async () => {
				const picked = await openPptxFile();
				if (picked) {
					setContent(picked.buffer);
				}
			})();
		}, [hostOpenFile]);
		const handleOpenRecentFile = useCallback((key: string) => {
			void (async () => {
				const bytes = await readBackstageRecentFile(key);
				if (bytes) {
					setContent(bytes);
				}
			})();
		}, []);

		// ── Settings dialog ─────────────────────────────────────────
		const [isSettingsOpen, setIsSettingsOpen] = useState(false);
		const [isHeaderFooterOpen, setIsHeaderFooterOpen] = useState(false);

		// ── AutoSave toggle (title bar) ─────────────────────────────
		const [autosaveEnabled, setAutosaveEnabled] = useState(true);

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

		// ── Settings dialog (General tab) ────────────────────────────
		// A single `ViewerSettings` bag + change callback, mapped over the
		// shared `SETTING_TOGGLES` by `SettingsDialog` instead of six separate
		// prop pairs. `autoSave` reads from the same `autosaveEnabled` state
		// the title bar toggle drives, so the two stay in sync.
		const settings: ViewerSettings = useMemo(
			() => ({
				autoSave: autosaveEnabled,
				spellCheck: state.spellCheckEnabled,
				showGrid: state.showGrid,
				showRulers: state.showRulers,
				snapToGrid: state.snapToGrid,
				reducedMotion,
			}),
			[
				autosaveEnabled,
				state.spellCheckEnabled,
				state.showGrid,
				state.showRulers,
				state.snapToGrid,
				reducedMotion,
			],
		);
		const handleSettingsChange = useCallback(
			(key: keyof ViewerSettings, value: boolean) => {
				switch (key) {
					case 'autoSave':
						setAutosaveEnabled(value);
						break;
					case 'spellCheck':
						state.setSpellCheckEnabled(value);
						break;
					case 'showGrid':
						state.setShowGrid(value);
						break;
					case 'showRulers':
						state.setShowRulers(value);
						break;
					case 'snapToGrid':
						state.setSnapToGrid(value);
						break;
					case 'reducedMotion':
						if (value !== reducedMotion) {
							toggleReducedMotion();
						}
						break;
					default:
						break;
				}
			},
			[state, reducedMotion, toggleReducedMotion],
		);

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

		// ── Touch gestures: pinch-to-zoom on canvas viewport ──────
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

		// ── Reset canvas state when entering presentation mode ───────
		// A selection carried into present mode leaks its outline (and, with the
		// handle gating, would otherwise show resize/rotate handles) on top of the
		// slide. The edit viewport's zoom/scroll is also inherited, so a slide the
		// user had scrolled/zoomed during editing would open the presentation on a
		// sub-region instead of the whole slide. Reset all of it so presentations
		// start clean: unselected, fit-to-view, scrolled to the slide origin.
		useEffect(() => {
			if (mode !== 'present') {
				return;
			}
			state.setSelectedElementId(null);
			state.setSelectedElementIds([]);
			state.setInlineEditingElementId(null);
			zoom.handleZoomToFit();
			zoom.canvasViewportRef.current?.scrollTo({ left: 0, top: 0 });
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [mode]);

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
		});

		// On mobile, the slides pane is hidden by default (shown as overlay via
		// separate mobile UI). On tablet+, it follows the existing isNarrowViewport logic.
		const showSlidesPane =
			mode === 'edit' && !isMobile && !dialogs.isNarrowViewport && state.isSlidesPaneOpen;
		const showMasterPane = mode === 'master' && !isMobile && state.isSlidesPaneOpen;

		// ── JSX ───────────────────────────────────────────────────────
		const viewerContent = (
			<div
				style={themeStyle}
				data-pptx-viewer=''
				aria-busy={loading}
				className='h-full w-full bg-background text-foreground relative'
			>
				{/* Inner measured container: only layout content (toolbar, canvas,
				    bottom panels) lives here. Fixed-position dialogs/overlays are
				    rendered as siblings below to prevent their mount/unmount from
				    triggering ResizeObserver layout recalculations that can flip the
				    desktop/mobile breakpoint. */}
				<div
					ref={containerRef}
					// oxlint-disable-next-line no-noninteractive-tabindex
					tabIndex={0}
					className='h-full w-full flex flex-col overflow-hidden outline-none'
				>
					{/* Loading/error render AS CHILDREN of this measured container
					    rather than replacing the component's whole return value. A
					    content reload (restoring a version, opening a new file) flips
					    `loading` back to true after the initial mount; early-returning
					    out of the container here would unmount `containerRef` itself,
					    which permanently disconnects the ResizeObserver-driven
					    mobile/desktop breakpoint (same class of bug as the
					    CollaborationProvider case documented below). */}
					{loading ? (
						<LoadingState />
					) : error ? (
						<ErrorState error={error} />
					) : (
						<>
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
									onOpenHeaderFooter={() => setIsHeaderFooterOpen(true)}
									onOpenShareDialog={() => setIsShareDialogOpen(true)}
									onOpenFile={handleOpenFile}
									onOpenRecentFile={handleOpenRecentFile}
									fileName={fileName}
									autosaveStatus={autosaveStatus}
									autosaveEnabled={autosaveEnabled}
									onToggleAutosave={() => setAutosaveEnabled((p) => !p)}
									hiddenActions={hiddenActions}
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
								hiddenActions={hiddenActions}
							/>

							{/* Keep the bottom panels mounted while the notes panel is expanded:
				    focusing the notes textbox opens the virtual keyboard, and
				    unmounting on `isVirtualKeyboardOpen` would yank the textbox the
				    user just tapped out from under them. When notes is collapsed we
				    still hide the strip on keyboard-open to free room for canvas
				    inline editing. */}
							{mode !== 'present' && (!isVirtualKeyboardOpen || !state.isSlideNotesCollapsed) && (
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
									hiddenActions={hiddenActions}
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
						</>
					)}
				</div>

				{/* Fixed-position dialogs and overlays: rendered outside the measured
				    container so their mount/unmount cannot trigger ResizeObserver
				    callbacks that flip the desktop/mobile breakpoint. */}
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
					settings={settings}
					onSettingsChange={handleSettingsChange}
					themeKey={themeKey}
					availableThemes={themeCatalog}
					onSelectTheme={handleThemeChange}
					localeCode={localeCode}
					availableLocales={resolvedLocales}
					onSelectLocale={handleLocaleChange}
				/>

				{isHeaderFooterOpen && (
					<HeaderFooterPanel
						showDateTime={state.headerFooter.hasDateTime ?? false}
						showSlideNumber={state.headerFooter.hasSlideNumber ?? false}
						showFooter={state.headerFooter.hasFooter ?? false}
						footerText={state.headerFooter.footerText ?? ''}
						onSetShowDateTime={(hasDateTime) =>
							state.setHeaderFooter((current) => ({ ...current, hasDateTime }))
						}
						onSetShowSlideNumber={(hasSlideNumber) =>
							state.setHeaderFooter((current) => ({ ...current, hasSlideNumber }))
						}
						onSetShowFooter={(hasFooter) =>
							state.setHeaderFooter((current) => ({ ...current, hasFooter }))
						}
						onSetFooterText={(footerText) =>
							state.setHeaderFooter((current) => ({ ...current, footerText }))
						}
						onApplyToAll={() => {
							history.markDirty();
							setIsHeaderFooterOpen(false);
						}}
						onApplyToCurrent={() => {
							history.markDirty();
							setIsHeaderFooterOpen(false);
						}}
						onClose={() => setIsHeaderFooterOpen(false)}
					/>
				)}

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
					onUpdateNotes={propertyHandlers.handleUpdateNotes}
					isMobile={isMobile}
				/>
			</div>
		);

		// The CollaborationProvider is rendered UNCONDITIONALLY, wrapping the same
		// children whether or not a session is active. Gating it behind a ternary
		// changed the React tree shape the moment collaboration started, which
		// unmounted and remounted the entire editor subtree; that remount could
		// leave the ResizeObserver-driven narrow-viewport breakpoint stuck in the
		// compact mobile UI on a desktop viewport. When `collaboration` is
		// undefined the provider stays dormant (no transport, null context), so
		// its sync/follow children below are inert no-ops.
		return (
			<AccountAuthContext.Provider value={accountAuth}>
				<SmartArt3DContext.Provider value={smartArt3D}>
					<ViewerThemeProvider theme={effectiveTheme}>
						<CollaborationProvider
							config={collaboration}
							canvasWidth={canvasSize.width}
							canvasHeight={canvasSize.height}
						>
							<CollaborationDocumentSync
								slides={slides}
								templateElementsBySlideId={templateElementsBySlideId}
								setSlides={state.setSlides}
								config={collaboration}
								content={content}
							/>
							<CollaborationFollowLayer
								activeSlideIndex={activeSlideIndex}
								setActiveSlideIndex={state.setActiveSlideIndex}
								slideCount={slides.length}
							/>
							{viewerContent}
						</CollaborationProvider>
					</ViewerThemeProvider>
				</SmartArt3DContext.Provider>
			</AccountAuthContext.Provider>
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
	templateElementsBySlideId,
	setSlides,
	config,
	content,
}: {
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	config?: CollaborationConfig;
	content: ArrayBuffer | Uint8Array | null;
}) {
	const collab = useCollaboration();
	// Retain the loaded source bytes so the elected writer (role 'owner') can
	// re-serialize a durable PPTX snapshot for `onWriteBack`. A ref keeps the
	// latest buffer without re-subscribing the sync effect on every edit.
	const contentRef = useRef(content);
	contentRef.current = content;
	const getSourceBytes = useCallback((): Uint8Array | null => {
		const bytes = contentRef.current;
		if (!bytes) {
			return null;
		}
		return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	}, []);

	useYjsDocumentSync({
		doc: collab?.doc ?? null,
		slides,
		templateElementsBySlideId,
		setSlides,
		isConnected: collab?.status === 'connected',
		isSynced: collab?.synced ?? true,
		config,
		getSourceBytes,
	});
	return null;
}

/**
 * Follow-mode layer: renders the manual {@link FollowModeBar} (click a peer to
 * mirror their active slide) and keeps the one-way broadcast auto-follow alive.
 * Manual follow takes precedence: while the local user is following a peer, the
 * broadcaster auto-follow stands down so the two do not fight over navigation.
 * Must be rendered inside a `CollaborationProvider`.
 */
function CollaborationFollowLayer({
	activeSlideIndex,
	setActiveSlideIndex,
	slideCount,
}: {
	activeSlideIndex: number;
	setActiveSlideIndex: (index: number) => void;
	slideCount: number;
}) {
	const collab = useCollaboration();
	const { followedClientId, followUser } = useFollowMode({
		collab,
		activeSlideIndex,
		setActiveSlideIndex,
		slideCount,
	});
	useBroadcastFollower({
		collab,
		activeSlideIndex,
		setActiveSlideIndex,
		slideCount,
		paused: followedClientId !== null,
	});

	if (!collab) {
		return null;
	}
	return (
		<div className='pointer-events-none fixed inset-x-0 top-2 z-[1100] flex justify-center px-2'>
			<div className='pointer-events-auto'>
				<FollowModeBar
					presences={collab.remoteUsers}
					followedClientId={followedClientId}
					onFollow={followUser}
				/>
			</div>
		</div>
	);
}
