/**
 * presentation-toolbar-view.ts: the literal class tokens and the auto-hide
 * state machine behind {@link PresentationToolbarComponent}.
 *
 * Neither lives in the component itself, for two reasons:
 *
 *  - Tailwind is told to scan `src/viewer/**\/*.ts` and the vendored shared
 *    source, and nothing else (see `src/styles/pptx-angular-viewer.css`). A
 *    utility class written straight into a component's external `.html` is
 *    therefore never emitted, and the control silently renders unstyled. Every
 *    literal class the toolbar template needs is declared here so the scanner
 *    sees it; the rest come from shared's `PRESENT_TOOLBAR_CLASSES`, which the
 *    scanner also covers.
 *  - This package has no TestBed (see `vitest.config.ts`), so any toolbar
 *    behaviour worth asserting has to be reachable without rendering it.
 */

import {
	AUTO_HIDE_DELAY_MS,
	HIGHLIGHTER_COLORS,
	PEN_COLORS,
	PRESENT_TOOLBAR_CLASSES,
	toggleBlackboard,
} from '../internal/shared';
import type { PresentationBlackout, PresentationPointerTool } from '../internal/shared';

// ---------------------------------------------------------------------------
// Control ids
// ---------------------------------------------------------------------------

/** The control ids that run an action (dividers and readouts are inert). */
export type PresentToolbarAction =
	| 'previous'
	| 'next'
	| 'laser'
	| 'pen'
	| 'pen-color'
	| 'highlighter'
	| 'highlighter-color'
	| 'eraser'
	| 'blackboard'
	| 'clear'
	| 'presenter-view'
	| 'end';

/** Which colour palette popover is open, if any. */
export type OpenPalette = 'none' | 'pen' | 'highlighter';

// ---------------------------------------------------------------------------
// Class tokens (Tailwind-scanned)
// ---------------------------------------------------------------------------

/** Ring on the palette swatch matching the tool's current colour. */
const SWATCH_BORDER_SELECTED = 'border-white';

/** Ring on every other palette swatch. */
const SWATCH_BORDER_IDLE = 'border-white/20';

/** Hover tint marking the destructive controls (clear ink, end the show). */
const DESTRUCTIVE_HOVER = 'hover:text-red-400';

/** Annotation-tool toggle, tinted when the tool is armed. */
export function presentToolbarToggleClass(active: boolean): string {
	return active ? PRESENT_TOOLBAR_CLASSES.toggleActive : PRESENT_TOOLBAR_CLASSES.toggle;
}

/**
 * "Clear annotations". The red hover tint is withheld while the button is
 * disabled so a strokeless slide does not advertise an action that cannot run.
 */
export function presentToolbarClearClass(hasAnnotations: boolean): string {
	return hasAnnotations
		? `${PRESENT_TOOLBAR_CLASSES.button} ${DESTRUCTIVE_HOVER}`
		: PRESENT_TOOLBAR_CLASSES.button;
}

/** One colour swatch in a palette popover. */
export function presentToolbarSwatchClass(selected: boolean): string {
	const border = selected ? SWATCH_BORDER_SELECTED : SWATCH_BORDER_IDLE;
	return `${PRESENT_TOOLBAR_CLASSES.swatch} ${border}`;
}

/**
 * Everything the toolbar template needs that is not component state, in one
 * object: the component would otherwise carry a dozen alias fields whose only
 * job is to make a constant reachable from an Angular expression.
 *
 * The literal utility strings sit here rather than in the template because
 * Tailwind's `@source` globs cover `.ts` only, so a class written into the
 * `.html` would never be emitted and its control would render unstyled.
 */
export const PRESENT_TOOLBAR_VIEW = {
	...PRESENT_TOOLBAR_CLASSES,
	/** "End presentation": always destructive, so always tinted on hover. */
	end: `${PRESENT_TOOLBAR_CLASSES.button} ${DESTRUCTIVE_HOVER}`,
	/** Icon inside a navigation / tool button (`PRESENT_TOOLBAR_METRICS.iconSize`). */
	icon: 'h-[18px] w-[18px]',
	/** Icon inside a colour caret (`caretIconSize`). */
	caretIcon: 'h-3 w-3',
	/** Icon beside the elapsed readout (`timerIconSize`). */
	timerIcon: 'h-3.5 w-3.5',
	/**
	 * A tool toggle plus its caret and palette popover. The palette is positioned
	 * against this group, so the group has to establish the containing block.
	 */
	group: 'relative flex items-center',
	penColors: PEN_COLORS,
	highlighterColors: HIGHLIGHTER_COLORS,
	toggleClass: presentToolbarToggleClass,
	clearClass: presentToolbarClearClass,
	swatchClass: presentToolbarSwatchClass,
} as const;

