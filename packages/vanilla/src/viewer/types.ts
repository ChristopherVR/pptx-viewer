import type { PptxHandler } from 'pptx-viewer-core';
import type {
	AutosaveRecord,
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	ConnectionStatus,
	PowerPointViewerAPI,
	ViewerFontSource,
	ViewerTheme,
} from 'pptx-viewer-shared';

import type { AutosaveStatus } from './autosave';
import type { ShareDefaults } from './collab/share-helpers';
import type {
	ExportGifOptions,
	ExportPdfOptions,
	ExportVideoOptions,
	PrintOptions,
} from './export';
import type { TranslationMessages } from './i18n';
import type { PptxViewerSource } from './load';
import type { ElementRendererRegistry } from './render';

/**
 * Public API types for the vanilla (zero-framework) PowerPoint viewer.
 *
 * Derived from the Vue binding's `PowerPointViewerProps` / emits, translated
 * to plain options + callback functions (there is no framework event system
 * to emit through).
 */

// Re-export the shared collaboration + autosave types so hosts configure a
// session without a direct `pptx-viewer-shared` dependency (matching Vue).
export type {
	AutosaveRecord,
	AutosaveStatus,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	ConnectionStatus,
};

/** Callbacks mirroring the Vue component's emits. */
export interface PptxViewerCallbacks {
	/** Fired after a presentation loads successfully. */
	onLoad?: (info: { slideCount: number; canvasSize: CanvasSize }) => void;
	/** Fired when a load fails (message is already localised/best-effort). */
	onError?: (message: string, error: unknown) => void;
	/** Fired when the active slide changes (zero-based index). */
	onSlideChange?: (index: number) => void;
	/** Fired when the effective zoom scale changes (1 = 100%). */
	onZoomChange?: (scale: number) => void;
	/** Fired when presentation (fullscreen) mode is entered or exited. */
	onPresentationChange?: (presenting: boolean) => void;
	/** Fired after any document mutation (move, resize, edit, undo, ...). */
	onChange?: () => void;
	/** Fired when the unsaved-edits flag flips (a save resets it). */
	onDirtyChange?: (dirty: boolean) => void;
	/** Fired when the selected element changes (`null` = no selection). */
	onSelectionChange?: (elementId: string | null) => void;
	/** Fired on every autosave lifecycle transition (`saving`/`saved`/`error`). */
	onAutosaveStatus?: (status: AutosaveStatus) => void;
	/**
	 * Offered a recovery snapshot found in the shared IndexedDB store on start
	 * (a previous session's autosave for the same `autosaveFilePath`). The host
	 * decides whether to restore it, e.g. `viewer.loadFile(record.data)`.
	 */
	onAutosaveRecovery?: (record: AutosaveRecord) => void;
	/** Fired on every collaboration connection-status transition. */
	onCollaborationStatus?: (status: ConnectionStatus) => void;
}

