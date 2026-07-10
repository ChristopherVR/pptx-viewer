import type { CanvasSize, ViewerTheme } from 'pptx-viewer-shared';

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
export type { CanvasSize, ViewerTheme };

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
}

/**
 * Imperative editing API exposed on the `<PowerPointViewer>` component
 * instance (via `bind:this`). Mirrors the vanilla binding's `EditorController`
 * surface subset the host drives directly.
 */
export interface PowerPointViewerApi {
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
}
