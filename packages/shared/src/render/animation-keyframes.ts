/**
 * `animation-keyframes` — CSS `@keyframes` definitions for every static
 * native-animation effect, keyed by {@link EffectName}. Pure data + a lookup
 * helper. Names are prefixed `pptx-` (distinct from `animation-css`'s
 * `pptx-vue-` editor-preset keyframes).
 *
 * @module render/animation-keyframes
 */

import { EXIT_SHAPE_KEYFRAME_DEFINITIONS } from './animation-keyframes-exit-shapes';
import type { ExitShapeEffectName } from './animation-keyframes-exit-shapes';
import { SCALE_SPIN_KEYFRAME_DEFINITIONS } from './animation-keyframes-scale-spin';
import { maskEdgeDecl, maskEdgePartialDecl, maskShapeDecl } from './animation-mask-reveal';
import type { EffectName } from './animation-timeline-types';

// ==========================================================================
// CSS @keyframes definitions for each effect
// ==========================================================================

// The wipe/peek/blinds/split/box/random-bars reveals are CSS `mask` sweeps,
// NOT `clip-path` keyframes: a `clip-path` animation replaces the element's
// own geometry clip (preset outlines, image crops) for its whole duration, so
// a thin shape wiped in as its full bounding box (a filled rectangle "blob").
// A mask composites with the geometry clip instead. See `animation-mask-reveal`.

