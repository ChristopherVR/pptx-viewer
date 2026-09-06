/**
 * `slide-transition-warp`: the p14 "Warp" slide transition `@keyframes`, split
 * out of `p14-transition-keyframes` to keep that module under the project's
 * per-file LOC budget.
 *
 * MEASURED via COM `Presentation.CreateVideo` frame extraction (a two-slide
 * deck authored through this SDK's own `SlideBuilder.setTransition`, so the
 * XML PowerPoint reopens is exactly what `PptxSlideTransitionService` writes):
 * real Warp reads as a hyperspace-style radial zoom blur - scale, brightness
 * and blur pulsing outward from centre - not the skew (`skewX`/`skewY`)
 * distortion the pre-measurement keyframes used, which never appeared in any
 * extracted frame.
 *
 * @module render/slide-transition-warp
 */

/**
 * `@keyframes` for both Warp variants (default and `direction="out"`, the
 * `-reverse-` pair). Folded into `P14_TRANSITION_KEYFRAMES_2`.
 */
export const WARP_TRANSITION_KEYFRAMES = `
@keyframes pptx-tr-warp-in {
	0%   { transform: scale(0.25); opacity: 0; filter: blur(10px) brightness(1.8); }
	50%  { transform: scale(0.85); opacity: 0.7; filter: blur(3px) brightness(1.3); }
	100% { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
}
@keyframes pptx-tr-warp-out {
	0%   { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
	50%  { transform: scale(0.85); opacity: 0.7; filter: blur(3px) brightness(1.3); }
	100% { transform: scale(0.25); opacity: 0; filter: blur(10px) brightness(1.8); }
}
@keyframes pptx-tr-warp-reverse-in {
	0%   { transform: scale(3.2); opacity: 0; filter: blur(14px) brightness(2.2); }
	50%  { transform: scale(1.7); opacity: 0.7; filter: blur(6px) brightness(1.5); }
	100% { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
}
@keyframes pptx-tr-warp-reverse-out {
	0%   { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
	50%  { transform: scale(1.7); opacity: 0.7; filter: blur(6px) brightness(1.5); }
	100% { transform: scale(3.2); opacity: 0; filter: blur(14px) brightness(2.2); }
}
`;
