/**
 * `animation-keyframes-exit` - static CSS `@keyframes` definitions for the
 * exit native-animation effects. Split out of `animation-keyframes.ts` to
 * keep that module under the repo's file-size guideline; see
 * `animation-keyframes.ts` for the composed lookup this feeds. (The
 * Box/Checkerboard/Blinds/Wheel/RandomBars/Diamond/Plus/Wedge exit mask
 * keyframes live separately in `animation-keyframes-exit-shapes.ts`.)
 *
 * @module render/animation-keyframes-exit
 */

import { maskEdgeDecl } from './animation-mask-reveal';

export const EXIT_KEYFRAME_DEFINITIONS: Record<string, string> = {
	disappear: `@keyframes pptx-disappear {
	from { opacity: 1; }
	to { opacity: 0; }
}`,
	fadeOut: `@keyframes pptx-fadeOut {
	from { opacity: 1; }
	to { opacity: 0; }
}`,
	flyOutLeft: `@keyframes pptx-flyOutLeft {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(-100%); }
}`,
	flyOutRight: `@keyframes pptx-flyOutRight {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(100%); }
}`,
	flyOutTop: `@keyframes pptx-flyOutTop {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(-100%); }
}`,
	flyOutBottom: `@keyframes pptx-flyOutBottom {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(100%); }
}`,
	zoomOut: `@keyframes pptx-zoomOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0.3); }
}`,
	bounceOut: `@keyframes pptx-bounceOut {
	0% { opacity: 1; transform: scale(1); }
	25% { transform: scale(1.08); }
	100% { opacity: 0; transform: scale(0.3); }
}`,
	wipeOut: `@keyframes pptx-wipeOut {
	from { ${maskEdgeDecl('right', 'shown')} opacity: 1; }
	to { ${maskEdgeDecl('right', 'hidden')} opacity: 0; }
}`,
	shrinkOut: `@keyframes pptx-shrinkOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0); }
}`,
	dissolveOut: `@keyframes pptx-dissolveOut {
	from { opacity: 1; filter: blur(0); }
	to { opacity: 0; filter: blur(8px); }
}`,
	// Sink Down is the exit-side counterpart of Rise Up: verified via COM,
	// `msoAnimEffectRiseUp` with `Effect.Exit = True` re-emits the SAME
	// presetID (37) with presetClass="exit" rather than a distinct id, so the
	// exit-form visual mirrors entrance's translateY travel in reverse.
	sinkDown: `@keyframes pptx-sinkDown {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(60px); }
}`,
	// A `cut` filter is an instant swap: the element stays fully visible
	// until almost the very end of the effect duration, then disappears.
	cutOut: `@keyframes pptx-cutOut {
	0% { opacity: 1; }
	99% { opacity: 1; }
	100% { opacity: 0; }
}`,
};
