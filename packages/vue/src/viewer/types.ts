import type {
	AccountAuthConfig,
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	PowerPointViewerAPI,
	ToolbarActionId,
	ViewerFontSource,
} from 'pptx-viewer-shared';

import type { LocaleCatalogEntry } from '../i18n';
import type { ThemeCatalogEntry, ViewerTheme } from '../theme';

/**
 * Public component types for the Vue PowerPoint viewer.
 *
 * Ported from the React package's `types-ui.ts`. Two conventions differ
 * from React:
 *
 *  - **Callbacks → emits.** React passed `onDirtyChange`, `onContentChange`,
 *    and `onActiveSlideChange` as function props. The Vue component exposes
 *    these as native events (see {@link PowerPointViewerEmits}); a thin
 *    callback-prop compatibility layer can be added later if needed.
 *  - **Imperative handle → `defineExpose`.** React used `forwardRef` to
 *    surface `getContent()`. The Vue component exposes the same surface via
 *    `defineExpose`, typed by {@link PowerPointViewerExpose}.
 *
 * The framework-agnostic `CanvasSize`, `CollaborationConfig`, and
 * `CollaborationRole` types now live in `pptx-viewer-shared` and are
 * re-exported below for API stability.
 */
export type { CanvasSize, CollaborationConfig, CollaborationRole };

/**
 * Props for `<PowerPointViewer>`.
 *
 * Mirrors the React `PowerPointViewerProps`, minus the function callbacks
 * (which become emits).
 */
export interface PowerPointViewerProps {
	/** PowerPoint content as Uint8Array (or ArrayBuffer). */
	content: Uint8Array | ArrayBuffer;
	/** Licensed font sources supplied by the host application. */
	fonts?: ViewerFontSource[];
	/** Original file path, used for autosave recovery. */
	filePath?: string;
	/** Display name of the open document, shown in the title bar. */
	fileName?: string;
	/** Whether editing actions are enabled. */
	canEdit?: boolean;
	/** Enable debounced autosave (emits `@autosave` with serialised bytes). */
	autosave?: boolean;
	/** Autosave debounce window in milliseconds (default 2000). */
	autosaveIntervalMs?: number;
	/** Optional class name applied to the root element. */
	class?: string;
	/**
	 * Display name used as the author for comments and annotations.
	 * Falls back to `collaboration.userName` when collaborating, or `'You'`.
	 */
	authorName?: string;
	/**
	 * Theme configuration for customising the viewer's appearance.
	 *
	 * Accepts partial color overrides, a custom border-radius, and arbitrary
	 * CSS custom properties. Unset values fall back to the built-in dark theme.
	 *
	 * @see {@link ViewerTheme}
	 */
	theme?: ViewerTheme;
	/**
	 * Optional real-time collaboration configuration. When provided, the viewer
	 * joins a Yjs session (y-websocket or serverless y-webrtc) with live cursors,
	 * remote selections, follow mode and elected-writer write-back.
	 */
	collaboration?: CollaborationConfig;
	/** Default values for the Share dialog fields. */
	shareDefaults?: {
		roomId?: string;
		userName?: string;
		serverUrl?: string;
	};
	/**
	 * Host override for the File ▸ Open action. When provided, the built-in
	 * native file picker is bypassed and this is invoked instead; the host is
	 * then responsible for supplying a new `content` value. When omitted, the
	 * viewer opens its own picker and loads the chosen presentation in place.
	 */
	onOpenFile?: () => void;
	/**
	 * Opt in to the experimental Three.js SmartArt renderer. When `true`,
	 * SmartArt diagrams render as extruded 3D blocks on a WebGL canvas instead
	 * of flat SVG. Requires the optional `three` peer dependency; when it is not
	 * installed (or the diagram has no geometry), the viewer transparently falls
	 * back to the SVG SmartArt renderer. Default `false`.
	 */
	smartArt3D?: boolean;
	/**
	 * Individual toolbar buttons and/or ribbon tabs to hide, letting a host
	 * curate the chrome instead of only the all-or-nothing `canEdit` toggle.
	 * Omit (default) to show everything, matching prior behaviour.
	 *
	 * @see {@link ToolbarActionId}
	 */
	hiddenActions?: ToolbarActionId[];
	/**
	 * Initial theme-catalog selection key (e.g. `'vermilionDark'`), used only
	 * when no persisted preference exists. Has no effect when the `theme` prop
	 * is set: an explicit `theme` always wins over the catalog selection.
	 */
	defaultThemeKey?: string;
	/**
	 * Theme choices offered by File > Options > Appearance. Defaults to the
	 * shared `THEME_CATALOG` (default / light / vermilion light / vermilion
	 * dark).
	 */
	availableThemes?: ThemeCatalogEntry[];
	/**
	 * Host hook for the File > Options > Appearance theme picker. When
	 * provided, the host owns persisting the choice (only this callback is
	 * invoked); when omitted, the viewer persists the choice to `localStorage`
	 * itself via the shared `writeStoredViewerPrefs`.
	 */
	onThemeChange?: (key: string) => void;
	/**
	 * Initial locale code (e.g. `'fr'`), used only when no persisted
	 * preference exists.
	 */
	defaultLocale?: string;
	/**
	 * Locale choices offered by File > Options > Language. Defaults to every
	 * locale registered with the host's `vue-i18n` instance (via
	 * `useI18n().availableLocales`), mapped through the shared
	 * `LOCALE_CATALOG` for display labels.
	 */
	availableLocales?: LocaleCatalogEntry[];
	/**
	 * Host hook for the File > Options > Language picker. When provided, the
	 * host owns applying and persisting the locale switch (the viewer leaves
	 * its own `vue-i18n` `locale` ref untouched); when omitted, the viewer
	 * sets `locale.value` itself and persists the choice to `localStorage`.
	 */
	onLocaleChange?: (code: string) => void;
	/**
	 * Optional sign-in hook point for File > Account. Disabled by default: the
	 * Account page renders nothing extra unless `enabled: true` is passed.
	 */
	accountAuth?: AccountAuthConfig;
}

