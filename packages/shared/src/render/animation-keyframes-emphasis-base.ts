/**
 * `animation-keyframes-emphasis-base` - static CSS `@keyframes` definitions
 * for the emphasis native-animation effects (the pure transform/opacity/color
 * ones; Blink/Shimmer live in `animation-emphasis-blink-shimmer.ts`). Split
 * out of `animation-keyframes.ts` to keep that module under the repo's
 * file-size guideline; see `animation-keyframes.ts` for the composed lookup
 * this feeds.
 *
 * @module render/animation-keyframes-emphasis-base
 */

export const EMPHASIS_KEYFRAME_DEFINITIONS: Record<string, string> = {
	pulse: `@keyframes pptx-pulse {
	0% { transform: scale(1); }
	25% { transform: scale(1.1); }
	50% { transform: scale(1); }
	75% { transform: scale(1.1); }
	100% { transform: scale(1); }
}`,
	spin: `@keyframes pptx-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}`,
	teeter: `@keyframes pptx-teeter {
	0% { transform: rotate(0deg); }
	25% { transform: rotate(5deg); }
	50% { transform: rotate(0deg); }
	75% { transform: rotate(-5deg); }
	100% { transform: rotate(0deg); }
}`,
	growShrink: `@keyframes pptx-growShrink {
	0% { transform: scale(1); }
	50% { transform: scale(1.25); }
	100% { transform: scale(1); }
}`,
	transparency: `@keyframes pptx-transparency {
	0% { opacity: 1; }
	50% { opacity: 0.4; }
	100% { opacity: 1; }
}`,
	boldFlash: `@keyframes pptx-boldFlash {
	0% { font-weight: inherit; }
	25% { font-weight: 900; }
	50% { font-weight: inherit; }
	75% { font-weight: 900; }
	100% { font-weight: inherit; }
}`,
	wave: `@keyframes pptx-wave {
	0% { transform: translateY(0); }
	25% { transform: translateY(-8px); }
	50% { transform: translateY(0); }
	75% { transform: translateY(8px); }
	100% { transform: translateY(0); }
}`,
	colorWave: `@keyframes pptx-colorWave {
	0% { filter: hue-rotate(0deg); }
	50% { filter: hue-rotate(180deg); }
	100% { filter: hue-rotate(360deg); }
}`,
	bounce: `@keyframes pptx-bounce {
	0% { transform: translateY(0); }
	20% { transform: translateY(-20px); }
	40% { transform: translateY(0); }
	60% { transform: translateY(-10px); }
	80% { transform: translateY(0); }
	100% { transform: translateY(0); }
}`,
	flash: `@keyframes pptx-flash {
	0% { opacity: 1; }
	25% { opacity: 0; }
	50% { opacity: 1; }
	75% { opacity: 0; }
	100% { opacity: 1; }
}`,
};
