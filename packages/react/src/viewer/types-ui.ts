import type {
	ConnectorArrowType,
	PptxAnimationPreset,
	PptxElementAnimation,
	PptxSlideTransition,
	StrokeDashType,
	XmlObject,
} from 'pptx-viewer-core';
import type {
	AccountAuthConfig,
	PowerPointViewerAPI,
	ThemeCatalogEntry,
	ToolbarActionId,
	ViewerFontSource,
} from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
/**
 * UI-related and interaction types for the PowerPoint viewer/editor plugin.
 *
 * These types support the interactive UI layer: context menus, marquee selection,
 * table cell editing, presentation animations, toolbar sections, slide navigation,
 * shortcut references, accessibility audits, option lists for dropdowns, and the
 * public component props/handle interfaces.
 */
import type React from 'react';

import type { CollaborationConfig } from './hooks/collaboration/types';
import type { ConnectorGeometryType, SupportedShapeType } from './types-core';
/**
 * Base handle interface for file viewer components.
 * Defined locally to avoid dependency on external file-viewer plugin packages.
 * Provides a standard `getContent` method used by the host application to
 * retrieve the current file content (e.g. for saving).
 */
export interface FileViewerHandle {
	/** Get the current content of the file (for saving) */
	getContent: () => Promise<string | Uint8Array>;
}

// ---------------------------------------------------------------------------
// Shape presets (UI-only - icons are ReactNode)
// ---------------------------------------------------------------------------

/** A shape preset entry used in the toolbar shape insertion palette. */
export interface ShapePreset {
	type: SupportedShapeType;
	label: string;
	icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

/** Tracks the position and target element of an open context menu. */
export interface ElementContextMenuState {
	x: number;
	y: number;
	elementId: string;
}

/** Identifies an action triggered from the element right-click context menu. */
export type ElementContextMenuAction =
	| 'copy'
	| 'cut'
	| 'paste'
	| 'duplicate'
	| 'delete'
	| 'bring-forward'
	| 'send-backward'
	| 'bring-front'
	| 'send-back'
	| 'bringForward'
	| 'sendBackward'
	| 'bringToFront'
	| 'sendToBack'
	| 'comment'
	| 'addComment'
	| 'group'
	| 'ungroup'
	| 'editPoints'
	| 'editHyperlink';

// ---------------------------------------------------------------------------
// Marquee selection
// ---------------------------------------------------------------------------

/**
 * State of an active marquee (rubber-band) selection rectangle.
 * Created when the user clicks and drags on the canvas background,
 * and used to compute which elements fall within the selection area.
 */
export interface MarqueeSelectionState {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	additive: boolean;
	baseSelectionIds?: string[];
}

// ---------------------------------------------------------------------------
// Table editing
// ---------------------------------------------------------------------------

/** Tracks which table cell is selected and/or actively being edited. */
export interface TableCellEditorState {
	rowIndex: number;
	columnIndex: number;
	/** When true the cell has an active text input. */
	isEditing?: boolean;
	/** Optional multi-cell selection (Shift+Click range). Each entry is {row, col}. */
	selectedCells?: Array<{ row: number; col: number }>;
}

/** A single parsed table cell with its position, text content, and computed CSS style. */
export interface ParsedTableCell {
	rowIndex: number;
	columnIndex: number;
	text: string;
	style: React.CSSProperties;
	rawCell: XmlObject;
}

/** Complete parsed table data including row/column structure and all cells. */
export interface ParsedTableData {
	rowCount: number;
	columnCount: number;
	rows: XmlObject[];
	columnPercentages: number[];
	cells: ParsedTableCell[];
}

// ---------------------------------------------------------------------------
// Presentation & animation
// ---------------------------------------------------------------------------

/** Runtime state for a single element's animation during presentation mode. */
export interface PresentationAnimationRuntime {
	elementId: string;
	state: 'hidden' | 'entering' | 'visible';
	animation: PptxElementAnimation;
}

// ---------------------------------------------------------------------------
// Slide navigation
// ---------------------------------------------------------------------------

/**
 * Groups slides into named sections for the slides pane sidebar.
 * Corresponds to OOXML `p15:section` elements in `presentation.xml`.
 */
export interface SlideSectionGroup {
	id: string;
	label: string;
	slideIndexes: number[];
	/** Section highlight color from p15:sectionPr. */
	color?: string;
	/** Whether the section should start collapsed (from p15:sectionPr). */
	defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Toolbar / inspector
// ---------------------------------------------------------------------------

/** Alignment direction for distributing/aligning multiple selected elements on the slide. */
export type SlideAlignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Identifies one of the ribbon-style toolbar tabs (home, insert, text, etc.). */
export type ToolbarSection =
	| 'file'
	| 'home'
	| 'insert'
	| 'text'
	| 'arrange'
	| 'draw'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'record'
	| 'review'
	| 'view'
	| 'help';

/** The active drawing/inking tool selected in the Draw toolbar tab. */
export type DrawingTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

// ---------------------------------------------------------------------------
// Shortcut / accessibility reference
// ---------------------------------------------------------------------------

/** A single entry in the keyboard shortcuts help panel. */
export interface ShortcutReferenceItem {
	actionKey: string;
	shortcut: string;
}

/** An accessibility audit finding (missing alt text, reading order issues, etc.). */
export interface AccessibilityIssue {
	slideIndex: number;
	elementId?: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
}

// ---------------------------------------------------------------------------
// Options lists (for dropdowns)
// ---------------------------------------------------------------------------

/** Dropdown option for selecting a connector geometry type. */
export interface ConnectorGeometryOption {
	value: ConnectorGeometryType;
	label: string;
}

/** Dropdown option for selecting a connector arrowhead style. */
export interface ConnectorArrowOption {
	value: ConnectorArrowType;
	label: string;
}

/** Dropdown option for selecting a stroke dash pattern. */
export interface StrokeDashOption {
	value: StrokeDashType;
	label: string;
}

/** Dropdown option for selecting a slide transition type. */
export interface SlideTransitionOption {
	value: NonNullable<PptxSlideTransition['type']>;
	label: string;
}

/** Dropdown option for selecting an animation effect preset. */
export interface AnimationPresetOption {
	value: Exclude<PptxAnimationPreset, 'none'>;
	label: string;
}

// ---------------------------------------------------------------------------
// Public component props & handle
// ---------------------------------------------------------------------------

export interface PowerPointViewerProps {
	/** PowerPoint content as Uint8Array */
	content: Uint8Array;
	/** Licensed fonts supplied by the host application. No fonts are bundled. */
	fonts?: ViewerFontSource[];
	/** Original file path, used for autosave recovery */
	filePath?: string;
	/**
	 * Display name of the open document, shown in the PowerPoint-style title
	 * bar (e.g. "quarterly-review.pptx"). Falls back to a generic label.
	 */
	fileName?: string;
	/** Callback when content has unsaved changes */
	onDirtyChange?: (isDirty: boolean) => void;
	onContentChange?: (content: Uint8Array) => void;
	/** Callback when active slide changes */
	onActiveSlideChange?: (slideIndex: number) => void;
	/** Callback when the viewer mode changes (e.g. edit to present). */
	onModeChange?: (mode: import('pptx-viewer-shared').ViewerMode) => void;
	/** Callback when the zoom level changes. */
	onZoomChange?: (zoom: number) => void;
	/** Callback when element selection changes. */
	onSelectionChange?: (elementIds: string[]) => void;
	/** Callback when the total slide count changes (slide added/deleted). */
	onSlideCountChange?: (count: number) => void;
	/**
	 * Host override for the File ▸ Open action. When provided, the built-in
	 * native file picker is bypassed and this is invoked instead; the host is
	 * then responsible for supplying a new `content` buffer. When omitted, the
	 * viewer opens its own picker and loads the chosen presentation in place.
	 */
	onOpenFile?: () => void;

