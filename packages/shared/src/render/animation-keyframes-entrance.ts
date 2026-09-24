/**
 * `animation-keyframes-entrance` - static CSS `@keyframes` definitions for the
 * entrance native-animation effects. Split out of `animation-keyframes.ts` to
 * keep that module under the repo's file-size guideline; see
 * `animation-keyframes.ts` for the composed lookup this feeds.
 *
 * @module render/animation-keyframes-entrance
 */

import { SCALE_SPIN_KEYFRAME_DEFINITIONS } from './animation-keyframes-scale-spin';
import {
	blindsDecl,
	checkerboardDecl,
	maskEdgeDecl,
	maskShapeDecl,
	randomBarsBandDecl,
	wheelDecl,
} from './animation-mask-reveal';
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
	// `wheelIn` (no resolvable spoke-count subtype) defaults to PowerPoint's
	// own default of 4 spokes; see `wheelIn4` and its siblings below for the
	// subtype-aware variants `resolveEffect` redirects to.
	wheelIn: `@keyframes pptx-wheelIn {
	0% { ${wheelDecl(4, 0)} opacity: 1; }
	100% { ${wheelDecl(4, 1)} opacity: 1; }
}`,
	wheelIn1: `@keyframes pptx-wheelIn1 {
	0% { ${wheelDecl(1, 0)} opacity: 1; }
	100% { ${wheelDecl(1, 1)} opacity: 1; }
}`,
	wheelIn2: `@keyframes pptx-wheelIn2 {
	0% { ${wheelDecl(2, 0)} opacity: 1; }
	100% { ${wheelDecl(2, 1)} opacity: 1; }
}`,
	wheelIn3: `@keyframes pptx-wheelIn3 {
	0% { ${wheelDecl(3, 0)} opacity: 1; }
	100% { ${wheelDecl(3, 1)} opacity: 1; }
}`,
	wheelIn4: `@keyframes pptx-wheelIn4 {
	0% { ${wheelDecl(4, 0)} opacity: 1; }
	100% { ${wheelDecl(4, 1)} opacity: 1; }
}`,
	wheelIn8: `@keyframes pptx-wheelIn8 {
	0% { ${wheelDecl(8, 0)} opacity: 1; }
	100% { ${wheelDecl(8, 1)} opacity: 1; }
}`,
	// `blindsIn` (no resolvable direction subtype) defaults to PowerPoint's
	// own default direction, Horizontal; see `blindsInVertical`/
	// `blindsInHorizontal` for the subtype-aware variants `resolveEffect`
	// redirects to.
	blindsIn: `@keyframes pptx-blindsIn {
	from { ${blindsDecl('horizontal', 0)} opacity: 1; }
	to { ${blindsDecl('horizontal', 1)} opacity: 1; }
}`,
	blindsInVertical: `@keyframes pptx-blindsInVertical {
	from { ${blindsDecl('vertical', 0)} opacity: 1; }
	to { ${blindsDecl('vertical', 1)} opacity: 1; }
}`,
	blindsInHorizontal: `@keyframes pptx-blindsInHorizontal {
	from { ${blindsDecl('horizontal', 0)} opacity: 1; }
	to { ${blindsDecl('horizontal', 1)} opacity: 1; }
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
	// `checkerboardIn` (no resolvable direction subtype) defaults to
	// PowerPoint's own default direction, Across; see `checkerboardInAcross`/
	// `checkerboardInDown` for the subtype-aware variants `resolveEffect`
	// redirects to.
	checkerboardIn: `@keyframes pptx-checkerboardIn {
	0% { ${checkerboardDecl('across', 0)} opacity: 1; }
	100% { ${checkerboardDecl('across', 1)} opacity: 1; }
}`,
	checkerboardInAcross: `@keyframes pptx-checkerboardInAcross {
	0% { ${checkerboardDecl('across', 0)} opacity: 1; }
	100% { ${checkerboardDecl('across', 1)} opacity: 1; }
}`,
	checkerboardInDown: `@keyframes pptx-checkerboardInDown {
	0% { ${checkerboardDecl('down', 0)} opacity: 1; }
	100% { ${checkerboardDecl('down', 1)} opacity: 1; }
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
	// `randomBarsIn` (no resolvable direction subtype) defaults to
	// PowerPoint's own default direction, Horizontal; see
	// `randomBarsInVertical`/`randomBarsInHorizontal` for the subtype-aware
	// variants `resolveEffect` redirects to. See `randomBarsBandDecl`'s doc
	// for why this is a directional band sweep, not a genuinely randomised one.
	randomBarsIn: `@keyframes pptx-randomBarsIn {
	0% { ${randomBarsBandDecl('horizontal', 0)} opacity: 1; }
	100% { ${randomBarsBandDecl('horizontal', 1)} opacity: 1; }
}`,
	randomBarsInVertical: `@keyframes pptx-randomBarsInVertical {
	0% { ${randomBarsBandDecl('vertical', 0)} opacity: 1; }
	100% { ${randomBarsBandDecl('vertical', 1)} opacity: 1; }
}`,
	randomBarsInHorizontal: `@keyframes pptx-randomBarsInHorizontal {
	0% { ${randomBarsBandDecl('horizontal', 0)} opacity: 1; }
	100% { ${randomBarsBandDecl('horizontal', 1)} opacity: 1; }
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
