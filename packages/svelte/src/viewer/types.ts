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
	/** Optional class name applied to the root element. */
	class?: string;
	/** Fired after a presentation finishes loading. */
	onload?: (detail: ViewerLoadDetail) => void;
	/** Fired when a load fails (message is human-readable). */
	onerror?: (message: string) => void;
	/** Fired when the active slide changes (0-based index). */
	onslidechange?: (index: number) => void;
}
