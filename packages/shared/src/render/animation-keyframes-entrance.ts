/**
 * `animation-keyframes-entrance` - static CSS `@keyframes` definitions for the
 * entrance native-animation effects. Split out of `animation-keyframes.ts` to
 * keep that module under the repo's file-size guideline; see
 * `animation-keyframes.ts` for the composed lookup this feeds.
 *
 * @module render/animation-keyframes-entrance
 */

import { SCALE_SPIN_KEYFRAME_DEFINITIONS } from './animation-keyframes-scale-spin';
import { maskEdgeDecl, maskEdgePartialDecl, maskShapeDecl } from './animation-mask-reveal';
import { PIXELATE_IN_KEYFRAMES } from './animation-pixelate-filter';

// The wipe/peek/blinds/split/box/random-bars reveals are CSS `mask` sweeps,
// NOT `clip-path` keyframes: a `clip-path` animation replaces the element's
// own geometry clip (preset outlines, image crops) for its whole duration, so
// a thin shape wiped in as its full bounding box (a filled rectangle "blob").
// A mask composites with the geometry clip instead. See `animation-mask-reveal`.
export const ENTRANCE_KEYFRAME_DEFINITIONS: Record<string, string> = {
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
	// `pixelate` SMIL filter family: a mosaic grid reveal (see
	// `animation-pixelate-filter`), the only genuinely blocky-content reveal in
	// this table; every other entry above is opacity/transform/mask driven.
	pixelateIn: PIXELATE_IN_KEYFRAMES,
	// `stretch`In*/Out* and `newsflash`In/Out (SMIL/ECMA-376 transition
	// filters) are defined in `animation-keyframes-scale-spin` and spread in
	// below; see that module's doc for why.
	...SCALE_SPIN_KEYFRAME_DEFINITIONS,
};
