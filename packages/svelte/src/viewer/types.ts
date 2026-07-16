import type {
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	PowerPointViewerAPI,
	ViewerFontSource,
	ViewerTheme,
} from 'pptx-viewer-shared';

import type {
	ExportGifOptions,
	ExportPdfOptions,
	ExportVideoOptions,
	PrintOptions,
} from './export';

/**
 * Public component types for the Svelte PowerPoint viewer.
 *
 * Mirrors the Vue binding's props contract for the viewer subset. Two
 * conventions differ from Vue:
 *
 *  - **Emits become callback props.** Svelte 5 components receive event
 *    callbacks as regular props (`onload`, `onerror`, `onslidechange`).
 *  - **`content` is named `source`.** The viewer accepts raw `.pptx` bytes.
 */
export type {
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	ViewerTheme,
};

/** Payload for the `onload` callback. */
export interface ViewerLoadDetail {
	/** Number of slides in the loaded presentation. */
	slideCount: number;
	/** Slide canvas size in pixels. */
	canvasSize: CanvasSize;
}

/** Props for `<PowerPointViewer>`. */
export interface PowerPointViewerProps {
	/** PowerPoint content as `Uint8Array` (or `ArrayBuffer`). */
	source: Uint8Array | ArrayBuffer | null | undefined;
	/** Licensed font sources supplied by the host application. */
	fonts?: ViewerFontSource[];
	/**
	 * Theme configuration for customising the viewer's appearance. Accepts
	 * partial color overrides, a custom border-radius, and arbitrary CSS
	 * custom properties. Unset values fall back to the built-in defaults.
	 */
	theme?: ViewerTheme;
	/** UI locale (BCP 47). English ships built in; register others via `pptx-svelte-viewer/i18n`. */
	locale?: string;
	/** Slide shown after load (0-based, clamped). Default 0. */
	initialSlide?: number;
	/** Show the thumbnail sidebar. Default true. */
	showThumbnails?: boolean;
	/** Show the navigation/zoom toolbar. Default true. */
	showToolbar?: boolean;
	/**
	 * Show the speaker-notes panel and its toolbar toggle. Default true. The
	 * panel is plain-text only and reads the active slide's notes; pass
	 * `onnotesupdate` to make it editable (omitting it renders read-only).
	 */
	showNotes?: boolean;
	/**
	 * Opt in to the experimental Three.js (WebGL) SmartArt renderer for
	 * `smartArt` elements, in place of the default SVG renderer. Requires the
	 * optional `three` peer dependency; when it is unavailable, or a diagram
	 * has no renderable nodes, or the WebGL mount fails, the SVG renderer is
	 * used automatically. Default false.
	 */
	smartArt3D?: boolean;
	/**
	 * Enable in-place editing: click to select an element, drag to move, use the
	 * 8 handles to resize (Shift locks aspect) and the rotate handle to rotate,
	 * double-click text/shapes to edit their text, and the keyboard for
	 * delete/duplicate/nudge/undo/redo. Adds an Undo/Redo/Save/Download group to
	 * the toolbar. Default false (read-only viewer).
	 */
	editable?: boolean;
	/** Optional class name applied to the root element. */
	class?: string;
	/** Optional display name shown in the desktop title bar. */
	fileName?: string;
	/** Fired after a presentation finishes loading. */
	onload?: (detail: ViewerLoadDetail) => void;
	/** Fired when a load fails (message is human-readable). */
	onerror?: (message: string) => void;
	/** Fired when the active slide changes (0-based index). */
	onslidechange?: (index: number) => void;
	/**
	 * Fired with the committed plain-text speaker notes when the user edits
	 * the notes panel (on `change` / `blur`). This binding has no built-in
	 * slide-mutation channel, so the host is responsible for writing the text
	 * back onto its own copy of the slide; omit this to render the notes
	 * panel read-only.
	 */
	onnotesupdate?: (notes: string) => void;
	/**
	 * Fired after every committed editing mutation (move / resize / rotate /
	 * delete / duplicate / nudge / inline text / notes) when `editable`. Use it
	 * to track the dirty state or mirror edits into host state.
	 */
	onchange?: () => void;
	/** Canonical viewer contract callbacks. */
	ondirtychange?: (dirty: boolean) => void;
	oncontentchange?: (content: Uint8Array) => void;
	onmodechange?: (mode: string) => void;
	onzoomchange?: (zoom: number) => void;
	onselectionchange?: (elementIds: string[]) => void;
	onslidecountchange?: (count: number) => void;
	/** Host override for the File > Open action. */
	onopenfile?: () => void;
	/**
	 * Enable debounced crash-recovery autosave. On each edit (when `editable`)
	 * the current slides are serialized to `.pptx` bytes and written to the
	 * shared IndexedDB recovery store (keyed by {@link filePath}), and
	 * `onautosave` is fired with the bytes. Requires `filePath`; without one the
	 * autosave indicator reads "disabled". This binding does not auto-restore on
	 * load; recovery is a host concern (see the re-exported `getAutosaveSnapshot`
	 * / `listAutosaveSnapshots` helpers). Default false.
	 */
	autosave?: boolean;
	/** Fired when the desktop title bar toggles AutoSave for this viewer instance. */
	onautosavetoggle?: (enabled: boolean) => void;
	/**
	 * IndexedDB record key for autosave (typically the open file's name/path).
	 * Autosave is inert until this is set.
	 */
	filePath?: string;
	/** Autosave debounce window in milliseconds. Default 2000. */
	autosaveIntervalMs?: number;
	/** Fired with the serialized `.pptx` bytes after each successful autosave. */
	onautosave?: (bytes: Uint8Array) => void;
	/**
	 * Real-time collaboration configuration. When provided, the viewer connects
	 * to the room (y-websocket or serverless y-webrtc), publishes local edits
	 * granularly, and applies remote peers' edits into the editable slides.
	 * Clearing it (undefined) tears the session down. A `viewer` role makes the
	 * local user read-only. Remote cursors/presence render via the built-in
	 * Share/Broadcast toolbar buttons; see `collab/collaboration.svelte.ts` and
	 * `collab/components/`.
	 */
	collaboration?: CollaborationConfig;
	/** Fired when a collaboration session starts (with the resolved config). */
	onstartcollaboration?: (config: CollaborationConfig) => void;
	/** Fired when a collaboration session stops. */
	onstopcollaboration?: () => void;
	/**
	 * Prefilled values for the built-in Share dialog's form (room id, display
	 * name, server URL). The Broadcast dialog reuses `serverUrl` from this same
	 * object. Purely a starting point; the user can still edit every field.
	 */
	shareDefaults?: { roomId?: string; userName?: string; serverUrl?: string };
}

