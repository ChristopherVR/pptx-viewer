/**
 * The slide-show chrome, described once for all five bindings.
 *
 * `presentation-toolbar.ts` already shares the toolbar's BEHAVIOUR (trigger
 * zone, auto-hide delay, colour swatches, counter format). What it never shared
 * is the toolbar's CONTENT, and that is exactly what drifted: React shipped
 * prev / counter / next / elapsed / laser / pen+colour / highlighter+colour /
 * eraser / clear / presenter-view / end, Vue re-labelled half of those from a
 * different i18n namespace, Angular shipped a bottom-LEFT strip of four tools
 * plus a captions button and no navigation at all, and Vanilla and Svelte
 * shipped no show toolbar whatsoever, which on a desktop left a presenter with
 * no visible way to leave the show.
 *
 * So the inventory and the measurements live here, next to `chrome-metrics.ts`
 * which did the same job for the title and status bars, and every binding
 * derives its bar from these constants:
 *
 *   - React, Vue and Angular apply {@link PRESENT_TOOLBAR_CLASSES} (Tailwind).
 *   - Vanilla interpolates {@link PRESENT_TOOLBAR_METRICS} into its CSS-in-TS.
 *   - Svelte reads {@link presentToolbarCssVars} off an inline `style`
 *     attribute, because its scoped `<style>` is compiled and cannot see a
 *     TypeScript value.
 *
 * `present-chrome.test.ts` asserts the Tailwind tokens still encode exactly the
 * numbers below, which is what stops the two representations drifting apart.
 *
 * @module render/present-chrome
 */

/** What a slot in the show toolbar is, structurally. */
export type PresentToolbarControlKind =
	/** Plain action button (navigate, clear, end the show). */
	| 'button'
	/** Stateful toggle: an annotation tool or the presenter-view switch. */
	| 'toggle'
	/** Narrow caret opening a colour palette for the toggle before it. */
	| 'caret'
	/** Read-only "3 / 14" slide counter. */
	| 'counter'
	/** Read-only elapsed-time readout. */
	| 'timer'
	/** Vertical hairline between groups. */
	| 'divider';

/** One slot in the show toolbar, left to right. */
export interface PresentToolbarControl {
	/** Stable id; also the `data-pptx-present-control` value each binding emits. */
	id: string;
	kind: PresentToolbarControlKind;
	/**
	 * i18n key for the accessible name. Dividers have none; the counter's name
	 * is its own text.
	 */
	labelKey?: string;
	/** Lucide icon name in kebab-case, or `undefined` for text-only slots. */
	icon?: string;
}

/**
 * The show toolbar, in order.
 *
 * The keys are the ones React already renders, so aligning a binding to this
 * list cannot silently rename a control that a parity spec matches by
 * accessible name. Two of the five had picked up near-miss duplicates from
 * other namespaces (`pptx.mobileBar.previousSlide` is "Previous slide", not
 * "Previous Slide"; `pptx.presentationToolbar.clearAnnotations` is "Clear
 * annotations", not "Clear Annotations"), which read identically in a
 * screenshot and differently to a screen reader or a role query.
 */
export const PRESENT_TOOLBAR_CONTROLS: readonly PresentToolbarControl[] = [
	{
		id: 'previous',
		kind: 'button',
		labelKey: 'pptx.presenter.previousSlide',
		icon: 'chevron-left',
	},
	{ id: 'counter', kind: 'counter' },
	{ id: 'next', kind: 'button', labelKey: 'pptx.presenter.nextSlide', icon: 'chevron-right' },
	{ id: 'divider-navigation', kind: 'divider' },
	{ id: 'timer', kind: 'timer', labelKey: 'pptx.presenter.elapsed', icon: 'timer' },
	{ id: 'divider-timer', kind: 'divider' },
	{
		id: 'laser',
		kind: 'toggle',
		labelKey: 'pptx.presentation.laserPointer',
		icon: 'mouse-pointer-2',
	},
	{ id: 'pen', kind: 'toggle', labelKey: 'pptx.presentation.pen', icon: 'pen-tool' },
	{
		id: 'pen-color',
		kind: 'caret',
		labelKey: 'pptx.presentationToolbar.penColor',
		icon: 'chevron-down',
	},
	{
		id: 'highlighter',
		kind: 'toggle',
		labelKey: 'pptx.presentation.highlighter',
		icon: 'highlighter',
	},
	{
		id: 'highlighter-color',
		kind: 'caret',
		labelKey: 'pptx.presentationToolbar.highlighterColor',
		icon: 'chevron-down',
	},
	{ id: 'eraser', kind: 'toggle', labelKey: 'pptx.presentation.eraser', icon: 'eraser' },
	{
		// One-click blackboard: arms the black screen AND the pen together (see
		// render/presentation-blackboard.ts for the state + layering rules).
		id: 'blackboard',
		kind: 'toggle',
		labelKey: 'pptx.presentation.blackboard',
		icon: 'presentation',
	},
	{ id: 'clear', kind: 'button', labelKey: 'pptx.presentation.clearAnnotations', icon: 'trash-2' },
	{ id: 'divider-tools', kind: 'divider' },
	{
		id: 'presenter-view',
		kind: 'toggle',
		labelKey: 'pptx.presenter.presenterView',
		icon: 'panel-right',
	},
	{ id: 'end', kind: 'button', labelKey: 'pptx.presenter.endPresentation', icon: 'x' },
] as const;

