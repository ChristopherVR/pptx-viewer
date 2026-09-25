/**
 * `animation-keyframes-entrance` - static CSS `@keyframes` definitions for the
 * entrance native-animation effects. Split out of `animation-keyframes.ts` to
 * keep that module under the repo's file-size guideline; see
 * `animation-keyframes.ts` for the composed lookup this feeds.
 *
 * @module render/animation-keyframes-entrance
 */

import { SCALE_SPIN_KEYFRAME_DEFINITIONS } from './animation-keyframes-scale-spin';
import { maskHoleDecl, maskPlusHoleDecl } from './animation-mask-hole-reveal';
import {
	blindsDecl,
	checkerboardDecl,
	maskEdgeDecl,
	maskShapeDecl,
	randomBarsBandDecl,
	wheelDecl,
} from './animation-mask-reveal';
import { PIXELATE_IN_KEYFRAMES } from './animation-pixelate-filter';
import { sampledMaskKeyframes } from './animation-sampled-mask-keyframes';
import { WEDGE_KEYFRAME_DEFINITIONS } from './animation-wedge-reveal';

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
	wheelIn: sampledMaskKeyframes('pptx-wheelIn', (f) => wheelDecl(4, f)),
	wheelIn1: sampledMaskKeyframes('pptx-wheelIn1', (f) => wheelDecl(1, f)),
	wheelIn2: sampledMaskKeyframes('pptx-wheelIn2', (f) => wheelDecl(2, f)),
	wheelIn3: sampledMaskKeyframes('pptx-wheelIn3', (f) => wheelDecl(3, f)),
	wheelIn4: sampledMaskKeyframes('pptx-wheelIn4', (f) => wheelDecl(4, f)),
	wheelIn8: sampledMaskKeyframes('pptx-wheelIn8', (f) => wheelDecl(8, f)),
	// `blindsIn` (no resolvable direction subtype) defaults to PowerPoint's
	// own default direction, Horizontal; see `blindsInVertical`/
	// `blindsInHorizontal` for the subtype-aware variants `resolveEffect`
	// redirects to.
	blindsIn: sampledMaskKeyframes('pptx-blindsIn', (f) => blindsDecl('horizontal', f)),
	blindsInVertical: sampledMaskKeyframes('pptx-blindsInVertical', (f) => blindsDecl('vertical', f)),
	blindsInHorizontal: sampledMaskKeyframes('pptx-blindsInHorizontal', (f) =>
		blindsDecl('horizontal', f),
	),
	boxIn: `@keyframes pptx-boxIn {
	from { ${maskHoleDecl('box', 'hidden')} opacity: 1; }
	to { ${maskHoleDecl('box', 'shown')} opacity: 1; }
}`,
	circleIn: `@keyframes pptx-circleIn {
	from { ${maskHoleDecl('circle', 'hidden')} opacity: 1; }
	to { ${maskHoleDecl('circle', 'shown')} opacity: 1; }
}`,
	// Effect Options "Out" (`box(out)` ...): grows from the centre (CreateVideo:
	// a 2 s Box Out shows a 52 px centred square 0.5 s in, 168 px at 1.5 s).
	boxInFromCenter: `@keyframes pptx-boxInFromCenter {
	from { ${maskShapeDecl('boxOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('boxOut', 'shown')} opacity: 1; }
}`,
	circleInFromCenter: `@keyframes pptx-circleInFromCenter {
	from { ${maskShapeDecl('circleOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('circleOut', 'shown')} opacity: 1; }
}`,
	diamondInFromCenter: `@keyframes pptx-diamondInFromCenter {
	from { ${maskShapeDecl('diamondOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('diamondOut', 'shown')} opacity: 1; }
}`,
	plusInFromCenter: `@keyframes pptx-plusInFromCenter {
	from { ${maskShapeDecl('plusOut', 'hidden')} opacity: 1; }
	to { ${maskShapeDecl('plusOut', 'shown')} opacity: 1; }
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
	checkerboardIn: sampledMaskKeyframes('pptx-checkerboardIn', (f) => checkerboardDecl('across', f)),
	checkerboardInAcross: sampledMaskKeyframes('pptx-checkerboardInAcross', (f) =>
		checkerboardDecl('across', f),
	),
	checkerboardInDown: sampledMaskKeyframes('pptx-checkerboardInDown', (f) =>
		checkerboardDecl('down', f),
	),
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
	randomBarsIn: sampledMaskKeyframes('pptx-randomBarsIn', (f) =>
		randomBarsBandDecl('horizontal', f),
	),
	randomBarsInVertical: sampledMaskKeyframes('pptx-randomBarsInVertical', (f) =>
		randomBarsBandDecl('vertical', f),
	),
	randomBarsInHorizontal: sampledMaskKeyframes('pptx-randomBarsInHorizontal', (f) =>
		randomBarsBandDecl('horizontal', f),
	),
	spinnerIn: `@keyframes pptx-spinnerIn {
	from { opacity: 0; transform: rotate(-720deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	growTurnIn: `@keyframes pptx-growTurnIn {
	from { opacity: 0; transform: rotate(-90deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
	diamondIn: `@keyframes pptx-diamondIn {
	from { ${maskHoleDecl('diamond', 'hidden')} opacity: 1; }
	to { ${maskHoleDecl('diamond', 'shown')} opacity: 1; }
}`,
	plusIn: `@keyframes pptx-plusIn {
	from { ${maskPlusHoleDecl('hidden')} opacity: 1; }
	to { ${maskPlusHoleDecl('shown')} opacity: 1; }
}`,
	// Two wedges opening from 12 o'clock (CreateVideo-derived, see
	// `animation-wedge-reveal`).
	wedgeIn: WEDGE_KEYFRAME_DEFINITIONS.wedgeIn,
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
