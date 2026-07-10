import type { PptxHandler } from 'pptx-viewer-core';
import type { CanvasSize, ViewerTheme } from 'pptx-viewer-shared';

import type { TranslationMessages } from './i18n';
import type { PptxViewerSource } from './load';
import type { ElementRendererRegistry } from './render';
import type { ZoomLevel } from './state';

/**
 * Public API types for the vanilla (zero-framework) PowerPoint viewer.
 *
 * Derived from the Vue binding's `PowerPointViewerProps` / emits, translated
 * to plain options + callback functions (there is no framework event system
 * to emit through).
 */

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
}

export interface PptxViewerOptions extends PptxViewerCallbacks {
	/**
	 * The presentation to open: raw `.pptx` bytes (ArrayBuffer / Uint8Array),
	 * a Blob/File, or a URL string to fetch. Omit to start empty and call
	 * `loadFile` / `loadUrl` later.
	 */
	source?: PptxViewerSource;
	/** Viewer chrome theme (shared `ViewerTheme`: colors, radius, CSS vars). */
	theme?: ViewerTheme;
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
	 * Reserved for a future editing mode. The vanilla binding is currently
	 * view-only regardless of this flag (default `true`).
	 */
	readOnly?: boolean;
	/** Show the toolbar (default `true`). */
	showToolbar?: boolean;
	/** Show the thumbnail sidebar (default `true`). */
	showThumbnails?: boolean;
	/**
	 * Custom element-renderer registry. Defaults to `createDefaultRegistry()`;
	 * pass your own (or mutate the default via `getRegistry()`) to add or
	 * override element renderers.
	 */
	registry?: ElementRendererRegistry;
}

/** The viewer handle returned by `createPptxViewer`. */
export interface PptxViewerInstance {
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
	setZoom(zoom: ZoomLevel): void;
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
	/** The element-renderer registry in effect (extension point). */
	getRegistry(): ElementRendererRegistry;
	/**
	 * Escape hatch: the live `pptx-viewer-core` handler for the loaded file
	 * (or `null`). Enables advanced operations (save, markdown conversion,
	 * archive access) without extra APIs here.
	 */
	getHandler(): PptxHandler | null;
	/** Tear down DOM, listeners, Blob URLs, and the core handler. */
	destroy(): void;
}