/**
 * Imperative editing API exposed on the `<PowerPointViewer>` component
 * instance (via `bind:this`). Mirrors the vanilla binding's `EditorController`
 * surface subset the host drives directly.
 */
export interface PowerPointViewerApi extends PowerPointViewerAPI {
	/** Undo the last committed edit. */
	undo(): void;
	/** Redo the last undone edit. */
	redo(): void;
	/** Whether an undo step is available (snapshot; not reactive). */
	canUndo(): boolean;
	/** Whether a redo step is available (snapshot; not reactive). */
	canRedo(): boolean;
	/** Delete the selected element (no-op when nothing is selected). */
	deleteSelected(): void;
	/** The selected top-level element id, or null. */
	getSelectedElementId(): string | null;
	/** Serialize the edited slides to `.pptx` bytes via the core handler. */
	save(): Promise<Uint8Array>;
	/** Save + trigger a browser download of the `.pptx` (default name). */
	downloadPptx(fileName?: string): Promise<void>;
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
	 * Export every slide as an animated GIF download. Per-slide frame delays
	 * come from the shared frame plan: a default `slideDurationMs` (2000) with
	 * optional per-slide `slideTimingsMs` overrides. Supports `onProgress` and
	 * an `AbortSignal`, like {@link exportPdf}.
	 */
	exportGif(options?: ExportGifOptions): Promise<void>;
	/**
	 * Export every slide as a WebM video download (canvas capture stream +
	 * `MediaRecorder`; codec picked from the shared WebM candidates). Timing
	 * follows the shared video plan (`slideDurationMs` default 3000, per-slide
	 * `slideTimingsMs`, `fps` default 30). Supports capture/recording progress
	 * callbacks and an `AbortSignal`.
	 */
	exportVideo(options?: ExportVideoOptions): Promise<void>;
	/**
	 * Assemble the shared print document (slides / handouts / notes / outline,
	 * slide range + colour mode) and open the browser print dialog. The default
	 * print surface is a hidden same-origin iframe, so no popup window is
	 * involved; a custom `window.open`-based opener (injectable at the
	 * controller level) is subject to popup blockers, in which case the promise
	 * resolves `false`. Resolves `true` once the print surface opened.
	 */
	print(options?: PrintOptions): Promise<boolean>;
}
