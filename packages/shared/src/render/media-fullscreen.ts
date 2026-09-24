/**
 * Media `fullScrn` full-slide playback overlay.
 *
 * ECMA-376's media-playback extension (`p:cMediaNode`'s ext list, surfaced by
 * core as `MediaPptxElement.fullScreen`) lets an author mark a video/audio
 * clip to play letterboxed across the WHOLE slide once it starts, instead of
 * at its authored frame. PowerPoint only switches to that layout once the
 * clip actually starts playing on the live show; a still slide (even one with
 * `fullScrn` media on it) shows the clip at its authored frame.
 *
 * WHY shared: this was React-only (`ElementRenderer.tsx`'s `isFullscreenMedia`
 * plus inline literals in `element-renderer-helpers.tsx`'s `getContainerStyle`).
 * All five bindings' media inspector already expose the same `fullScreen`
 * checkbox (`pptx.media.fullScreen`), so a deck that turns it on played
 * letterboxed only in React and inline-at-frame everywhere else. The trigger
 * and the resulting layout are pure decisions with no framework dependency, so
 * both live here; a binding only wires the boolean to its own play/pause
 * listeners and spreads the style object over its normal container style.
 *
 * @module render/media-fullscreen
 */

/** Inputs for {@link isMediaFullscreenActive}. */
export interface MediaFullscreenInput {
	/** The authored `fullScrn` flag (`MediaPptxElement.fullScreen`). */
	fullScreen?: boolean;
	/** True only on the live presentation (show) stage; never a still/preview/canvas. */
	presenting: boolean;
	/**
	 * True while the media element is actively playing: a `play` event has
	 * fired and no `pause`/`ended` has followed it yet.
	 */
	playing: boolean;
}

/**
 * Whether a media element should currently render in the full-slide overlay
 * layout.
 *
 * All three conditions are required: the element must be authored `fullScrn`,
 * the surface must be the live show (a still/preview/authoring canvas never
 * gets the overlay), and playback must actually be under way. PowerPoint does
 * not switch layout the instant the slide appears, only once the clip starts.
 */
export function isMediaFullscreenActive(input: MediaFullscreenInput): boolean {
	return input.fullScreen === true && input.presenting && input.playing;
}

/**
 * The CSS-legal style override every binding applies to a media element's
 * outer container while {@link isMediaFullscreenActive} is true: pin it to
 * the full slide surface, above everything else, on a black backdrop, with a
 * short transition so the jump from the authored frame reads as a deliberate
 * zoom rather than a hard cut.
 *
 * Spread on TOP of the binding's normal container style; when
 * {@link isMediaFullscreenActive} is false a binding must leave its normal
 * style untouched, none of these fields apply.
 */
export const MEDIA_FULLSCREEN_OVERLAY_STYLE = {
	left: 0,
	top: 0,
	width: '100%',
	height: '100%',
	transform: 'none',
	zIndex: 20,
	background: '#000',
	transition: 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease',
	borderColor: 'transparent',
} as const;

/** The type of {@link MEDIA_FULLSCREEN_OVERLAY_STYLE}, for typed consumers. */
export type MediaFullscreenOverlayStyle = typeof MEDIA_FULLSCREEN_OVERLAY_STYLE;

/**
 * Whether the full-slide overlay's stop/close affordance should be drawn.
 * Identical trigger to {@link isMediaFullscreenActive}: the button only makes
 * sense once the overlay itself is showing.
 */
export function shouldShowMediaFullscreenStopButton(input: MediaFullscreenInput): boolean {
	return isMediaFullscreenActive(input);
}