// ---------------------------------------------------------------------------
// Disabled-state predicates
// ---------------------------------------------------------------------------

/**
 * Whether "previous slide" is dead. An empty deck counts as the first slide, so
 * the control is disabled rather than stepping to index -1.
 */
export function isAtFirstSlide(currentSlideIndex: number): boolean {
	return currentSlideIndex <= 0;
}

/**
 * Whether "next slide" is dead. Note this is the LAST slide, not the black
 * end-of-show screen: PowerPoint still lets a forward input raise that screen,
 * and the show overlay owns it, so the toolbar stops one step earlier than the
 * keyboard does.
 */
export function isAtLastSlide(currentSlideIndex: number, totalSlides: number): boolean {
	return currentSlideIndex >= totalSlides - 1;
}

// ---------------------------------------------------------------------------
// Blackboard
// ---------------------------------------------------------------------------

/** The two peers one Blackboard press mutates (see {@link runBlackboardToggle}). */
export interface BlackboardToggleDeps {
	/** Current blank-screen state (presenter-window snapshot `blackout`). */
	blackout: PresentationBlackout;
	/** Currently-armed annotation tool. */
	tool: PresentationPointerTool;
	/** Patch the blank screen (the same path the B/W keyboard toggle uses). */
	setBlackout: (value: PresentationBlackout) => void;
	/**
	 * Arm a tool via `PresentationAnnotationsService.setTool`, which has
	 * PowerPoint toggle semantics (arming the armed tool disarms it).
	 */
	setTool: (value: PresentationPointerTool) => void;
}

/**
 * Apply one press of the show toolbar's Blackboard toggle: shared
 * `toggleBlackboard` decides the target state (black screen + pen together, or
 * neither), and this helper drives the two Angular services there. `setTool`
 * is only invoked when the target differs from the current tool, because its
 * toggle semantics would otherwise DISARM the pen the press meant to keep.
 */
export function runBlackboardToggle(deps: BlackboardToggleDeps): void {
	const next = toggleBlackboard(deps.blackout, deps.tool);
	deps.setBlackout(next.blackout);
	if (deps.tool !== next.tool) {
		deps.setTool(next.tool);
	}
}

// ---------------------------------------------------------------------------
// Auto-hide
// ---------------------------------------------------------------------------

/**
 * The show toolbar's auto-hide countdown, mirroring React's
 * `PresentationToolbarWrapper`: any pointer movement shows the bar, and it
 * fades out again after {@link AUTO_HIDE_DELAY_MS} of stillness unless the
 * pointer is resting on the bar itself.
 *
 * Split out of the component because a presenter losing the bar mid-show (or
 * never getting it back) is the failure this logic exists to prevent, and it
 * cannot be exercised through a component this package cannot mount.
 */
export class PresentToolbarAutoHide {
	private timer: ReturnType<typeof setTimeout> | null = null;
	private hovering = false;

	constructor(private readonly setVisible: (visible: boolean) => void) {}

	/** Pointer moved anywhere: show the bar and restart the countdown. */
	poke(): void {
		this.setVisible(true);
		this.restart();
	}

	/** Pointer entered the bar: keep it up for as long as it rests there. */
	enter(): void {
		this.hovering = true;
		this.cancel();
		this.setVisible(true);
	}

	/** Pointer left the bar: resume the countdown. */
	leave(): void {
		this.hovering = false;
		this.restart();
	}

	/** Drop the pending timer (component teardown). */
	dispose(): void {
		this.cancel();
	}

	private restart(): void {
		this.cancel();
		this.timer = setTimeout(() => {
			this.timer = null;
			if (!this.hovering) {
				this.setVisible(false);
			}
		}, AUTO_HIDE_DELAY_MS);
	}

	private cancel(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