export interface PptxViewerOptions extends PptxViewerCallbacks {
	/**
	 * The presentation to open: raw `.pptx` bytes (ArrayBuffer / Uint8Array),
	 * a Blob/File, or a URL string to fetch. Omit to start empty and call
	 * `loadFile` / `loadUrl` later.
	 */
	source?: PptxViewerSource;
	/** Licensed font sources supplied by the host application. */
	fonts?: ViewerFontSource[];
	/** Viewer chrome theme (shared `ViewerTheme`: colors, radius, CSS vars). */
	theme?: ViewerTheme;
	/** Display name shown in the PowerPoint-style title bar. */
	fileName?: string;
	/** UI locale (default `'en'`). Dictionaries come from `messages`. */
	locale?: string;
	/**
	 * Per-locale `pptx.*` message dictionaries. English falls back to the
	 * built-in shared dictionary; other locales fall back to English.
	 */
	messages?: TranslationMessages;
	/** Zero-based slide to show after load (default 0). */
	initialSlide?: number;
	/**
	 * Enable editing (default `false`): click to select, drag/resize/rotate,
	 * inline text editing, keyboard shortcuts, undo/redo, and the toolbar
	 * Save button. Toggle later via `setEditable`.
	 */
	editable?: boolean;
	/**
	 * Legacy flag superseded by {@link editable}; kept so existing option
	 * objects stay type-valid. It has no effect.
	 */
	readOnly?: boolean;
	/** Show the toolbar (default `true`). */
	showToolbar?: boolean;
	/** Show the thumbnail sidebar (default `true`). */
	showThumbnails?: boolean;
	/**
	 * Build the editing format toolbar row (bold/fill/insert/z-order); default
	 * `true`. The row is only *visible* while editing is enabled.
	 */
	showFormatToolbar?: boolean;
	/**
	 * Build the property inspector panel (position/size/fill/line); default
	 * `true`. Only *visible* while editing is enabled.
	 */
	showInspector?: boolean;
	/**
	 * Custom element-renderer registry. Defaults to `createDefaultRegistry()`;
	 * pass your own (or mutate the default via `getRegistry()`) to add or
	 * override element renderers.
	 */
	registry?: ElementRendererRegistry;
	/**
	 * Opt-in WebGL SmartArt renderer (default `false`): renders `smartArt`
	 * elements as an extruded Three.js scene instead of the flat SVG layout.
	 * `three` is an optional peer dependency, lazily imported only when this is
	 * `true`; when it is unavailable or the scene fails to mount, the SVG
	 * renderer is used instead. Set once at construction (no runtime setter,
	 * mirroring the Vue/React/Angular bindings).
	 */
	smartArt3D?: boolean;
	/**
	 * Enable debounced autosave (default `false`): after each local edit the deck
	 * is re-serialized and stashed in the shared IndexedDB recovery store as a
	 * crash-safety net (it never replaces the user's real Save). The toolbar shows
	 * a small status pill; a snapshot from a prior session is offered through
	 * {@link PptxViewerCallbacks.onAutosaveRecovery}.
	 */
	autosave?: boolean;
	/** Fired when the title-bar AutoSave control enables or disables recovery autosave. */
	onToggleAutosave?: (enabled: boolean) => void;
	/** Debounce window (ms) between an edit and the persisted snapshot (default 2000). */
	autosaveIntervalMs?: number;
	/** IndexedDB recovery key for autosave (default `'presentation.pptx'`). */
	autosaveFilePath?: string;
	/**
	 * Start a real-time collaboration session immediately (Yjs over y-websocket
	 * or serverless y-webrtc). Local edits publish to peers and remote edits
	 * merge in granularly; a `role: 'viewer'` config forces read-only. Start or
	 * stop a session later with {@link PptxViewerInstance.startCollaboration} /
	 * {@link PptxViewerInstance.stopCollaboration}.
	 *
	 * Note: media/OLE/3D/ink binary payloads are not carried over the wire (a
	 * shared codec limitation), and a remote update replaces the whole local
	 * slide array, so a joiner's host-provided media can degrade.
	 */
	collaboration?: CollaborationConfig;
	/**
	 * Prefilled values for the built-in Share/Broadcast dialogs' form fields
	 * (e.g. a host-generated display name), mirroring the Vue binding's
	 * `shareDefaults` prop. The broadcast dialog uses `userName` as the
	 * presenter's display name.
	 */
	shareDefaults?: ShareDefaults;
}

