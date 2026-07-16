/**
 * animation-playback-helpers.ts: Angular shim over the shared element-animation
 * playback model.
 *
 * The pure click-group / reveal / pending-style maths now lives in
 * `pptx-viewer-shared` (`render/animation-playback`), consolidated with the Vue
 * playback composable. It is re-exported here so {@link AnimationPlaybackService}
 * and {@link AnimationPanelComponent} keep importing the same names. The
 * stateful service (signals + RAF/timers) stays Angular-local.
 */

export {
	advanceStep,
	buildClickGroups,
	buildPresentationClickGroups,
	clampStep,
	durationOf,
	pendingElementStyles,
	revealedElementStyles,
} from '../internal/shared';
export type { AnimationClickGroup, CSSProperties } from '../internal/shared';
