/**
 * Blackboard mode: the layering and state rules for drawing ink on the
 * blacked-out (or whited-out) slide-show screen, decided once for all five
 * bindings.
 *
 * PowerPoint's `B` / `W` blank the display, and its pen keeps working on that
 * blank screen: presenters use the combination as an impromptu blackboard.
 * Historically every binding here drew the LOCAL annotation overlay at a lower
 * stacking level than the blackout sheet, so ink captured pointer input during
 * a blackout but painted invisibly underneath it (the audience window already
 * painted its synced strokes ABOVE the blackout, which is the behaviour the
 * local show now matches). The z-index decision lives here so the five
 * bindings cannot drift apart again.
 *
 * The module also owns the "Blackboard" show-toolbar action's state logic:
 * one click arms the black screen and the pen together, one click disarms
 * both.
 *
 * E2E contract: every binding stamps `data-pptx-annotation-overlay` on the
 * element that carries {@link annotationOverlayZIndex}'s value and
 * `data-pptx-blackout` on the blackout sheet, so the framework-neutral specs
 * can probe the stacking order without binding-specific selectors.
 *
 * @module render/presentation-blackboard
 */
import type { PresentationPointerTool, PresentationSnapshot } from './presentation-session-types';

/** Blackout state, as carried by {@link PresentationSnapshot}. */
export type PresentationBlackout = PresentationSnapshot['blackout'];

/** Stacking level of the blackout / whiteout sheet over the show surface. */
export const PRESENT_BLACKOUT_Z = 75;

/** Stacking level of the local annotation (ink) overlay during a normal show. */
export const PRESENT_ANNOTATION_Z = 60;

/**
 * Stacking level of the local annotation overlay while the screen is blanked:
 * above the blackout sheet ({@link PRESENT_BLACKOUT_Z}) and still below the
 * show toolbar (z 80), so strokes drawn on the "blackboard" stay visible.
 */
export const PRESENT_ANNOTATION_OVER_BLACKOUT_Z = 78;

/**
 * The z-index the local annotation overlay (existing strokes included) must
 * render at, given the current blackout state. During a blackout the overlay
 * is raised above the blank sheet; otherwise it sits just above the slide.
 */
export function annotationOverlayZIndex(blackout: PresentationBlackout): number {
	return blackout === 'none' ? PRESENT_ANNOTATION_Z : PRESENT_ANNOTATION_OVER_BLACKOUT_Z;
}

/**
 * Whether the Blackboard toggle reads as active: the screen is blacked out
 * AND the pen is armed. A white screen or a different tool is not blackboard
 * mode (the `B`/`W` switches and the individual tools stay independently
 * toggleable).
 */
export function isBlackboardActive(
	blackout: PresentationBlackout,
	tool: PresentationPointerTool,
): boolean {
	return blackout === 'black' && tool === 'pen';
}

/** The state a Blackboard toggle click should transition to. */
export interface BlackboardToggleResult {
	blackout: PresentationBlackout;
	tool: Extract<PresentationPointerTool, 'pen' | 'none'>;
}

/**
 * One click on the Blackboard action: arms the black screen and the pen
 * together, or disarms both when the combination is already active. A partial
 * state (say, blackout on but eraser armed) is treated as inactive, so the
 * click completes the pair rather than tearing it down.
 */
export function toggleBlackboard(
	blackout: PresentationBlackout,
	tool: PresentationPointerTool,
): BlackboardToggleResult {
	return isBlackboardActive(blackout, tool)
		? { blackout: 'none', tool: 'none' }
		: { blackout: 'black', tool: 'pen' };
}