/** The viewer handle returned by `createPptxViewer`. */
export interface PptxViewerInstance extends PowerPointViewerAPI {
	/** Load a presentation from bytes or a Blob/File (replaces the current one). */
	loadFile(file: Blob | ArrayBuffer | Uint8Array): Promise<void>;
	/** Fetch and load a presentation from a URL. */
	loadUrl(url: string): Promise<void>;
	/** Go to the next slide (no-op on the last slide). */
	next(): void;
	/** Go to the previous slide (no-op on the first slide). */
	prev(): void;
	/** Jump to a zero-based slide index (clamped). */
	goToSlide(index: number): void;
	/** Number of slides in the loaded presentation (0 when none). */
	getSlideCount(): number;
	/** Zero-based index of the visible slide. */
	getCurrentSlide(): number;
	/** Effective zoom scale (1 = 100%), after fit resolution. */
	getZoom(): number;
	/** Set an explicit zoom scale, or `'fit'` for fit-to-viewport. */
	setZoom(zoom: number): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	/** Apply a new viewer theme (pass `undefined` to reset to defaults). */
	setTheme(theme: ViewerTheme | undefined): void;
	/** Switch the UI locale (rebuilds the chrome labels). */
	setLocale(locale: string): void;
	/** Enter presentation mode (real Fullscreen API). */
	enterPresentation(): Promise<void>;
	/** Exit presentation mode. */
	exitPresentation(): Promise<void>;
	/** Enable or disable editing at runtime (disabling clears the selection). */
	setEditable(editable: boolean): void;
	/** Enable or disable editing inherited layout/master elements. */
	setEditTemplateMode(enabled: boolean): void;
	/** Undo the last edit (no-op when the undo stack is empty). */
	undo(): void;
	/** Redo the last undone edit (no-op when the redo stack is empty). */
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	/** Serialise the (edited) presentation to `.pptx` bytes and clear dirty. */
	save(): Promise<Uint8Array>;
	/** `save()` + trigger a browser download (default `presentation.pptx`). */
	downloadPptx(fileName?: string): Promise<void>;
	/** Delete the selected element (no-op without a selection). */
	deleteSelected(): void;
	/** Id of the selected element, or `null`. */
	getSelectedElementId(): string | null;
	/**
	 * Export a slide as a PNG download (defaults to the current slide). Renders
	 * the slide off-screen at scale 1 and rasterises it with `html2canvas-pro`
	 * (dynamically imported), so the first call pays a one-time load cost.
	 */
	exportSlidePng(index?: number): Promise<void>;
	/** Copy a slide to the system clipboard as a PNG image. */
	copySlideAsImage(index?: number): Promise<void>;
	/**
	 * Export every slide as a multi-page PDF download (one slide per page).
	 * `jspdf` is dynamically imported on first use.
	 */
	exportPdf(options?: ExportPdfOptions): Promise<void>;
	/**
	 * Export every slide as an animated GIF download (one frame per slide,
	 * `slideDurationMs` per frame). Slides are captured off-screen like
	 * `exportSlidePng` and encoded with the shared pure-JS GIF89a encoder.
	 */
	exportGif(options?: ExportGifOptions): Promise<void>;
	/**
	 * Export every slide as a WebM video download: each captured slide is held
	 * for its configured duration on a canvas stream recorded by
	 * `MediaRecorder` (codec picked from the shared WebM candidates).
	 */
	exportVideo(options?: ExportVideoOptions): Promise<void>;
	/**
	 * Assemble the printable document (slides / notes / handouts / outline)
	 * and open it in a new print window. Resolves `false` when the popup was
	 * blocked: browsers typically only allow `window.open` inside a user
	 * gesture, so call this from a click handler (or pass a custom
	 * `openPrintWindow` that writes into an iframe you own).
	 */
	print(options?: PrintOptions): Promise<boolean>;
	/** The element-renderer registry in effect (extension point). */
	getRegistry(): ElementRendererRegistry;
	/**
	 * Escape hatch: the live `pptx-viewer-core` handler for the loaded file
	 * (or `null`). Enables advanced operations (save, markdown conversion,
	 * archive access) without extra APIs here.
	 */
	getHandler(): PptxHandler | null;
	/**
	 * Start (or restart) a real-time collaboration session. Resolves once the
	 * transport is created; connection status arrives via
	 * {@link PptxViewerCallbacks.onCollaborationStatus}.
	 */
	startCollaboration(config: CollaborationConfig): Promise<void>;
	/** Stop the active collaboration session (no-op when none is running). */
	stopCollaboration(): void;
	/** Current collaboration connection status (`'disconnected'` when inactive). */
	getCollaborationStatus(): ConnectionStatus;
	/** Force an immediate autosave snapshot (no-op when autosave is disabled). */
	autosaveNow(): Promise<void>;
	/** Enable or disable recovery autosave without rebuilding the viewer. */
	setAutosaveEnabled(enabled: boolean): void;
	/** Whether recovery autosave is currently enabled. */
	isAutosaveEnabled(): boolean;
	/** Tear down DOM, listeners, Blob URLs, and the core handler. */
	destroy(): void;
}
