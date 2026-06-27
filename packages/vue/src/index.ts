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
} from './theme';
