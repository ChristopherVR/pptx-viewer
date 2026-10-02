/**
 * presentation-toolbar-view.ts: the pure behaviour behind the slide-show toolbar's
 * Angular adapter: the Blackboard transition and the auto-hide timer. The control
 * inventory, class tokens, palettes and disabled rules moved into the shared
 * `pptx-ui-present-toolbar` element.
 *
 * Framework-free (no Angular imports) so it can be unit-tested without TestBed.
 */
import { AUTO_HIDE_DELAY_MS, toggleBlackboard } from '../internal/shared';
import type { PresentationBlackout, PresentationPointerTool } from '../internal/shared';

// ---------------------------------------------------------------------------
// Control ids
// ---------------------------------------------------------------------------

/**
 * The slots of the show toolbar that act (the shared inventory's ids). Kept as part
 * of the public API; the shared element now emits typed intents instead.
 */
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
