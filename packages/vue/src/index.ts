// ── Vue 3 PowerPoint viewer/editor ──
export { PowerPointViewer, SlideCanvas, SlideStage, ElementRenderer } from './viewer';
export type {
	PowerPointViewerProps,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	CollaborationConfig,
	CollaborationRole,
	CanvasSize,
} from './viewer';

// ── Shared API types ──
export type { ViewerMode, PowerPointViewerAPI } from 'pptx-viewer-shared';

// ── Audience / presenter content sharing (IndexedDB, wire-compatible with React) ──
export {
	AUDIENCE_HASH,
	isAudienceTab,
	storeAudienceContent,
	loadAudienceContent,
	clearAudienceContent,
} from './viewer';

// ── Shared utilities ──
export { cn } from './utils';

// ── Theme configuration ──
export type { ViewerTheme, ViewerThemeColors } from './theme';
export {
	defaultThemeColors,
	defaultRadius,
	themeToCssVars,
	defaultCssVars,
	provideViewerTheme,
	useViewerTheme,
	useThemeStyle,
	vermilionLightColors,
	vermilionDarkColors,
	vermilionLightTheme,
	vermilionDarkTheme,
	vermilionRadius,
} from './theme';
