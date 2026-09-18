import type {
	CollaborationConfig,
	CollaborationShellState,
	ToolbarActionId,
	ViewportFitOptions,
} from 'pptx-viewer-shared';
import type React from 'react';

import type { SlideCanvasProps } from '../components/canvas/canvas-types';
import type { ToolbarProps } from '../components/toolbar/toolbar-types';
import type { PowerPointViewerHandle } from '../types';
import type { ViewerMode } from '../types-core';
import type { CollaborationContextValue } from './collaboration/types';
import type { AutosaveStatus } from './useAutosave';

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

export interface ViewerBuildingBlocksResult {
	/** Connection and presence state for a custom status bar, or null when disabled. */
	collaboration: CollaborationContextValue | null;
	/**
	 * Effective edit permission plus connection/presence counts, in the shape
	 * every binding's custom shell receives (Vue/Svelte `shellState`, Angular
	 * `state()`, Vanilla `getState()`); pass it to
	 * `describeCollaborationShellState` for a localised status line.
	 */
	shellState: CollaborationShellState;
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