/** The toolbar's control ids in render order, for tests and parity specs. */
export const PRESENT_TOOLBAR_ORDER: readonly string[] = PRESENT_TOOLBAR_CONTROLS.map(
	(control) => control.id,
);

/**
 * The accessible-name i18n keys, in order, skipping the slots that have none.
 * A parity spec resolves these through the dictionary rather than hard-coding
 * English, so the inventory survives a translation change.
 */
export const PRESENT_TOOLBAR_LABEL_KEYS: readonly string[] = PRESENT_TOOLBAR_CONTROLS.flatMap(
	(control) => (control.labelKey === undefined ? [] : [control.labelKey]),
);

/** Show-toolbar measurements, in CSS pixels unless the name says otherwise. */
export const PRESENT_TOOLBAR_METRICS = {
	/** Square control edge length (`w-9 h-9`). */
	buttonSize: 36,
	/** Colour-caret width; it shares the button height (`w-7 h-9`). */
	caretWidth: 28,
	/** Overlap pulling a caret against its tool button (`-ml-1`). */
	caretOverlap: 4,
	/** Icon edge length inside a button (`size={18}`). */
	iconSize: 18,
	/** Icon edge length inside a colour caret (`size={12}`). */
	caretIconSize: 12,
	/** Icon edge length beside the elapsed readout (`size={14}`). */
	timerIconSize: 14,
	/** Flex gap between the bar's direct children (`gap-1`). */
	gap: 4,
	/** Horizontal padding on the bar (`px-3`). */
	paddingX: 12,
	/** Vertical padding on the bar (`py-2`). */
	paddingY: 8,
	/** Bar corner radius (`rounded-xl`). */
	radius: 12,
	/** Control corner radius (`rounded-md`). */
	controlRadius: 6,
	/** Bar background (`bg-neutral-900/90`). */
	background: 'rgb(23 23 23 / 90%)',
	/** Bar border colour (`border-white/15`). */
	borderColor: 'rgb(255 255 255 / 15%)',
	/** Divider width (`w-px`). */
	dividerWidth: 1,
	/** Divider height (`h-6`). */
	dividerHeight: 24,
	/** Divider horizontal margin (`mx-1`). */
	dividerMarginX: 4,
	/** Divider colour (`bg-white/20`). */
	dividerColor: 'rgb(255 255 255 / 20%)',
	/** Counter minimum width, so the bar does not jitter as digits change. */
	counterMinWidth: 48,
	/** Counter / timer font size (`text-xs`). */
	fontSize: 12,
	/**
	 * Counter / timer line height (`text-xs` is 12px/16px, not 12px/1).
	 *
	 * Spelled out because the hand-ported bindings reach for `font: 12px/1` and
	 * land a 12px-tall readout next to React's 16px one, which shifts the bar's
	 * own height and every baseline in it.
	 */
	lineHeight: 16,
	/** Gap between the timer icon and its readout (`gap-1.5`). */
	timerGap: 6,
	/** Distance from the bottom of the show surface to the bar (`bottom-6`). */
	bottomOffset: 24,
	/** Stacking order of the bar over the stage (`z-[80]`). */
	zIndex: 80,
	/** Fade duration when the bar auto-hides or returns (`duration-300`). */
	fadeMs: 300,
	/** Colour-palette swatch edge length. */
	swatchSize: 36,
	/** Colour-palette columns (`grid-cols-4`). */
	paletteColumns: 4,
	/** Colour-palette gap (`gap-2`) and padding (`p-3`). */
	paletteGap: 8,
	palettePadding: 12,
	/** Underline marking a tool's current colour (`w-3 h-0.5`). */
	swatchBarWidth: 12,
	swatchBarHeight: 2,
} as const;

/**
 * Tailwind tokens for the show toolbar, applied by React, Vue and Angular.
 *
 * Expressed as whole class strings rather than assembled per call site: three
 * bindings each writing `w-9 h-9 rounded-md ...` by hand is precisely how the
 * caret ended up 18px wide in one of them and 28px in another.
 */
