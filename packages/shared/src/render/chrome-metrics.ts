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
 * Compatibility-toast stack measurements.
 *
 * The stack sits in the bottom-right corner of the viewer chrome, ABOVE the
 * status bar: anchored to the viewer root with a bottom inset of the status
 * bar's height plus a margin. Every binding first anchored it `bottom: 12px`
 * of whatever box happened to contain it, and in React that box included the
 * status bar, so a single toast covered the "Slide show" button (the e2e
 * parity suite could not start a show while a warning was up).
 */
export const COMPAT_TOAST_METRICS = {
	/** Distance from the viewer's right edge (`right-3`). */
	insetRight: 12,
	/** Clearance between the stack and the status bar's top edge (`bottom-3`). */
	marginAboveStatusBar: 12,
	/** Stack width (`w-80`). */
	width: 320,
	/** Vertical gap between stacked toasts (`gap-2`). */
	gap: 8,
	/** Stacking order: above the canvas and inspector, below dialogs. */
	zIndex: 40,
} as const;

/**
 * Default width of the right-docked format/inspector panel (`w-72`), used by
 * the four bindings whose panel is a fixed size rather than user-resizable
 * (React's is resizable and threads its OWN live width instead; see
 * {@link compatToastStackStyle}'s `extraRightInset` parameter).
 */
export const INSPECTOR_PANEL_DEFAULT_WIDTH = 288;

/**
 * Inline style for the toast stack, positioned relative to the viewer root
 * (which must establish a containing block, as it already does in every
 * binding for the dialogs). Numbers are stringified with units so the record
 * can be spread straight onto a style object or joined into a `style`
 * attribute.
 *
 * `extraRightInset` (default 0) adds to the base `right` inset. The stack is
 * anchored to the viewer ROOT's right edge, which is the full chrome width,
 * INCLUDING the right-docked format/inspector (or AI chat) panel when one is
 * open: with `extraRightInset` at its default of 0, the stack's `right: 12px`
 * lands 12px from the viewer's true right edge, which is UNDER that panel,
 * not clear of it, so it renders on top of (and visually collides with) the
 * panel's own content instead of floating over the canvas. Pass that panel's
 * current width here (0 when no such panel is open) so the stack clears it.
 *
 * `extraBottomInset` (default 0) adds to the base `bottom` inset, which
 * otherwise only clears the status bar. All five bindings also render a
 * collapsed "Speaker notes" strip (and, expanded, a notes pane) BETWEEN the
 * canvas and the status bar, in the same viewer-root containing block the
 * stack is anchored to, so a plain status-bar-height `bottom` still leaves
 * the stack sitting UNDER that strip (measured: Angular's toast box at y
 * 877-959 overlapped its notes bar at 918-971). That strip's height differs
 * per binding and grows when the notes pane is expanded, so it cannot be a
 * fixed constant here: pass the strip's live measured height (0 when it is
 * not rendered, e.g. presentation mode or mobile, where it is either absent
 * or an overlay that does not sit between the canvas and the status bar).
 */
export function compatToastStackStyle(
	extraRightInset = 0,
	extraBottomInset = 0,
): Record<string, string> {
	const m = COMPAT_TOAST_METRICS;
	return {
		position: 'absolute',
		right: `${String(m.insetRight + extraRightInset)}px`,
		bottom: `${String(STATUS_BAR_METRICS.height + m.marginAboveStatusBar + extraBottomInset)}px`,
		width: `${String(m.width)}px`,
		maxWidth: `calc(100% - ${String(m.insetRight + extraRightInset)}px)`,
		zIndex: String(m.zIndex),
		display: 'flex',
		flexDirection: 'column',
		gap: `${String(m.gap)}px`,
		pointerEvents: 'none',
	};
}

/** {@link compatToastStackStyle} flattened into an inline `style` attribute value. */
export function compatToastStackStyleAttr(extraRightInset = 0, extraBottomInset = 0): string {
	return styleRecordToAttr(compatToastStackStyle(extraRightInset, extraBottomInset));
}

/**
 * The `ppaction://program` ("Run program") notice stack shown during a
 * RUNNING show.
 *
 * Deliberately not {@link compatToastStackStyle}: that stack is positioned
 * `absolute` relative to the viewer root and inset above the status bar,
 * neither of which exists once the show's full-viewport stage is up, so a
 * notice placed with it rendered UNDER the stage in React (the Copy button
 * was visible but the stage intercepted every click). This one is `fixed`,
 * bottom-right, safe-area aware, and stacks above every piece of show chrome
 * (edge-navigation buttons, close button, subtitle bar) so the presenter can
 * always reach Copy. `pointerEvents: none` on the stack itself keeps its
 * empty margins from swallowing click-to-advance; each notice re-enables
 * pointer events on its own card.
 */
export const RUN_PROGRAM_NOTICE_METRICS = {
	/** Clearance from the viewport's safe-area edges. */
	inset: '0.5rem',
	/** Card width, matching the compatibility-toast stack. */
	width: 320,
	/** Vertical gap between stacked notices. */
	gap: '0.5rem',
	/** Above the show's own overlay chrome (whose highest control sits at 10002). */
	zIndex: 10003,
} as const;

/** Inline style for the run-program notice stack (see {@link RUN_PROGRAM_NOTICE_METRICS}). */
export function runProgramNoticeStackStyle(): Record<string, string> {
	const m = RUN_PROGRAM_NOTICE_METRICS;
	return {
		position: 'fixed',
		bottom: `calc(env(safe-area-inset-bottom, 0px) + ${m.inset})`,
		right: `calc(env(safe-area-inset-right, 0px) + ${m.inset})`,
		width: `${String(m.width)}px`,
		maxWidth: 'calc(100vw - 1rem)',
		zIndex: String(m.zIndex),
		display: 'flex',
		flexDirection: 'column',
		gap: m.gap,
		pointerEvents: 'none',
	};
}

/** {@link runProgramNoticeStackStyle} flattened into an inline `style` attribute value. */
export function runProgramNoticeStackStyleAttr(): string {
	return styleRecordToAttr(runProgramNoticeStackStyle());
}

/** camelCase style record -> `name:value;name:value` inline attribute value. */
function styleRecordToAttr(record: Record<string, string>): string {
	return Object.entries(record)
		.map(
			([name, value]) =>
				`${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}:${value}`,
		)
		.join(';');
}

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
