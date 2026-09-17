import { openPptxFile, readBackstageRecentFile } from 'pptx-viewer-shared';
import type {
	CollabLoadOrigin,
	CollaborationConfig,
	ToolbarActionId,
	ViewportFitOptions,
} from 'pptx-viewer-shared';
/**
 * useViewerBuildingBlocks: Composes the same state + hooks `PowerPointViewer`
 * wires internally, and maps them into flat prop objects for the standalone
 * `Toolbar` and `SlideCanvas` components.
 *
 * This lets a host assemble its own viewer shell instead of only getting the
 * bundled `<PowerPointViewer>`:
 *
 * ```tsx
 * function MyCustomViewer({ content }: { content: Uint8Array }) {
 *   const { toolbarProps, canvasProps } = useViewerBuildingBlocks({ content, canEdit: true });
 *   return (
 *     <>
 *       <Toolbar {...toolbarProps} />
 *       <SlideCanvas {...canvasProps} />
 *     </>
 *   );
 * }
 * ```
 *
 * This is an additive composition, not a refactor: `PowerPointViewer` keeps
 * its own independent wiring in `ViewerToolbarSection` / `ViewerMainContent`,
 * and this hook intentionally duplicates that wiring (via
 * `useViewerBuildingBlocksState`) rather than routing `PowerPointViewer`
 * through it (a much larger, riskier change). Pieces `PowerPointViewer`
 * renders itself, dialogs, presentation overlays, mobile chrome, resizable
 * panels, are out of scope here; hosts that need them should
 * render `PowerPointViewer` instead.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SlideCanvasProps } from '../components/canvas/canvas-types';
import type { ToolbarProps } from '../components/toolbar/toolbar-types';
import type { PowerPointViewerHandle } from '../types';
import type { ViewerMode } from '../types-core';
import type { CollaborationContextValue } from './collaboration/types';
import type { AutosaveStatus } from './useAutosave';
import { buildCanvasProps } from './useViewerBuildingBlocks-canvas-props';
import { buildToolbarProps } from './useViewerBuildingBlocks-toolbar-props';
import { useViewerBuildingBlocksCollaboration } from './useViewerBuildingBlocksCollaboration';
import { useViewerBuildingBlocksCore } from './useViewerBuildingBlocksCore';
import { useViewerBuildingBlocksState } from './useViewerBuildingBlocksState';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseViewerBuildingBlocksInput extends ViewportFitOptions {
	/** Optional collaboration, including a host-owned document and presence session. */
	collaboration?: CollaborationConfig;
	/** PPTX content as ArrayBuffer/Uint8Array, or null/undefined while no file is loaded. */
	content: ArrayBuffer | Uint8Array | null | undefined;
	/** Whether editing actions are enabled. Defaults to false (view-only). */
	canEdit?: boolean;
	/** Original file path, used for autosave recovery. */
	filePath?: string;
	/** Display name for the toolbar's file-name-aware controls (e.g. title bar hosts build themselves). */
	fileName?: string;
	/** Whether the built-in autosave-to-localStorage recovery timer is active. Defaults to true. */
	autosaveEnabled?: boolean;
	/** Display name used as the author for comments. */
	userName?: string;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
	/** Imperative handle ref, exposing the same `PowerPointViewerHandle` API `PowerPointViewer` does. */
	handle?: React.ForwardedRef<PowerPointViewerHandle>;
	onContentChange?: (content: Uint8Array) => void;
	onDirtyChange?: (dirty: boolean) => void;
	onActiveSlideChange?: (index: number) => void;
	onModeChange?: (mode: ViewerMode) => void;
	onZoomChange?: (zoom: number) => void;
	onSelectionChange?: (ids: string[]) => void;
	onSlideCountChange?: (count: number) => void;
	/** Fired by the toolbar's "Settings" button; the host owns rendering that dialog. */
	onOpenSettings?: () => void;
	/** Fired by the toolbar's "Header & Footer" button; the host owns rendering that panel. */
	onOpenHeaderFooter?: () => void;
	/** Fired by the toolbar's "Share" button; the host owns rendering that dialog. */
	onOpenShareDialog?: () => void;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface ViewerBuildingBlocksResult {
	/** Connection and presence state for a custom status bar, or null when disabled. */
	collaboration: CollaborationContextValue | null;
	/** Flat, self-contained props for the standalone `<Toolbar>` component. */
	toolbarProps: ToolbarProps;
	/** Flat, self-contained props for the standalone `<SlideCanvas>` component. */
	canvasProps: SlideCanvasProps;
	/** Current viewer mode (edit, view, present, master). */
	mode: ViewerMode;
	/** True while the initial parse of `content` is in progress. */
	loading: boolean;
	/** Parse error message, or null. */
	error: string | null;
	/** Current autosave-to-localStorage recovery status. */
	autosaveStatus: AutosaveStatus;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewerBuildingBlocks(
	input: UseViewerBuildingBlocksInput,
): ViewerBuildingBlocksResult {
	const {
		content: incomingContent,
		canEdit: requestedCanEdit = false,
		filePath,
		fileName,
		autosaveEnabled = true,
		userName,
		hiddenActions,
		handle,
		onContentChange,
		onDirtyChange,
		onActiveSlideChange,
		onModeChange,
		onZoomChange,
		onSelectionChange,
		onSlideCountChange,
		onOpenSettings,
		onOpenHeaderFooter,
		onOpenShareDialog,
	} = input;
	const authorizedCanEdit = requestedCanEdit && input.collaboration?.role !== 'viewer';
	const { t } = useTranslation();

	// Local content state, synced from the incoming prop but able to diverge
	// when the built-in File ▸ Open picker loads a different deck in place
	// (mirrors PowerPointViewer's own content state).
	const [content, setContent] = useState<ArrayBuffer | Uint8Array | null>(incomingContent ?? null);
	const [loadOrigin, setLoadOrigin] = useState<CollabLoadOrigin>('bootstrap');
	useEffect(() => {
		setContent(incomingContent ?? null);
		setLoadOrigin('bootstrap');
	}, [incomingContent]);

	const onOpenFile = useCallback(() => {
		void (async () => {
			const picked = await openPptxFile();
			if (picked) {
				setLoadOrigin('user');
				setContent(picked.buffer);
			}
		})();
	}, []);
	const onOpenRecentFile = useCallback((key: string) => {
		void (async () => {
			const bytes = await readBackstageRecentFile(key);
			if (bytes) {
				setLoadOrigin('user');
				setContent(bytes);
			}
		})();
	}, []);

	const core = useViewerBuildingBlocksCore({
		content,
		canEdit: authorizedCanEdit,
		fitPadding: input.fitPadding,
		maxFitScale: input.maxFitScale,
	});
	const {
		state,
		mode,
		slides,
		loading,
		error,
		activeSlideIndex,
		activeSlide,
		selectedElement,
		zoom,
		history,
		presentation,
		masterPseudoSlide,
		gridSpacingPx,
		viewerOptions,
	} = core;
	// Shared slides can arrive before their original PPTX resources finish loading.
	const canEdit = authorizedCanEdit && !loading && !error;

	const {
		dialogs,
		loadVersion,
		editorOps,
		exportHandlers,
		printHandlers,
		propertyHandlers,
		handleSetMode,
		handleEnterPresenterView,
		handleEnterRehearsalMode,
		autosaveStatus,
		viewPreferencesSync,
	} = useViewerBuildingBlocksState({
		core,
		content,
		canEdit,
		filePath,
		autosaveEnabled,
		userName,
		handle,
		setContent,
		onContentChange,
		onDirtyChange,
		onActiveSlideChange,
		onModeChange,
		onZoomChange,
		onSelectionChange,
		onSlideCountChange,
	});

	// ── Map hook outputs into flat component props ───────────────────────
	const { collaboration, overlay } = useViewerBuildingBlocksCollaboration({
		core,
		config: input.collaboration,
		content,
		loadOrigin,
		loadVersion,
		embedFonts: dialogs.embedFontsEnabled,
	});
	const toolbarProps = buildToolbarProps({
		mode,
		canEdit,
		state,
		selectedElement,
		activeSlide,
		zoom,
		history,
		findReplace: editorOps.findReplace,
		manipulation: editorOps.manipulation,
		insertHandlers: editorOps.insertHandlers,
		exportHandlers,
		printHandlers,
		propertyHandlers,
		dialogs,
		activeSlideIndex,
		slideOps: editorOps.slideOps,
		ops: editorOps.ops,
		onSetMode: handleSetMode,
		onEnterPresenterView: handleEnterPresenterView,
		onEnterRehearsalMode: handleEnterRehearsalMode,
		onOpenSettings,
		onOpenHeaderFooter,
		onOpenShareDialog,
		onOpenFile,
		onOpenRecentFile,
		fileName,
		autosaveStatus,
		autosaveEnabled,
		hiddenActions,
		viewPreferencesSync,
	});

	const canvasProps = buildCanvasProps({
		mode,
		canEdit,
		slides,
		activeSlide,
		masterPseudoSlide,
		templateElements: state.templateElements,
		canvasSize: state.canvasSize,
		activeSlideIndex,
		gridSpacingPx,
		zoom,
		state,
		selectedElement,
		canvasHandlers: editorOps.canvasHandlers,
		insertHandlers: editorOps.insertHandlers,
		tableOps: editorOps.tableOps,
		presentation,
		findResults: editorOps.findReplace.findResults,
		findResultIndex: editorOps.findReplace.findResultIndex,
		viewerOptions,
		buildHyperlinkConfirmMessage: (url) => `${t('pptx.options.trust.confirmHyperlinks')}\n\n${url}`,
	});

	canvasProps.collaborationOverlay = overlay;
	return { toolbarProps, canvasProps, mode, loading, error, autosaveStatus, collaboration };
}
