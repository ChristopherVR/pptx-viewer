/**
 * The presenter view (PowerPoint's "presenter console"), described once for all
 * five bindings.
 *
 * `presenter-view.ts` already shares the presenter console's ARITHMETIC (elapsed
 * formatting, notes font-size clamping, rich-notes -> span spec) and
 * `presenter-console.ts` its STATE helpers (timer, zoom, pointer, ink). What was
 * never shared is the console's CONTENT, and that is what drifted, in exactly
 * the way `present-chrome.ts` documents for the show toolbar:
 *
 *   - React ships a 16-slot strip whose accessible names are hard-coded English
 *     `title` attributes, so the console is untranslatable in every locale.
 *   - Vue renders its strip ONLY in the empty-deck branch, so with a real deck
 *     the console has no timer, zoom, annotation, blackout, captions or end
 *     control at all.
 *   - Angular re-labels the same strip in a component with no `translate` pipe,
 *     orders zoom `-` before `+` (React orders `+` first), and calls reset-zoom
 *     "Fit".
 *   - Vanilla has no presenter view whatsoever: `mountPresenterConsole` lays a
 *     button strip over the live show, with no current slide, next-slide
 *     preview, notes, clock or timer.
 *   - Svelte drops the timer progress bar, renders notes as plain text (losing
 *     every `notesSegments` run style) and clamps the notes font size to its own
 *     12..36 instead of the shared 10..32.
 *
 * So the inventory, the order, the label KEYS and the measurements live here,
 * and every binding derives its console from these constants:
 *
 *   - React, Vue and Angular apply {@link PRESENTER_CONSOLE_CLASSES} (Tailwind).
 *   - Vanilla interpolates {@link PRESENTER_LAYOUT_METRICS} into its CSS-in-TS.
 *   - Svelte reads {@link presenterConsoleCssVars} off an inline `style`
 *     attribute, because its scoped `<style>` is compiled and cannot see a
 *     TypeScript value.
 *
 * `presenter-chrome.test.ts` asserts the Tailwind tokens still encode exactly
 * the numbers here, which is what stops the two representations drifting.
 *
 * @module render/presenter-chrome
 */

/** What a slot in the presenter console's strip is, structurally. */
export type PresenterControlKind =
	/** Plain action button. */
	| 'button'
	/** Stateful toggle (annotation tool, blackout, captions, audience). */
	| 'toggle'
	/** Vertical hairline between groups. */
	| 'divider'
	/** Flexible gap pushing the trailing group to the right edge. */
	| 'spacer';

/** One slot in the presenter console's strip, left to right. */
export interface PresenterControl {
	/** Stable id; also the `data-pptx-presenter-control` value each binding emits. */
	id: string;
	kind: PresenterControlKind;
	/** i18n key for the accessible name. Dividers and spacers have none. */
	labelKey?: string;
	/**
	 * i18n key used instead of {@link labelKey} while the control is active, for
	 * the two slots whose name genuinely changes with state (the audience
	 * display opens or closes; nothing else does).
	 */
	activeLabelKey?: string;
	/** Lucide icon name in kebab-case, or `undefined` for text-only slots. */
	icon?: string;
	/** Lucide icon name while active, when it differs. */
	activeIcon?: string;
	/**
	 * Literal glyph rendered inside the control, for the two blackout switches
	 * PowerPoint labels `B` and `W`. These are NOT accessible names: every
	 * binding must still carry {@link labelKey} as an `aria-label`, or a screen
	 * reader announces the deck's black-screen switch as the letter "B".
	 */
	glyph?: string;
}

/**
 * The presenter console strip, in order.
 *
 * Order and ids follow React, which is the binding the parity specs measure
 * against. The label KEYS are new: React's strings were hard-coded English, so
 * adopting a key per slot is what makes the console translatable at all. Where
 * an existing key already carried the exact English React rendered, it is
 * reused rather than duplicated (`pptx.presentation.pen` and friends), because
 * a near-miss duplicate is precisely how `pptx.presenter.elapsed` and
 * `pptx.mpresenter.elapsed` came to coexist.
 */
