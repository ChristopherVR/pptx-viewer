// ── React-based PowerPoint viewer/editor ──
export {
	PowerPointViewer,
	getAnimationInitialStyle,
} from "./viewer";
export type {
	PowerPointViewerProps,
	PowerPointViewerHandle,
} from "./viewer";

// ── Canvas export (html2canvas oklch wrapper) ──
export { renderToCanvas } from "./lib/canvas-export";

// ── Theme configuration ──
export type { ViewerTheme, ViewerThemeColors } from "./theme";
export {
	defaultThemeColors,
	defaultRadius,
	themeToCssVars,
	defaultCssVars,
	ViewerThemeProvider,
	useViewerTheme,
} from "./theme";