// Box/Checkerboard/Blinds/Wheel/RandomBars/Diamond/Plus/Wedge EXIT keyframes
// live in `animation-keyframes-exit-shapes` (split out to stay under the
// repo's file-size cap) and are merged in below.
const BASE_KEYFRAME_DEFINITIONS: Record<Exclude<EffectName, ExitShapeEffectName>, string> = {
	// ---- Entrance effects ----
	appear: `@keyframes pptx-appear {
	from { opacity: 0; }
	to { opacity: 1; }
}`,
	fadeIn: `@keyframes pptx-fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}`,
	flyInLeft: `@keyframes pptx-flyInLeft {
	from { opacity: 0; transform: translateX(-100%); }
	to { opacity: 1; transform: translateX(0); }
}`,
	flyInRight: `@keyframes pptx-flyInRight {
	from { opacity: 0; transform: translateX(100%); }
	to { opacity: 1; transform: translateX(0); }
}`,
	flyInTop: `@keyframes pptx-flyInTop {
	from { opacity: 0; transform: translateY(-100%); }
	to { opacity: 1; transform: translateY(0); }
}`,
	flyInBottom: `@keyframes pptx-flyInBottom {
	from { opacity: 0; transform: translateY(100%); }
	to { opacity: 1; transform: translateY(0); }
}`,
	zoomIn: `@keyframes pptx-zoomIn {
	from { opacity: 0; transform: scale(0.3); }
	to { opacity: 1; transform: scale(1); }
}`,
	bounceIn: `@keyframes pptx-bounceIn {
	0% { opacity: 0; transform: scale(0.3); }
	50% { opacity: 1; transform: scale(1.08); }
	70% { transform: scale(0.95); }
	100% { opacity: 1; transform: scale(1); }
}`,
	wipeIn: `@keyframes pptx-wipeIn {
	from { ${maskEdgeDecl('left', 'hidden')} opacity: 1; }
	to { ${maskEdgeDecl('left', 'shown')} opacity: 1; }
}`,
	splitIn: `@keyframes pptx-splitIn {
	from { ${maskShapeDecl('splitHorizontalOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('splitHorizontalOut', 'shown')} opacity: 1; }
}`,
	dissolveIn: `@keyframes pptx-dissolveIn {
	0% { opacity: 0; filter: blur(8px); }
	100% { opacity: 1; filter: blur(0); }
}`,
	wheelIn: `@keyframes pptx-wheelIn {
	from { opacity: 0; transform: rotate(-360deg) scale(0.5); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	blindsIn: `@keyframes pptx-blindsIn {
	from { ${maskEdgeDecl('top', 'hidden')} opacity: 1; }
	to { ${maskEdgeDecl('top', 'shown')} opacity: 1; }
}`,
	boxIn: `@keyframes pptx-boxIn {
	from { ${maskShapeDecl('boxOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('boxOut', 'shown')} opacity: 1; }
}`,
	circleIn: `@keyframes pptx-circleIn {
	from { ${maskShapeDecl('circleOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('circleOut', 'shown')} opacity: 1; }
}`,
	floatIn: `@keyframes pptx-floatIn {
	from { opacity: 0; transform: translateY(40px); }
	to { opacity: 1; transform: translateY(0); }
}`,
	riseUp: `@keyframes pptx-riseUp {
	from { opacity: 0; transform: translateY(60px); }
	to { opacity: 1; transform: translateY(0); }
}`,
	swivel: `@keyframes pptx-swivel {
	from { opacity: 0; transform: rotateY(-90deg); }
	to { opacity: 1; transform: rotateY(0deg); }
}`,
	expandIn: `@keyframes pptx-expandIn {
	from { opacity: 0; transform: scale(0, 0); }
	to { opacity: 1; transform: scale(1, 1); }
}`,
	checkerboardIn: `@keyframes pptx-checkerboardIn {
	0% { opacity: 0; }
	50% { opacity: 0.5; }
	100% { opacity: 1; }
}`,
	flashIn: `@keyframes pptx-flashIn {
	0% { opacity: 0; }
	25% { opacity: 1; }
	50% { opacity: 0; }
	75% { opacity: 1; }
	100% { opacity: 1; }
}`,
	peekIn: `@keyframes pptx-peekIn {
	from { ${maskEdgeDecl('bottom', 'hidden')} opacity: 1; }
	to { ${maskEdgeDecl('bottom', 'shown')} opacity: 1; }
}`,
	randomBarsIn: `@keyframes pptx-randomBarsIn {
	0% { ${maskEdgeDecl('left', 'hidden')} opacity: 1; }
	30% { ${maskEdgePartialDecl('left', 0.4)} opacity: 1; }
	60% { ${maskEdgePartialDecl('left', 0.7)} opacity: 1; }
	100% { ${maskEdgeDecl('left', 'shown')} opacity: 1; }
}`,
	spinnerIn: `@keyframes pptx-spinnerIn {
	from { opacity: 0; transform: rotate(-720deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	growTurnIn: `@keyframes pptx-growTurnIn {
	from { opacity: 0; transform: rotate(-90deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	diamondIn: `@keyframes pptx-diamondIn {
	from { ${maskShapeDecl('diamondOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('diamondOut', 'shown')} opacity: 1; }
}`,
	plusIn: `@keyframes pptx-plusIn {
	from { ${maskShapeDecl('plusOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('plusOut', 'shown')} opacity: 1; }
}`,
	wedgeIn: `@keyframes pptx-wedgeIn {
	from { ${maskShapeDecl('wedgeOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('wedgeOut', 'shown')} opacity: 1; }
}`,
	// A `cut` filter is an instant swap, not a gradual reveal: the element
	// jumps to fully visible almost immediately rather than fading in over
	// the whole effect duration.
	cutIn: `@keyframes pptx-cutIn {
	0% { opacity: 0; }
	1% { opacity: 1; }
	100% { opacity: 1; }
}`,
	// `stretch`In*/Out* and `newsflash`In/Out (SMIL/ECMA-376 transition
	// filters) are defined in `animation-keyframes-scale-spin` and spread in
	// below; see that module's doc for why.
	...SCALE_SPIN_KEYFRAME_DEFINITIONS,

	// ---- Exit effects ----
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

	// ---- Emphasis effects ----
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

const KEYFRAME_DEFINITIONS: Record<EffectName, string> = {
	...BASE_KEYFRAME_DEFINITIONS,
	...EXIT_SHAPE_KEYFRAME_DEFINITIONS,
};

// ==========================================================================
// Public helper: get keyframe CSS for an effect name
// ==========================================================================

export function getEffectKeyframes(effect: EffectName): string {
	return KEYFRAME_DEFINITIONS[effect] ?? '';
}