	/** Whether editing actions are enabled */
	canEdit?: boolean;
	/** Optional class name */
	className?: string;

	/**
	 * Display name used as the author for comments and annotations.
	 * Falls back to `collaboration.userName` when collaborating, or `'You'`.
	 */
	authorName?: string;

	/**
	 * Theme configuration for customising the viewer's appearance.
	 *
	 * Accepts partial color overrides, a custom border-radius, and
	 * arbitrary CSS custom properties. Unset values fall back to the
	 * built-in dark theme.
	 *
	 * @example
	 * ```tsx
	 * <PowerPointViewer
	 *   content={bytes}
	 *   theme={{
	 *     colors: { primary: "#6366f1", background: "#0f172a" },
	 *     radius: "0.75rem",
	 *   }}
	 * />
	 * ```
	 *
	 * @see {@link ViewerTheme} for the full type definition.
	 */
	theme?: import('../theme').ViewerTheme;

	/**
	 * Initial key into `availableThemes` (or the built-in `THEME_CATALOG`) for
	 * File > Options > Appearance. Ignored once the user picks a different
	 * entry in that session, and always overridden by the `theme` prop when
	 * both are supplied. Falls back to a persisted `localStorage` choice, then
	 * `'default'`.
	 */
	defaultThemeKey?: string;

	/**
	 * Theme choices offered by File > Options > Appearance. Defaults to the
	 * shared `THEME_CATALOG` (default/light/vermilionLight/vermilionDark).
	 */
	availableThemes?: ThemeCatalogEntry[];

