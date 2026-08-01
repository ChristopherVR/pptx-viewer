/**
 * Pure state logic for the presenter console's control strip.
 *
 * The strip's inventory, order, label keys and icons all come from
 * `pptx-viewer-shared`'s `PRESENTER_CONSOLE_CONTROLS`; what stays here is only
 * the mapping from a control id onto the live snapshot, which is presentation
 * state rather than deck logic. It lives in a plain module (not inside the SFC)
 * for the reason CLAUDE.md gives: a component that declares its own
 * non-trivial computation is a smell, and a plain module is also directly
 * unit-testable without mounting anything.
 *
 * @module viewer/components/presenter-console-strip
 */
import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';

/** Everything the strip needs to decide how a control currently reads. */
export interface PresenterStripState {
	snapshot: PresentationSnapshot;
	/** Whether the audience-display window is open (the `audience` toggle). */
	audienceOpen: boolean;
}

/** The four annotation tools, which are also their own control ids. */
const POINTER_TOOLS: readonly PresentationPointerTool[] = ['laser', 'pen', 'highlighter', 'eraser'];

/**
 * Whether a strip control id names an annotation tool.
 *
 * A type guard rather than a cast at the call site: the console dispatches on
 * the shared inventory's `string` ids, and narrowing here is what keeps
 * `setTool` free of an unchecked assertion.
 */
export function isPresenterPointerTool(id: string): id is PresentationPointerTool {
	return (POINTER_TOOLS as readonly string[]).includes(id);
}

/**
 * Whether a control currently reads as "on".
 *
 * Drives `aria-pressed` and the active styling for the toggles, and the
 * icon/label swap for the two slots whose appearance genuinely changes with
 * state (the timer shows a play glyph while paused, the audience toggle renames
 * itself once a display is open).
 */
export function presenterControlActive(id: string, state: PresenterStripState): boolean {
	const { snapshot } = state;
	if (isPresenterPointerTool(id)) {
		return (snapshot.pointer?.tool ?? 'none') === id;
	}
	switch (id) {
		case 'timer-toggle':
			return snapshot.paused;
		case 'blackout-black':
			return snapshot.blackout === 'black';
		case 'blackout-white':
			return snapshot.blackout === 'white';
		case 'captions':
			return snapshot.subtitlesVisible === true;
		case 'audience':
			return state.audienceOpen;
		default:
			return false;
	}
}

/**
 * Whether a control is unavailable.
 *
 * Only "swap displays", which needs a second window to swap with; React
 * disables it the same way. Everything else stays live, deliberately including
 * Next on the last slide (see the shared `presenterNextDisabled`).
 */
export function presenterControlDisabled(id: string, state: PresenterStripState): boolean {
	return id === 'swap-displays' && !state.audienceOpen;
}