export const PRESENTER_CONSOLE_CONTROLS: readonly PresenterControl[] = [
	{
		id: 'timer-toggle',
		kind: 'button',
		labelKey: 'pptx.presenter.toggleTimer',
		icon: 'circle-pause',
		activeIcon: 'circle-play',
	},
	{ id: 'timer-reset', kind: 'button', labelKey: 'pptx.presenter.resetTimer', icon: 'rotate-ccw' },
	{ id: 'divider-timer', kind: 'divider' },
	{
		id: 'all-slides',
		kind: 'button',
		labelKey: 'pptx.presenter.seeAllSlides',
		icon: 'grid-2x2',
	},
	{ id: 'zoom-in', kind: 'button', labelKey: 'pptx.presenter.zoomIn', icon: 'zoom-in' },
	{ id: 'zoom-out', kind: 'button', labelKey: 'pptx.presenter.zoomOut', icon: 'zoom-out' },
	{ id: 'zoom-reset', kind: 'button', labelKey: 'pptx.presenter.resetZoom', icon: 'scan' },
	{ id: 'divider-zoom', kind: 'divider' },
	{
		id: 'laser',
		kind: 'toggle',
		labelKey: 'pptx.presentation.laserPointer',
		icon: 'mouse-pointer-2',
	},
	{ id: 'pen', kind: 'toggle', labelKey: 'pptx.presentation.pen', icon: 'pen-tool' },
	{
		id: 'highlighter',
		kind: 'toggle',
		labelKey: 'pptx.presentation.highlighter',
		icon: 'highlighter',
	},
	{ id: 'eraser', kind: 'toggle', labelKey: 'pptx.presentation.eraser', icon: 'eraser' },
	{ id: 'divider-tools', kind: 'divider' },
	{ id: 'blackout-black', kind: 'toggle', labelKey: 'pptx.presenter.blackScreen', glyph: 'B' },
	{ id: 'blackout-white', kind: 'toggle', labelKey: 'pptx.presenter.whiteScreen', glyph: 'W' },
	{
		id: 'captions',
		kind: 'toggle',
		labelKey: 'pptx.slideShow.subtitlesTooltip',
		icon: 'captions',
	},
	{ id: 'spacer', kind: 'spacer' },
	{
		id: 'audience',
		kind: 'toggle',
		labelKey: 'pptx.presenter.openAudienceWindow',
		activeLabelKey: 'pptx.presenter.closeAudienceWindow',
		icon: 'monitor',
		activeIcon: 'monitor-off',
	},
	{
		id: 'swap-displays',
		kind: 'button',
		labelKey: 'pptx.presenter.swapDisplays',
		icon: 'arrow-left-right',
	},
	{ id: 'end', kind: 'button', labelKey: 'pptx.presenter.endPresentation', icon: 'x' },
] as const;

/** The strip's control ids in render order, for tests and parity specs. */
export const PRESENTER_CONSOLE_ORDER: readonly string[] = PRESENTER_CONSOLE_CONTROLS.map(
	(control) => control.id,
);

/**
 * The strip's accessible-name i18n keys, in order, skipping the slots that have
 * none. A parity spec resolves these through the dictionary rather than
 * hard-coding English, so the inventory survives a translation change.
 */
export const PRESENTER_CONSOLE_LABEL_KEYS: readonly string[] = PRESENTER_CONSOLE_CONTROLS.flatMap(
	(control) => (control.labelKey === undefined ? [] : [control.labelKey]),
);

/** One slot in the presenter console's right-hand rail. */
export interface PresenterRailControl {
	id: string;
	labelKey: string;
	icon?: string;
}

