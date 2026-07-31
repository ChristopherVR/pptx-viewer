/**
 * The app chrome's measurements, as plain values.
 *
 * `TITLE_BAR_CLASSES` (see `./title-bar`) already pins the title bar's look,
 * but it pins it as Tailwind class strings. Only React, Vue and Angular can
 * consume those: the Vanilla binding builds its stylesheet as a CSS-in-TS
 * template and the Svelte binding writes a scoped `<style>` block, and neither
 * can read a utility class. So both hand-ported the same look by eye, and both
 * drifted (a 34px bar, a `#d24726` logo, a knob resting 16px along its track).
 *
 * These constants are that same design, expressed as numbers a stylesheet can
 * actually interpolate, so all five bindings derive the chrome from one source.
 * `chrome-metrics.test.ts` asserts the Tailwind tokens still encode exactly
 * these values, which is what stops the two representations drifting apart.
 *
 * @module render/chrome-metrics
 */

/** Title-bar measurements, in CSS pixels unless the name says otherwise. */
export const TITLE_BAR_METRICS = {
	/** Row height (`h-9`). */
	height: 36,
	/** Flex gap between the row's direct children (`gap-1`). */
	gap: 4,
	/** Horizontal padding on the row (`px-2`). */
	paddingX: 8,
	/** Base font size for the row (`text-[11px]`). */
	fontSize: 11,
	/** Square app mark edge length (`w-5 h-5`). */
	logoSize: 20,
	/** App mark font size (`text-[10px]`). */
	logoFontSize: 10,
	/** App mark background (`bg-[#c43e1c]`), PowerPoint's brand red. */
	logoBackground: '#c43e1c',
	/** App mark corner radius (`rounded-sm`). */
	logoRadius: 3,
	/** AutoSave switch track width (`w-7`). */
	switchTrackWidth: 28,
	/** AutoSave switch track height (`h-3.5`). */
	switchTrackHeight: 14,
	/** AutoSave knob edge length (`w-2.5 h-2.5`). */
	switchKnobSize: 10,
	/** Knob offset from the track's left edge when off (`translate-x-0.5`). */
	switchKnobOffsetOff: 2,
	/** Knob offset from the track's left edge when on (`translate-x-[15px]`). */
	switchKnobOffsetOn: 15,
	/** File-name font size (`text-[12px]`). */
	fileNameFontSize: 12,
	/** File-name font weight (`font-medium`). */
	fileNameFontWeight: 500,
	/** Vertical rule between chrome groups (`h-4`). */
	separatorHeight: 16,
} as const;

/**
 * Status-bar measurements.
 *
 * Unlike the title bar the status bar has never had a shared class token, so
 * every binding sized it from its own content box and two of the five landed
 * 2px short. Pinning the height here (and applying {@link STATUS_BAR_CLASSES}
 * in the Tailwind bindings) makes the number authoritative rather than
 * emergent, so a future padding change cannot silently resize one binding.
 */
export const STATUS_BAR_METRICS = {
	/** Total row height including the top border. */
	height: 29,
} as const;

/**
 * Tailwind token for the status-bar row, applied by React, Vue and Angular.
 *
 * A floor rather than a fixed height: the row must still grow if a host's font
 * stack makes its content taller, exactly as it did before this was pinned.
 */
export const STATUS_BAR_CLASSES = {
	container: 'min-h-[29px]',
} as const;

/**
 * The title-bar metrics as CSS custom properties.
 *
 * Vanilla interpolates numbers straight into its CSS-in-TS, but Svelte's
 * scoped `<style>` is compiled ahead of time and cannot see a TypeScript
 * value, so it reads these variables off an inline `style` attribute instead.
 * Both paths therefore end at the same constants.
 */
export function titleBarCssVars(): Record<string, string> {
	const m = TITLE_BAR_METRICS;
	return {
		'--pptx-tb-height': `${String(m.height)}px`,
		'--pptx-tb-gap': `${String(m.gap)}px`,
		'--pptx-tb-pad-x': `${String(m.paddingX)}px`,
		'--pptx-tb-font-size': `${String(m.fontSize)}px`,
		'--pptx-tb-logo-size': `${String(m.logoSize)}px`,
		'--pptx-tb-logo-font-size': `${String(m.logoFontSize)}px`,
		'--pptx-tb-logo-bg': m.logoBackground,
		'--pptx-tb-logo-radius': `${String(m.logoRadius)}px`,
		'--pptx-tb-switch-w': `${String(m.switchTrackWidth)}px`,
		'--pptx-tb-switch-h': `${String(m.switchTrackHeight)}px`,
		'--pptx-tb-knob-size': `${String(m.switchKnobSize)}px`,
		'--pptx-tb-knob-off': `${String(m.switchKnobOffsetOff)}px`,
		// The knob is positioned at `switchKnobOffsetOff` and moved by a
		// transform, so the "on" travel is the difference, not the offset.
		'--pptx-tb-knob-travel': `${String(m.switchKnobOffsetOn - m.switchKnobOffsetOff)}px`,
		'--pptx-tb-file-size': `${String(m.fileNameFontSize)}px`,
		'--pptx-tb-file-weight': String(m.fileNameFontWeight),
		'--pptx-tb-separator-h': `${String(m.separatorHeight)}px`,
		'--pptx-status-height': `${String(STATUS_BAR_METRICS.height)}px`,
	};
}

/** {@link titleBarCssVars} flattened into an inline `style` attribute value. */
export function titleBarStyleAttr(): string {
	return Object.entries(titleBarCssVars())
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
}