export const PRESENT_TOOLBAR_CLASSES = {
	/** The floating bar itself. */
	container:
		'flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-900/90 backdrop-blur-md border border-white/15 shadow-2xl',
	/** The auto-hiding positioner the bar sits in. */
	wrapper: 'absolute bottom-6 left-1/2 -translate-x-1/2 z-[80] transition-opacity duration-300',
	/** Navigation / action button. */
	button:
		'flex items-center justify-center w-9 h-9 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed',
	/** Annotation-tool toggle, inactive. */
	toggle:
		'relative flex items-center justify-center w-9 h-9 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10',
	/** Annotation-tool toggle, active. */
	toggleActive:
		'relative flex items-center justify-center w-9 h-9 rounded-md transition-colors bg-white/25 text-white',
	/** Colour caret beside a tool toggle. */
	caret:
		'flex items-center justify-center w-7 h-9 -ml-1 rounded-r-md transition-colors text-white/50 hover:text-white hover:bg-white/10',
	/** Vertical hairline between groups. */
	divider: 'w-px h-6 bg-white/20 mx-1',
	/** Slide counter. */
	counter:
		'text-xs font-mono tabular-nums text-white/80 px-1.5 select-none min-w-[48px] text-center',
	/** Elapsed-time readout. */
	timer: 'flex items-center gap-1.5 text-xs font-mono tabular-nums text-white/60 px-1 select-none',
	/**
	 * Colour palette popover.
	 *
	 * `w-max` is load-bearing. An absolutely positioned grid shrink-to-fits its
	 * positioned ancestor, which here is the 64px tool+caret pair, so without it
	 * the four 36px swatch columns are squeezed into 50px and overlap each other
	 * to the point that a swatch cannot be clicked. React shipped it that way,
	 * and the ports faithfully reproduced the defect.
	 */
	palette:
		'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 w-max bg-neutral-800 rounded-lg border border-white/20 shadow-xl grid grid-cols-4 gap-2',
	/** One colour swatch inside the palette. */
	swatch: 'w-9 h-9 rounded-full border-2 transition-transform hover:scale-110',
	/** Underline showing a tool's current colour. */
	swatchBar: 'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full',
} as const;

/**
 * The show-toolbar metrics as CSS custom properties, for the two bindings that
 * cannot read a Tailwind class (Vanilla's CSS-in-TS, Svelte's scoped style).
 */
export function presentToolbarCssVars(): Record<string, string> {
	const m = PRESENT_TOOLBAR_METRICS;
	return {
		'--pptx-pt-button': `${String(m.buttonSize)}px`,
		'--pptx-pt-caret': `${String(m.caretWidth)}px`,
		'--pptx-pt-caret-overlap': `${String(m.caretOverlap)}px`,
		'--pptx-pt-icon': `${String(m.iconSize)}px`,
		'--pptx-pt-caret-icon': `${String(m.caretIconSize)}px`,
		'--pptx-pt-timer-icon': `${String(m.timerIconSize)}px`,
		'--pptx-pt-gap': `${String(m.gap)}px`,
		'--pptx-pt-pad-x': `${String(m.paddingX)}px`,
		'--pptx-pt-pad-y': `${String(m.paddingY)}px`,
		'--pptx-pt-radius': `${String(m.radius)}px`,
		'--pptx-pt-control-radius': `${String(m.controlRadius)}px`,
		'--pptx-pt-bg': m.background,
		'--pptx-pt-border': m.borderColor,
		'--pptx-pt-divider-w': `${String(m.dividerWidth)}px`,
		'--pptx-pt-divider-h': `${String(m.dividerHeight)}px`,
		'--pptx-pt-divider-mx': `${String(m.dividerMarginX)}px`,
		'--pptx-pt-divider-color': m.dividerColor,
		'--pptx-pt-counter-min': `${String(m.counterMinWidth)}px`,
		'--pptx-pt-font-size': `${String(m.fontSize)}px`,
		'--pptx-pt-line-height': `${String(m.lineHeight)}px`,
		'--pptx-pt-timer-gap': `${String(m.timerGap)}px`,
		'--pptx-pt-bottom': `${String(m.bottomOffset)}px`,
		'--pptx-pt-z': String(m.zIndex),
		'--pptx-pt-fade': `${String(m.fadeMs)}ms`,
		'--pptx-pt-swatch': `${String(m.swatchSize)}px`,
		'--pptx-pt-palette-cols': String(m.paletteColumns),
		'--pptx-pt-palette-gap': `${String(m.paletteGap)}px`,
		'--pptx-pt-palette-pad': `${String(m.palettePadding)}px`,
		'--pptx-pt-swatch-bar-w': `${String(m.swatchBarWidth)}px`,
		'--pptx-pt-swatch-bar-h': `${String(m.swatchBarHeight)}px`,
	};
}

/** {@link presentToolbarCssVars} flattened into an inline `style` attribute. */
export function presentToolbarStyleAttr(): string {
	return Object.entries(presentToolbarCssVars())
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
}