/**
 * The rail's navigation and notes controls, in order.
 *
 * `next` is deliberately absent from any "disabled on the last slide" rule; see
 * {@link presenterNextDisabled}.
 */
export const PRESENTER_RAIL_CONTROLS: readonly PresenterRailControl[] = [
	{ id: 'prev', labelKey: 'pptx.presenter.prev', icon: 'chevron-left' },
	{ id: 'next', labelKey: 'pptx.presenter.next', icon: 'chevron-right' },
	{ id: 'notes-font-decrease', labelKey: 'pptx.presenter.decreaseFontSize', icon: 'minus' },
	{ id: 'notes-font-increase', labelKey: 'pptx.presenter.increaseFontSize', icon: 'plus' },
] as const;

/** Static headings and read-only readouts in the rail, keyed for translation. */
export const PRESENTER_RAIL_LABEL_KEYS = {
	currentTime: 'pptx.presenter.currentTime',
	elapsed: 'pptx.presenter.elapsed',
	nextSlidePreview: 'pptx.presenter.nextSlidePreview',
	endOfPresentation: 'pptx.presenter.endOfPresentation',
	speakerNotes: 'pptx.presenter.speakerNotes',
	noNotes: 'pptx.presenter.noNotes',
	slideLabel: 'pptx.presenter.slideLabel',
	timerProgress: 'pptx.presenter.timerProgress',
	noSlides: 'pptx.presenter.noSlides',
} as const;

/** Headings and controls of the "all slides" navigator overlay. */
export const PRESENTER_NAVIGATOR_LABEL_KEYS = {
	title: 'pptx.presenter.slideNavigator',
	subtitle: 'pptx.presenter.seeAllSlides',
	close: 'pptx.presenter.closeNavigator',
} as const;

/**
 * Whether the rail's Next button should be disabled.
 *
 * Always `false`, and it is a function rather than a constant so the rule has
 * one place to be read and cited. PowerPoint's console advances from the last
 * slide to the end-of-show screen and then out of the show. Vue, Angular and
 * Svelte each independently added `disabled={current >= slides.length - 1}`,
 * which strands the presenter on the final slide with no way to finish, so the
 * audience display never closes either. React's `PresenterNotesRail` carries a
 * comment saying exactly this; the comment was not enough to stop three ports
 * making the same call, so the rule is now code.
 */
export function presenterNextDisabled(): boolean {
	return false;
}

/**
 * Whether the rail's Previous button should be disabled: only on the first
 * slide, where there is genuinely nowhere to go back to.
 */
export function presenterPrevDisabled(currentIndex: number): boolean {
	return currentIndex <= 0;
}

/**
 * How much elapsed time one fill of the console's progress bar represents.
 *
 * Five minutes, the interval PowerPoint's own console paces a talk in. It was
 * inlined in React, re-derived in Vue and given a helper of its own in Angular,
 * while Vanilla and Svelte had no bar at all.
 */
export const PRESENTER_TIMER_SEGMENT_MS = 5 * 60 * 1000;

/** A progress-bar reading: how full the current segment is, and which one. */
export interface PresenterTimerProgress {
	/** 0..100, for `aria-valuenow` and the fill width. */
	percent: number;
	/** Zero-based segment index; bindings render it one-based. */
	segment: number;
}

/**
 * Split an elapsed duration into the console's progress-bar reading.
 *
 * Negative input is clamped: a snapshot restored from a peer can arrive with a
 * start time in the future, and a negative `aria-valuenow` is invalid ARIA.
 */
export function presenterTimerProgress(elapsedMs: number): PresenterTimerProgress {
	const elapsed = Math.max(0, elapsedMs);
	return {
		percent: Math.min(
			100,
			((elapsed % PRESENTER_TIMER_SEGMENT_MS) / PRESENTER_TIMER_SEGMENT_MS) * 100,
		),
		segment: Math.floor(elapsed / PRESENTER_TIMER_SEGMENT_MS),
	};
}