/**
 * Events emitted by `<PowerPointViewer>`.
 *
 * These replace the React function-prop callbacks:
 *  - `onDirtyChange`       → `@dirty-change`
 *  - `onContentChange`     → `@content-change`
 *  - `onActiveSlideChange` → `@active-slide-change`
 *  - `onModeChange`        → `@mode-change`
 *  - `onZoomChange`        → `@zoom-change`
 *  - `onSelectionChange`   → `@selection-change`
 *  - `onSlideCountChange`  → `@slide-count-change`
 */
export interface PowerPointViewerEmits {
	/** Fired when the unsaved-changes flag toggles. */
	(e: 'dirty-change', isDirty: boolean): void;
	/**
	 * Fired with serialised bytes on each in-memory content change (after
	 * edits) and when autosave persists the presentation.
	 */
	(e: 'content-change' | 'autosave', content: Uint8Array): void;
	/** Fired when the active slide, zoom level, or slide count changes. */
	(e: 'active-slide-change' | 'zoom-change' | 'slide-count-change', value: number): void;
	/** Fired when the viewer mode changes. */
	(e: 'mode-change', mode: string): void;
	/** Fired when element selection changes. */
	(e: 'selection-change', elementIds: string[]): void;
	/** Fired when the user starts a collaboration session from the Share dialog. */
	(e: 'start-collaboration', config: CollaborationConfig): void;
	/** Fired when the user stops a collaboration session from the Share dialog. */
	(e: 'stop-collaboration'): void;
}

/**
 * Imperative surface exposed via `defineExpose`, retrievable through a
 * template ref. Implements the shared {@link PowerPointViewerAPI} contract.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';
 * const viewer = ref<PowerPointViewerExpose>();
 * async function save() {
 *   const bytes = await viewer.value!.getContent();
 * }
 * </script>
 * ```
 */
export interface PowerPointViewerExpose extends PowerPointViewerAPI {
	/** Serialise the current presentation to `.pptx` bytes. */
	getContent: () => Promise<Uint8Array>;
}
