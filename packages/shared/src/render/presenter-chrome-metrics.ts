/**
 * `presenter-chrome-metrics` - the presenter console's measurements, in the two
 * representations the five bindings can consume.
 *
 * Split out of `presenter-chrome.ts` purely to keep both files inside the
 * repo's 300-line ceiling; the inventory lives there, the geometry lives here,
 * and `presenter-chrome.test.ts` asserts the Tailwind strings below still
 * encode the numbers in {@link PRESENTER_LAYOUT_METRICS}.
 *
 * Every number here was a magic constant in at least three bindings before this
 * module: the rail was 260..440 wide in React and Vue but 300..460 in Svelte,
 * the navigator grid used three different track sizes and gaps, and the console
 * root sat at `z-index` 50, 100 and 120 depending on which file you opened.
 *
 * @module render/presenter-chrome-metrics
 */

/** Presenter-console measurements, in CSS pixels unless the name says otherwise. */
export const PRESENTER_LAYOUT_METRICS = {
	/**
	 * Flex growth of the current-slide pane against the rail (`flex-[7]` /
	 * `flex-[3]`), i.e. PowerPoint's roughly 70/30 console split.
	 */
	mainFlex: 7,
	railFlex: 3,
	/** Rail width bounds (`min-w-[260px] max-w-[440px]`). */
	railMinWidth: 260,
	railMaxWidth: 440,
	/** Padding around the current-slide pane (`p-6`). */
	mainPadding: 24,
	/** Stacking order of the console over the show stage (`z-50`). */
	zIndex: 50,
	/** Stacking order of the "all slides" navigator over the console (`z-[120]`). */
	navigatorZIndex: 120,
	/** Console strip control edge length (`h-9 min-w-9`). */
	controlSize: 36,
	/** Icon edge length inside a strip control. */
	controlIconSize: 16,
	/** Flex gap between strip children (`gap-1`). */
	stripGap: 4,
	/** Strip padding (`px-3 py-2`). */
	stripPaddingX: 12,
	stripPaddingY: 8,
	/** Control corner radius (`rounded-md`). */
	controlRadius: 6,
	/** Divider width / height / margin (`w-px h-6 mx-1`). */
	dividerWidth: 1,
	dividerHeight: 24,
	dividerMarginX: 4,
	/** Timer progress bar height (`h-1.5`). */
	progressHeight: 6,
	/** Next-slide preview target width, before aspect-ratio scaling. */
	nextPreviewWidth: 240,
	/** Navigator grid track minimum and gap (`minmax(220px,1fr)`, `gap-5`). */
	navigatorTrackMin: 220,
	navigatorGap: 20,
	/** Navigator tile preview width. */
	navigatorTileWidth: 200,
	/** Opacity of a hidden slide's navigator tile: dimmed, never omitted. */
	hiddenSlideOpacity: 0.45,
} as const;

/**
 * Tailwind tokens for the presenter console, applied by React, Vue and Angular.
 *
 * Whole class strings rather than per-call-site assembly, for the reason
 * `present-chrome.ts` gives: three bindings hand-writing `h-9 min-w-9 rounded-md
 * ...` is how one of them ended up with a differently sized strip.
 */
export const PRESENTER_CONSOLE_CLASSES = {
	/** The console root, laid over the show stage. */
	root: 'absolute inset-0 z-50 flex flex-col bg-card text-foreground',
	/** The control strip across the top. */
	strip: 'flex flex-wrap items-center gap-1 border-b border-border bg-card px-3 py-2',
	/** A strip control, inactive. */
	control:
		'inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md px-2 text-xs transition-colors bg-muted text-foreground hover:bg-accent',
	/** A strip control, active. */
	controlActive:
		'inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md px-2 text-xs transition-colors bg-primary text-primary-foreground',
	/** Vertical hairline between strip groups. */
	divider: 'mx-1 h-6 w-px bg-border',
	/** Flexible gap pushing the trailing group right. */
	spacer: 'flex-1',
	/** The body row: current-slide pane plus rail. */
	body: 'flex flex-1 min-h-0',
	/** The current-slide pane. */
	main: 'relative flex-[7] flex flex-col items-center justify-center bg-black p-6 min-w-0 overflow-hidden',
	/** The right-hand rail. */
	rail: 'flex flex-[3] min-w-[260px] max-w-[440px] flex-col border-l border-border bg-background',
	/** Rail section heading (Current Time / Next Slide / Speaker Notes). */
	railHeading: 'text-[10px] uppercase tracking-wider text-muted-foreground',
	/** Timer progress bar track. */
	progressTrack: 'h-1.5 w-full bg-muted/60 flex-shrink-0',
	/** Timer progress bar fill. */
	progressFill: 'h-full bg-primary transition-[width] duration-1000 ease-linear',
	/** The "all slides" navigator overlay. */
	navigator: 'absolute inset-0 z-[120] overflow-auto bg-card p-6',
	/** The navigator's tile grid. */
	navigatorGrid: 'grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]',
} as const;

/**
 * The console metrics as CSS custom properties, for the two bindings that
 * cannot read a Tailwind class (Vanilla's CSS-in-TS, Svelte's scoped style).
 */
export function presenterConsoleCssVars(): Record<string, string> {
	const m = PRESENTER_LAYOUT_METRICS;
	return {
		'--pptx-pv-main-flex': String(m.mainFlex),
		'--pptx-pv-rail-flex': String(m.railFlex),
		'--pptx-pv-rail-min': `${String(m.railMinWidth)}px`,
		'--pptx-pv-rail-max': `${String(m.railMaxWidth)}px`,
		'--pptx-pv-main-pad': `${String(m.mainPadding)}px`,
		'--pptx-pv-z': String(m.zIndex),
		'--pptx-pv-nav-z': String(m.navigatorZIndex),
		'--pptx-pv-control': `${String(m.controlSize)}px`,
		'--pptx-pv-control-icon': `${String(m.controlIconSize)}px`,
		'--pptx-pv-strip-gap': `${String(m.stripGap)}px`,
		'--pptx-pv-strip-pad-x': `${String(m.stripPaddingX)}px`,
		'--pptx-pv-strip-pad-y': `${String(m.stripPaddingY)}px`,
		'--pptx-pv-control-radius': `${String(m.controlRadius)}px`,
		'--pptx-pv-divider-w': `${String(m.dividerWidth)}px`,
		'--pptx-pv-divider-h': `${String(m.dividerHeight)}px`,
		'--pptx-pv-divider-mx': `${String(m.dividerMarginX)}px`,
		'--pptx-pv-progress-h': `${String(m.progressHeight)}px`,
		'--pptx-pv-next-preview-w': `${String(m.nextPreviewWidth)}px`,
		'--pptx-pv-nav-track-min': `${String(m.navigatorTrackMin)}px`,
		'--pptx-pv-nav-gap': `${String(m.navigatorGap)}px`,
		'--pptx-pv-nav-tile-w': `${String(m.navigatorTileWidth)}px`,
		'--pptx-pv-hidden-opacity': String(m.hiddenSlideOpacity),
	};
}

/** {@link presenterConsoleCssVars} flattened into an inline `style` attribute. */
export function presenterConsoleStyleAttr(): string {
	return Object.entries(presenterConsoleCssVars())
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
}
