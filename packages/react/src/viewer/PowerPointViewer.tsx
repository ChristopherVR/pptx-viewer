import type { PptxElement, PptxSaveFormat, PptxSlide, PptxTheme } from 'pptx-viewer-core';
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
import type {
	CollabLoadOrigin,
	CollaborationLivePatcher,
	ViewerAddinStatus,
	ViewerSettings,
} from 'pptx-viewer-shared';
import {
	applyAutoCorrect,
	applyPreferenceToOptions,
	buildUserFontFaceStyles,
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	openPptxFile,
	playFeedbackSound,
	readBackstageRecentFile,
	readStoredViewerPrefs,
	resolve3DRenderingFlags,
	resolveAutosaveActivation,
	resolveAutosaveIntervalMs,
	resolveExpiredAutosaveSnapshots,
	resolveHistoryDepth,
	resolveImageResolutionScale,
	resolveOptionRootClasses,
	shouldClearAutosaveCacheOnClose,
	shouldDiscardAutosaveOnSuccessfulSave,
	shouldShowAutosaveRecoveryPrompt,
	resolveAutosaveIntervalSeconds,
	viewerOptionsToPreferences,
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
import { AutosaveRecoveryDialog } from './components/AutosaveRecoveryDialog';
import {
	CollaborationProvider,
	useCollaboration,
	CollaborationStatusIndicator,
	FollowModeBar,
} from './components/collaboration';
import { CompatibilityToasts } from './components/CompatibilityToasts';
import { AreaChart3DContext } from './components/elements/area-chart-3d-context';
import { BarChart3DContext } from './components/elements/bar-chart-3d-context';
import { LineChart3DContext } from './components/elements/line-chart-3d-context';
import { PieChart3DContext } from './components/elements/pie-chart-3d-context';
import { SmartArt3DContext } from './components/elements/smart-art-3d-context';
import { SurfaceChart3DContext } from './components/elements/surface-chart-3d-context';
import { HeaderFooterPanel } from './components/HeaderFooterPanel';
import { MobileChromeOverlay } from './components/mobile/MobileChromeOverlay';
import { ReadOnlyBanner } from './components/ReadOnlyBanner';
import { SettingsDialog } from './components/SettingsDialog';
import { AccountAuthContext } from './components/toolbar/account-auth-context';
import { ViewerOptionsContext } from './components/viewer-options-context';
import { ViewerDialogGroup } from './components/ViewerDialogGroup';
import { ViewerMainContent } from './components/ViewerMainContent';
import { ViewerPresentationLayer } from './components/ViewerPresentationLayer';
import { ViewerToolbarSection } from './components/ViewerToolbarSection';
import { useAiBridge } from './hooks/ai/useAiBridge';
import { useAiPanelController } from './hooks/ai/useAiPanelController';
import {
	useYjsDocumentSync,
	useCollaborationLivePatch,
	useBroadcastFollower,
	useFollowMode,
} from './hooks/collaboration';
import type { CollaborationConfig } from './hooks/collaboration';
import { useCompatibilityToastsState } from './hooks/useCompatibilityToastsState';
import { useDerivedSlideState } from './hooks/useDerivedSlideState';
import { useEditorHistory } from './hooks/useEditorHistory';
import { useEditorOperations } from './hooks/useEditorOperations';
import { useIsMobile } from './hooks/useIsMobile';
import { useLayoutSwitching } from './hooks/useLayoutSwitching';
import { useMasterViewCrud } from './hooks/useMasterViewCrud';
import { usePresentationSetup } from './hooks/usePresentationSetup';
import { useReadOnlyRecommendationState } from './hooks/useReadOnlyRecommendationState';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useResizablePanels } from './hooks/useResizablePanels';
import { useTouchGestures } from './hooks/useTouchGestures';
import { useViewerDialogs } from './hooks/useViewerDialogs';
import { useViewerIntegration } from './hooks/useViewerIntegration';
import { useViewerOptions } from './hooks/useViewerOptions';
// Hooks
import { useViewerState } from './hooks/useViewerState';
import { useViewPreferencesSync } from './hooks/useViewPreferencesSync';
import { useZoomViewport } from './hooks/useZoomViewport';
import type { PowerPointViewerProps, PowerPointViewerHandle } from './types';
import { cn } from './utils';

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
			canEdit: hostCanEdit = false,
			autosave: hostAutosave,
			autosaveIntervalMs: hostAutosaveIntervalMs,
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
			surfaceChart3D = false,
			barChart3D = false,
			lineChart3D = false,
			areaChart3D = false,
			pieChart3D = false,
			hiddenActions,
			ai,
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

		// ── Custom fonts (File > Options > Fonts) ──────────────────────
		// Families the user registered from a local font file this session.
		// Held here rather than in a module-level global so several viewers on
		// one page keep their own lists, and so nothing survives a reload: the
		// font binary is the user's, not ours to persist.
		const [customFontFamilies, setCustomFontFamilies] = useState<string[]>([]);
		const handleCustomFontRegistered = useCallback((family: string) => {
			setCustomFontFamilies((current) =>
				current.includes(family) ? current : [...current, family],
			);
		}, []);

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
		/**
		 * Who chose the deck now loading. A collaboration room may replace the
		 * host's own deck (a late joiner whose bootstrap parse lands after the
		 * room's slides) but never a file the user opened during the session,
		 * which used to vanish the moment it finished parsing.
		 */
		const [loadOrigin, setLoadOrigin] = useState<CollabLoadOrigin>('bootstrap');
		// Re-sync when the parent provides a new content buffer (e.g. file reload).
		useEffect(() => {
			setContent(incomingContent);
			setLoadOrigin('bootstrap');
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
					setLoadOrigin('user');
					setContent(picked.buffer);
				}
			})();
		}, [hostOpenFile]);
		const handleOpenRecentFile = useCallback((key: string) => {
			void (async () => {
				const bytes = await readBackstageRecentFile(key);
				if (bytes) {
					setLoadOrigin('user');
					setContent(bytes);
				}
			})();
		}, []);

		// ── File > Options store ─────────────────────────────────────
		// Declared here (rather than alongside the legacy ViewerSettings sync
		// further down) because Protected View, just below, has to gate
		// `canEdit` before `useViewerState` and the autosave activation read it.
		const { optionsStore, options: viewerOptions } = useViewerOptions();

		// ── Protected View (Trust Center) ───────────────────────────
		// Options > Trust Center > "Open presentations in Protected View" forces
		// every newly opened document read-only, mirroring PowerPoint's yellow
		// protected-view bar. `canEdit` below becomes the effective value: the
		// host's own `canEdit` prop, additionally gated by this. A per-session
		// "Enable Editing" action (the toolbar's read-only badge, wired through
		// `ViewerToolbarSection`) can drop the override without touching the
		// option itself; the next document loaded (or a manual re-check of the
		// option) puts the deck back in protected view.
		const [protectedViewOverridden, setProtectedViewOverridden] = useState(false);
		useEffect(() => {
			setProtectedViewOverridden(false);
		}, [content]);
		const isProtectedView = viewerOptions.trust.openInProtectedView && !protectedViewOverridden;
		const handleEnableEditing = useCallback(() => {
			setProtectedViewOverridden(true);
		}, []);

		// ── Read-only recommendation banner (p:modifyVerifier / "Mark as Final") ──
		// Seeded on every load via `setReadOnlyRecommendation` (threaded through
		// useViewerIntegration -> useContentLifecycle -> useLoadContent, alongside
		// every other per-load setter). "Edit anyway" lifts `canEdit`'s lock,
		// exactly like the Protected View override above; "Dismiss" only hides
		// the banner.
		const readOnlyRec = useReadOnlyRecommendationState(content);

		// ── Compatibility-warning toasts ────────────────────────────
		const compatToastsState = useCompatibilityToastsState();

		const canEdit = hostCanEdit && !isProtectedView && !readOnlyRec.locked;

		// ── Settings dialog ─────────────────────────────────────────
		const [isSettingsOpen, setIsSettingsOpen] = useState(false);
		const [isHeaderFooterOpen, setIsHeaderFooterOpen] = useState(false);

		// ── AutoSave toggle (title bar) ─────────────────────────────
		// The user PREFERENCE. What actually runs is `autosaveActivation` below,
		// which folds in the host's `autosave` prop (a ceiling the preference
		// cannot exceed), the file path, and edit permission.
		const [autosaveEnabled, setAutosaveEnabled] = useState(true);
		const autosaveActivation = resolveAutosaveActivation({
			hostAutosave,
			userEnabled: autosaveEnabled,
			canEdit,
			filePath,
		});

		// ── Share dialog ────────────────────────────────────────────
		const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

		// ── AI assistant panel state lives in useAiPanelController (below,
		//    once selection state is available). ─────────────────────

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

		// ── Legacy ViewerSettings sync ────────────────────────────────
		// `optionsStore`/`viewerOptions` are declared earlier (Protected View
		// needs them before this point). The six legacy `ViewerSettings`
		// toggles stay the source of behavior, kept in sync with the store
		// both ways below.
		const settingsRef = useRef(settings);
		settingsRef.current = settings;
		// `handleSettingsChange` depends on `state`, which is a fresh object on
		// every render, so it can never be a dependency of the options -> legacy
		// effect: that effect would then run on EVERY render and push the store's
		// (not yet updated) values back over a toggle the user just flipped. The
		// title-bar AutoSave switch was unusable for exactly that reason - it
		// flipped to off and was reset to on in the same commit (issue #131).
		const handleSettingsChangeRef = useRef(handleSettingsChange);
		handleSettingsChangeRef.current = handleSettingsChange;
		const syncingFromOptionsRef = useRef(false);
		useEffect(() => {
			// Options -> scattered legacy state (dialog edits, persisted values).
			const mapped = viewerOptionsToPreferences(viewerOptions);
			let changed = false;
			for (const key of Object.keys(mapped) as (keyof ViewerSettings)[]) {
				if (mapped[key] !== settingsRef.current[key]) {
					changed = true;
					handleSettingsChangeRef.current(key, mapped[key]);
				}
			}
			if (changed) {
				syncingFromOptionsRef.current = true;
			}
		}, [viewerOptions]);
		useEffect(() => {
			// Legacy state -> options (ribbon View toggles, title-bar autosave).
			const current = optionsStore.getOptions();
			const mapped = viewerOptionsToPreferences(current);
			const keys = Object.keys(mapped) as (keyof ViewerSettings)[];
			if (syncingFromOptionsRef.current) {
				if (keys.every((key) => mapped[key] === settings[key])) {
					syncingFromOptionsRef.current = false;
				}
				return;
			}
			let next = current;
			for (const key of keys) {
				if (mapped[key] !== settings[key]) {
					next = applyPreferenceToOptions(next, key, settings[key]);
				}
			}
			if (next !== current) {
				optionsStore.setOptions(next);
			}
		}, [settings, optionsStore]);
		const handleClearOptionsCache = useCallback(() => {
			void (async () => {
				const snapshots = await listAutosaveSnapshots();
				await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
			})();
		}, []);

		// File > Options > Save > "cache retention": a one-time sweep per mount is
		// enough, since a fresh snapshot only ever lands with a fresh timestamp.
		useEffect(() => {
			void (async () => {
				try {
					const snapshots = await listAutosaveSnapshots();
					const expired = resolveExpiredAutosaveSnapshots(snapshots, viewerOptions);
					await Promise.all(expired.map((key) => deleteAutosaveSnapshot(key)));
				} catch {
					// Best-effort background maintenance; a blocked IndexedDB skips it.
				}
			})();
			// eslint-disable-next-line react-hooks/exhaustive-deps -- one sweep per mount, not per option edit
		}, []);

		// File > Options > Save > "clear cache on close": wipe recovery snapshots
		// when the tab closes/navigates away, and when this viewer unmounts.
		useEffect(() => {
			const clearIfRequested = (): void => {
				if (shouldClearAutosaveCacheOnClose(viewerOptions)) {
					handleClearOptionsCache();
				}
			};
			window.addEventListener('beforeunload', clearIfRequested);
			return () => {
				window.removeEventListener('beforeunload', clearIfRequested);
				clearIfRequested();
			};
		}, [viewerOptions, handleClearOptionsCache]);

		// ── Mobile / responsive ─────────────────────────────────────
		const mobile = useIsMobile();
		const { isMobile, isTouchDevice, isVirtualKeyboardOpen } = mobile;

		// ── Resizable panels ──────────────────────────────────────
		const resizablePanels = useResizablePanels();

		// ── Derived computed values ───────────────────────────────────
		const {
			gridSpacingPx,
			visibleSlideIndexes,
			slideSectionGroups,
			masterPseudoSlide,
			authoredRange,
		} = useDerivedSlideState({
			slides,
			sections: state.sections,
			customShows: state.customShows,
			activeCustomShowId: state.activeCustomShowId,
			presentationProperties: state.presentationProperties,
			mode,
			activeLayout: state.activeLayout,
			activeMaster: state.activeMaster,
			documentGridSpacing: state.viewProperties?.gridSpacing,
		});

		// The show that is actually playing, resolved once so presenter view's
		// next-slide preview follows the same order as the forward key.
		const activeCustomShow =
			state.customShows.find((show) => show.id === state.activeCustomShowId) ?? null;

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

		// Every local edit commit funnels through the history hook, so this is the
		// one place that has to raise the dirty flag. It feeds the status bar, the
		// host's `onDirtyChange` and `useAutosave` (which does nothing at all
		// while the document reads clean).
		const { setIsDirty } = state;
		const markDocumentDirty = useCallback(() => {
			setIsDirty(true);
		}, [setIsDirty]);

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
			// File > Options > Advanced > "Maximum number of undos", re-read every
			// render so a mid-session change reaches the undo stack.
			maxHistoryEntries: resolveHistoryDepth(viewerOptions),
			hasActivePointerInteraction,
			pointerCommitNonce: state.pointerCommitNonce,
			onDirty: markDocumentDirty,
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
		const { presentation, annotations, actionSoundHandlerRef, setExitModeHandler } =
			usePresentationSetup({
				mode,
				slides,
				visibleSlideIndexes,
				// File > Options > Advanced > "End with black slide". Off means the show
				// exits straight to the editor instead of raising the black end screen.
				endWithBlackSlide: viewerOptions.advanced.slideShowEndWithBlackSlide,
				// File > Options > Advanced > "Prompt to keep ink annotations when
				// exiting". Off skips the keep/discard dialog entirely.
				promptKeepInkAnnotations: viewerOptions.advanced.slideShowPromptKeepInkAnnotations,
				// File > Options > Advanced > "Show popup toolbar" while presenting.
				popupToolbarEnabled: viewerOptions.advanced.slideShowShowPopupToolbar,
				activeSlideIndex,
				containerRef,
				content,
				mediaDataUrls: state.mediaDataUrls,
				presentationProperties: state.presentationProperties,
				setMode: state.setMode,
				setActiveSlideIndex: state.setActiveSlideIndex,
				setSlides: state.setSlides,
				history,
				// PowerPoint's bare `J` during a show toggles live captions. It resolves
				// in the shared slide-show keymap; this is the state it has to reach.
				onToggleSubtitles: () =>
					state.setPresentationProperties((prev) => ({
						...prev,
						showSubtitles: !prev.showSubtitles,
					})),
				customShows: state.customShows,
				activeCustomShowId: state.activeCustomShowId,
				onSetActiveCustomShowId: state.setActiveCustomShowId,
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
			embeddedFontFamilies: state.embeddedFonts.map((font) => font.name),
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
			// Comment/reply authorship: an explicit host `authorName` or an active
			// collaboration session's identity wins; otherwise fall back to the
			// user's own Options > General > "User name" before the generic "You".
			userName:
				authorName ?? collaboration?.userName ?? (viewerOptions.general.userName || undefined),
			handlerRef: actionSoundHandlerRef,
			// Options > Proofing > AutoCorrect, applied to committed inline-edit text.
			transformCommittedText: (text) => applyAutoCorrect(text, viewerOptions.proofing),
		});

		// ── Integration (pointers, lifecycle, I/O, annotations, etc.) ─
		const {
			exportHandlers: rawExportHandlers,
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
			recovery,
			isEncryptedDialogOpen,
			setIsEncryptedDialogOpen,
			handlerRef,
			loadVersion,
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
			autosaveEnabled: autosaveActivation.active,
			autosaveAllowed: hostAutosave !== false,
			// Host prop first (an explicit policy), else File > Options > Save >
			// "Save AutoRecover information every N minutes", else the shared 120s.
			autosaveIntervalMs: resolveAutosaveIntervalMs({
				hostIntervalMs: hostAutosaveIntervalMs,
				optionsIntervalSeconds: resolveAutosaveIntervalSeconds(viewerOptions),
			}),
			// Trust Center > "Allow external content": core defaults this to false
			// (SSRF/privacy-safe), so only an explicit `true` here lets remote
			// http(s) image sources actually load.
			allowExternalImages: viewerOptions.trust.allowExternalContent,
			setReadOnlyRecommendation: readOnlyRec.setRecommendation,
			setCompatToasts: compatToastsState.setToasts,
			canEdit,
			promptKeepInkAnnotations: viewerOptions.advanced.slideShowPromptKeepInkAnnotations,
			// File > Options > Advanced > "Image Size and Quality" (do-not-compress /
			// default resolution), resolved to a raster-scale multiplier for
			// PNG/PDF export and copy-slide-as-image. Multiplied against the
			// pre-existing 2x baseline (not used outright) so the default "High
			// fidelity" preset (raw multiplier 1) keeps today's export quality
			// instead of silently downgrading it; the explicit ppi presets still
			// scale proportionally from that baseline. Mirrors the other bindings.
			imageExportScale: 2 * resolveImageResolutionScale(viewerOptions),
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

		// ── Deck view preferences (grid/snap/guides) load-seed + write-back ──
		// Seeds `state.snapToGrid`/`snapToShape`/`showGuides` from the deck's own
		// `ppt/viewProps.xml` once per completed load (`loadVersion`), and writes
		// a View-ribbon toggle back into `state.viewProperties` so a save
		// round-trips it (see `useSerialize`'s `viewProperties` save option).
		const viewPreferencesSync = useViewPreferencesSync({
			loadVersion,
			viewProperties: state.viewProperties,
			setViewProperties: state.setViewProperties,
			snapToGrid: state.snapToGrid,
			setSnapToGrid: state.setSnapToGrid,
			snapToShape: state.snapToShape,
			setSnapToShape: state.setSnapToShape,
			showGuides: state.showGuides,
			setShowGuides: state.setShowGuides,
		});

		// Options > Accessibility > "feedback with sound", and Options > Save >
		// "keep the last AutoRecover version": once a `.pptx` Save/Save-As
		// actually lands, play the completion cue and, unless the user asked to
		// keep it, discard the crash-recovery snapshot for this file (the real
		// file on disk already has the work).
		const exportHandlers = useMemo(() => {
			const afterSuccessfulSave = (format: PptxSaveFormat): void => {
				playFeedbackSound(viewerOptions);
				if (format === 'pptx' && filePath && shouldDiscardAutosaveOnSuccessfulSave(viewerOptions)) {
					void deleteAutosaveSnapshot(filePath);
				}
			};
			const handleSaveAsFormat = async (format: PptxSaveFormat): Promise<void> => {
				await rawExportHandlers.handleSaveAsFormat(format);
				afterSuccessfulSave(format);
			};
			return {
				...rawExportHandlers,
				handleSaveAsFormat,
				handleSaveAsPptx: () => void handleSaveAsFormat('pptx'),
				handleSaveAsPpsx: () => void handleSaveAsFormat('ppsx'),
				handleSaveAsPptm: () => void handleSaveAsFormat('pptm'),
			};
		}, [rawExportHandlers, viewerOptions, filePath]);

		// Route keyboard/end-of-show exits (Escape, the timed advance past the
		// last slide) through the same keep/discard-ink-annotations dialog as the
		// toolbar's exit button, rather than the two paths silently diverging.
		setExitModeHandler(handleSetMode);

		// ── Layout switching (Home > Layout) ────────────────────────
		// Backs the Layout dropdown's entries, which re-map the active slide onto
		// another of its master's layouts.
		const handleTemplateElementsChanged = useCallback(
			(slideId: string, elements: PptxElement[]) => {
				state.setTemplateElementsBySlideId((prev) => ({ ...prev, [slideId]: elements }));
			},
			[state],
		);
		const layoutSwitching = useLayoutSwitching({
			handler: handlerRef.current,
			slides,
			activeSlideIndex,
			ops: editorOps.ops,
			history,
			onTemplateElementsChanged: handleTemplateElementsChanged,
		});

		// ── Slide Master view sidebar CRUD ────────────────────────────
		const masterViewCrud = useMasterViewCrud({
			handlerRef,
			slides,
			slideMasters: state.slideMasters,
			target: {
				tab: state.masterViewTab,
				masterIndex: state.activeMasterIndex,
				layoutIndex: state.activeLayoutIndex,
			},
			setSlides: state.setSlides,
			setSlideMasters: state.setSlideMasters,
			setActiveMasterIndex: state.setActiveMasterIndex,
			setActiveLayoutIndex: state.setActiveLayoutIndex,
			markDirty: history.markDirty,
			pushToast: (toast) => compatToastsState.setToasts((prev) => [...prev, toast]),
		});

		// ── AI assistant bridge ─────────────────────────────────────
		// Built unconditionally (cheap, type-only SDK deps) but only consumed
		// when the host passes the `ai` prop. Its three write choke points route
		// through the editor-history layer so AI edits are a single Ctrl+Z.
		const applyAiTheme = useCallback(
			(updates: Partial<PptxTheme>) => {
				if (updates.colorScheme) {
					void themeHandlers.handleUpdateThemeColorScheme(updates.colorScheme);
				}
				if (updates.fontScheme) {
					void themeHandlers.handleUpdateThemeFontScheme(updates.fontScheme);
				}
			},
			[themeHandlers],
		);
		const bumpAiHistory = useCallback(() => {
			state.setPointerCommitNonce((n) => n + 1);
		}, [state]);
		const aiPanel = useAiPanelController({
			activeSlideIndex,
			selectedElementId,
			selectedElementIds,
			selectedElement,
		});
		const aiBridge = useAiBridge({
			slides,
			activeSlideIndex,
			canvasSize,
			theme: state.theme,
			fileName,
			selectedElementId,
			selectedElementIds,
			pinnedFocus: aiPanel.pinnedFocus,
			pickedFocus: aiPanel.pickTargets.length > 0 ? aiPanel.pickTargets : null,
			handlerRef,
			sections: state.sections,
			presentationProperties: state.presentationProperties,
			customProperties: state.customProperties,
			coreProperties: state.coreProperties,
			appProperties: state.appProperties,
			setCanvasSize: state.setCanvasSize,
			setSections: state.setSections,
			setPresentationProperties: state.setPresentationProperties,
			setCustomProperties: state.setCustomProperties,
			setCoreProperties: state.setCoreProperties,
			setAppProperties: state.setAppProperties,
			setSlides: state.setSlides,
			setActiveSlideIndex: state.setActiveSlideIndex,
			applySelection: editorOps.ops.applySelection,
			bumpHistory: bumpAiHistory,
			markDirty: history.markDirty,
			applyThemeUpdates: applyAiTheme,
		});

		// On mobile, the slides pane is hidden by default (shown as overlay via
		// separate mobile UI). On tablet+, it follows the existing isNarrowViewport logic.
		const showSlidesPane =
			mode === 'edit' && !isMobile && !dialogs.isNarrowViewport && state.isSlidesPaneOpen;
		const showMasterPane = mode === 'master' && !isMobile && state.isSlidesPaneOpen;

		// ── Add-ins status (File > Options > Add-ins) ────────────────
		// Real availability signals rather than the shared catalog's `active:
		// true` fallback for everything: SmartArt 3D reflects the same
		// host-opt-in + Advanced > "Disable 3D rendering" gate the SmartArt3D
		// scene itself reads, collaboration reflects whether the host actually
		// configured a room for this session, and locales reflects whether more
		// than the built-in English pack is registered. The EMF/MTX converters
		// and the 3D model renderer have no runtime on/off signal to read (they
		// are always-on infrastructure), so they keep the catalog default.
		const addinStatus: ViewerAddinStatus = {
			smartArt3d: smartArt3D && !viewerOptions.advanced.disable3DRendering,
			collaboration: Boolean(collaboration),
			locales: resolvedLocales.length > 1,
		};

		// ── JSX ───────────────────────────────────────────────────────
		const viewerContent = (
			<div
				style={themeStyle}
				data-pptx-viewer=''
				aria-busy={loading}
				className={cn(
					'h-full w-full bg-background text-foreground relative',
					...resolveOptionRootClasses(viewerOptions, 'pptx'),
				)}
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
									activeSlideIndex={activeSlideIndex}
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
									sectionOps={editorOps.sectionOps}
									onApplyLayout={(path) => void layoutSwitching.applyLayout(path)}
									loadLayoutPreviews={layoutSwitching.loadLayoutPreviews}
									customFontFamilies={customFontFamilies}
									ops={editorOps.ops}
									onSetMode={handleSetMode}
									onPresentFromBeginning={presentation.enterPresentModeFromBeginning}
									onEnterPresenterView={handleEnterPresenterView}
									onEnterRehearsalMode={handleEnterRehearsalMode}
									onOpenSettings={() => setIsSettingsOpen(true)}
									onOpenHeaderFooter={() => setIsHeaderFooterOpen(true)}
									onOpenShareDialog={() => setIsShareDialogOpen(true)}
									onOpenFile={handleOpenFile}
									onOpenRecentFile={handleOpenRecentFile}
									fileName={fileName}
									autosaveStatus={autosaveStatus}
									autosaveEnabled={autosaveActivation.active}
									onToggleAutosave={() => {
										// Inert when the host passed `autosave={false}`: a preference
										// cannot exceed the policy, so the switch must not move.
										if (autosaveActivation.toggleAvailable) {
											setAutosaveEnabled((p) => !p);
										}
									}}
									hiddenActions={hiddenActions}
									recentPresentationsCount={viewerOptions.advanced.recentPresentationsCount}
									aiEnabled={Boolean(ai)}
									isAiPanelOpen={aiPanel.isOpen}
									onToggleAiPanel={aiPanel.toggle}
									isProtectedView={isProtectedView}
									onEnableEditing={hostCanEdit ? handleEnableEditing : undefined}
									onSetSnapToGrid={viewPreferencesSync.handleSetSnapToGrid}
									onSetSnapToShape={viewPreferencesSync.handleSetSnapToShape}
									onSetShowGuides={viewPreferencesSync.handleSetShowGuides}
								/>
							)}

							{mode !== 'present' && readOnlyRec.bannerVisible && (
								<ReadOnlyBanner
									recommendation={readOnlyRec.recommendation}
									onEditAnyway={readOnlyRec.editAnyway}
									onDismiss={readOnlyRec.dismiss}
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
								masterViewCrud={masterViewCrud}
								zoom={zoom}
								isMobile={isMobile}
								isTouchDevice={isTouchDevice}
								onEndPresentation={() => handleSetMode('edit')}
								leftPanelWidth={isMobile ? undefined : resizablePanels.leftWidth}
								onResizeLeft={isMobile ? undefined : resizablePanels.onResizeLeft}
								rightPanelWidth={isMobile ? undefined : resizablePanels.rightWidth}
								onResizeRight={isMobile ? undefined : resizablePanels.onResizeRight}
								hiddenActions={hiddenActions}
								aiConfig={ai}
								aiBridge={ai ? aiBridge : undefined}
								aiPanel={ai ? aiPanel : undefined}
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
									notesStyle={state.notesMaster?.notesStyle}
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

				{/* Positioned against the OUTER viewer-root div (same containing
				    block the dialogs below use), not the measured container above:
				    that container's own bottom edge sits behind the status bar, so a
				    toast anchored to IT covered the "Slide show" button. */}
				{mode !== 'present' && (
					<CompatibilityToasts
						toasts={compatToastsState.toasts}
						onDismiss={compatToastsState.dismiss}
						onDismissAll={compatToastsState.dismissAll}
					/>
				)}

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

				{/* A running show has no editor chrome, and this prompt is modal: left
				    mounted it puts a full-area backdrop over the stage that swallows
				    action-button clicks. The offer is deferred, not dropped. */}
				<AutosaveRecoveryDialog
					prompt={
						shouldShowAutosaveRecoveryPrompt({
							prompt: recovery.prompt,
							presenting: mode === 'present',
						})
							? recovery.prompt
							: null
					}
					onRestore={recovery.restore}
					onDiscard={recovery.discard}
				/>

				<SettingsDialog
					isOpen={isSettingsOpen}
					onClose={() => setIsSettingsOpen(false)}
					options={viewerOptions}
					onOptionChange={(group, key, value) => optionsStore.setValue(group, key, value)}
					onRestoreOptions={(snapshot) => optionsStore.setOptions(snapshot)}
					onRibbonTabHiddenChange={(tabId, hidden) =>
						optionsStore.setRibbonTabHidden(tabId, hidden)
					}
					onQuickAccessCommandsChange={(commandIds) =>
						optionsStore.setQuickAccessCommands(commandIds)
					}
					onResetOptions={(group) => optionsStore.reset(group)}
					onClearCache={handleClearOptionsCache}
					addinStatus={addinStatus}
					themeKey={themeKey}
					availableThemes={themeCatalog}
					onSelectTheme={handleThemeChange}
					localeCode={localeCode}
					availableLocales={resolvedLocales}
					onSelectLocale={handleLocaleChange}
					aiEnabled={Boolean(ai)}
					customFontFamilies={customFontFamilies}
					onCustomFontRegistered={handleCustomFontRegistered}
				/>

				{isHeaderFooterOpen && (
					<HeaderFooterPanel
						headerFooter={state.headerFooter}
						onUpdate={(patch) => state.setHeaderFooter((current) => ({ ...current, ...patch }))}
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
					showReadingView={state.showReadingView}
					showOutlineView={state.showOutlineView}
					templateElements={state.templateElements}
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
					onCloseReadingView={(slideIndex) => {
						// Leaving a view returns the editor to the slide that was on
						// screen, exactly as leaving PowerPoint's Reading View does.
						state.setShowReadingView(false);
						state.setActiveSlideIndex(slideIndex);
					}}
					onCloseOutlineView={() => state.setShowOutlineView(false)}
					setSlides={state.setSlides}
					setActiveSlideIndex={state.setActiveSlideIndex}
					bumpHistory={() => state.setPointerCommitNonce((n) => n + 1)}
					reducedMotion={reducedMotion}
					onToggleReducedMotion={toggleReducedMotion}
				/>

				<ViewerPresentationLayer
					mode={mode}
					slides={slides}
					canvasSize={canvasSize}
					templateElements={state.templateElements}
					presentation={presentation}
					activeCustomShow={activeCustomShow}
					authoredRange={authoredRange}
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
		//
		// Each 3D flag ANDs the host's own opt-in prop with the viewer user's
		// Options > Advanced > "Disable 3D rendering" override, so a user on
		// underpowered hardware can fall back to flat 2D even in a deck the host
		// enabled 3D for. See `resolve3DRenderingFlags`.
		const effective3D = resolve3DRenderingFlags(
			{ smartArt3D, surfaceChart3D, barChart3D, lineChart3D, areaChart3D, pieChart3D },
			viewerOptions,
		);
		return (
			// `ViewerOptionsContext` is how every deeply-nested chrome piece (the
			// toolbar, title bar, Quick Access strip, print dialog, canvas
			// hyperlink gate, share dialog) reads the live File > Options
			// snapshot without threading it through each intermediate prop list.
			// Nothing previously provided it, so every one of those consumers was
			// silently reading `DEFAULT_VIEWER_OPTIONS` forever, no matter what
			// the user changed in the Options dialog.
			<ViewerOptionsContext.Provider value={viewerOptions}>
				<AccountAuthContext.Provider value={accountAuth}>
					<SmartArt3DContext.Provider value={effective3D.smartArt3D}>
						<SurfaceChart3DContext.Provider value={effective3D.surfaceChart3D}>
							<BarChart3DContext.Provider value={effective3D.barChart3D}>
								<LineChart3DContext.Provider value={effective3D.lineChart3D}>
									<AreaChart3DContext.Provider value={effective3D.areaChart3D}>
										<PieChart3DContext.Provider value={effective3D.pieChart3D}>
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
														loadVersion={loadVersion}
														loadOrigin={loadOrigin}
														livePatcher={state.livePatcher}
													/>
													<CollaborationFollowLayer
														activeSlideIndex={activeSlideIndex}
														setActiveSlideIndex={state.setActiveSlideIndex}
														slideCount={slides.length}
													/>
													{viewerContent}
												</CollaborationProvider>
											</ViewerThemeProvider>
										</PieChart3DContext.Provider>
									</AreaChart3DContext.Provider>
								</LineChart3DContext.Provider>
							</BarChart3DContext.Provider>
						</SurfaceChart3DContext.Provider>
					</SmartArt3DContext.Provider>
				</AccountAuthContext.Provider>
			</ViewerOptionsContext.Provider>
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
	loadVersion,
	loadOrigin,
	livePatcher,
}: {
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	config?: CollaborationConfig;
	content: ArrayBuffer | Uint8Array | null;
	loadVersion: number;
	loadOrigin: CollabLoadOrigin;
	livePatcher: CollaborationLivePatcher;
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
		loadVersion,
		loadOrigin,
	});
	// Interim (mid-gesture / mid-typing) writes bypass the slides state, so the
	// channel needs the doc directly. Dormant unless connected + synced.
	useCollaborationLivePatch({
		patcher: livePatcher,
		doc: collab?.doc ?? null,
		isConnected: collab?.status === 'connected',
		isSynced: collab?.synced ?? true,
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