	/**
	 * Called when the user picks a theme from File > Options > Appearance.
	 * When provided, the host owns persisting the choice (the viewer will not
	 * also write it to `localStorage`); otherwise the viewer persists it via
	 * the shared `writeStoredViewerPrefs` helper.
	 */
	onThemeChange?: (key: string) => void;

	/**
	 * Initial locale code for File > Options > Language. Falls back to a
	 * persisted `localStorage` choice, then `'en'`.
	 */
	defaultLocale?: string;

	/**
	 * Locale choices offered by File > Options > Language. Defaults to the
	 * codes actually registered on the host's `react-i18next` instance
	 * (mapped through the shared `LOCALE_CATALOG` for display labels).
	 */
	availableLocales?: LocaleCatalogEntry[];

	/**
	 * Called when the user picks a language from File > Options > Language.
	 * When provided, the host owns applying and persisting the choice (the
	 * viewer will not call `i18n.changeLanguage` or touch `localStorage`
	 * itself); otherwise the viewer applies and persists it directly.
	 */
	onLocaleChange?: (code: string) => void;

	/**
	 * Optional hook point for File > Account's sign-in section. Disabled by
	 * default (renders nothing extra); pass `{ enabled: true, onSignIn }` to
	 * surface a real sign-in flow.
	 */
	accountAuth?: AccountAuthConfig;

	/**
	 * Optional real-time collaboration configuration.
	 *
	 * When provided, the viewer enables collaborative editing with live
	 * cursors, user presence indicators, and CRDT-based state sync via Yjs.
	 * Requires `yjs` and `y-websocket` peer dependencies.
	 *
	 * @example
	 * ```tsx
	 * <PowerPointViewer
	 *   content={bytes}
	 *   collaboration={{
	 *     roomId: "my-room-123",
	 *     serverUrl: "wss://collab.example.com",
	 *     userName: "Alice",
	 *     userColor: "#6366f1",
	 *   }}
	 * />
	 * ```
	 */
	collaboration?: CollaborationConfig;

	/**
	 * Callback invoked when the user starts a collaboration session from the
	 * Share dialog. The host app should use this to set the `collaboration`
	 * prop with the returned config.
	 */
	onStartCollaboration?: (config: CollaborationConfig) => void;

	/**
	 * Callback invoked when the user stops a collaboration session from the
	 * Share dialog. The host app should clear the `collaboration` prop.
	 */
	onStopCollaboration?: () => void;

	/**
	 * Default values for the Share dialog fields. The host app should provide
	 * these to control the session name, user display name, and server URL.
	 * If omitted, the Share dialog fields will be empty and require user input.
	 *
	 * @example
	 * ```tsx
	 * <PowerPointViewer
	 *   shareDefaults={{
	 *     roomId: "session-abc123",
	 *     userName: "Alice",
	 *     serverUrl: "ws://localhost:1234",
	 *   }}
	 * />
	 * ```
	 */
	shareDefaults?: {
		roomId?: string;
		userName?: string;
		serverUrl?: string;
	};

	/**
	 * Opt in to the Three.js SmartArt renderer. When `true`, SmartArt diagrams
	 * render as extruded 3D blocks on a WebGL canvas instead of flat SVG.
	 * Requires the optional `three` peer dependency; when it is not installed
	 * (or the diagram has no geometry), the viewer transparently falls back to
	 * the SVG `SmartArtRenderer`. Default `false`.
	 */
	smartArt3D?: boolean;

	/**
	 * Hide individual toolbar buttons and/or ribbon tabs instead of the whole
	 * toolbar. Accepts any mix of button ids (`share`, `broadcast`, `export`,
	 * `undo`, `redo`, `record`, `notes`, `fullscreen`, `zoom`, `navigation`)
	 * and ribbon-tab ids (`file`, `home`, `insert`, `draw`, `design`,
	 * `transitions`, `animations`, `slideShow`, `record`, `review`, `view`,
	 * `help`). `zoom` and `navigation` each hide their whole control cluster
	 * (zoom in/out/fit; previous/next slide), not each sub-button. `record`
	 * is shared between the quick-access Record button and the Record ribbon
	 * tab: hiding it hides both. Omitted or empty hides nothing (default,
	 * fully backward compatible).
	 *
	 * @example
	 * ```tsx
	 * <PowerPointViewer content={bytes} hiddenActions={['share', 'broadcast', 'record']} />
	 * ```
	 */
	hiddenActions?: ToolbarActionId[];
}

export interface PowerPointViewerHandle extends FileViewerHandle, PowerPointViewerAPI {
	getContent: () => Promise<Uint8Array>;
}
