/**
 * `animation-keyframes-exit-shapes` — CSS `@keyframes` definitions for the
 * Box / Checkerboard / Blinds / Wheel / Random Bars / Diamond / Plus / Wedge
 * EXIT effects. Split out of `animation-keyframes` to keep that module under
 * the repo's file-size cap.
 *
 * Every preset id here was confirmed via COM automation (`AddEffect` +
 * `Effect.Exit = True` + raw OOXML inspection on retail PowerPoint) to reuse
 * the SAME numeric presetID as its entrance form, mirroring the
 * already-documented Bounce/Rise Up/Circle pattern (see
 * `animation-presets.ts`). Each keyframe below reuses the exact mask or
 * transform technique already shipped for that effect's entrance keyframe in
 * `animation-keyframes.ts`, just played in reverse (shown -> hidden) so the
 * reveal closes instead of opening.
 *
 * @module render/animation-keyframes-exit-shapes
 */

import { maskEdgeDecl, maskEdgePartialDecl, maskShapeDecl } from './animation-mask-reveal';

/** The subset of {@link EffectName} whose `@keyframes` live in this module. */
export type ExitShapeEffectName =
	| 'boxOut'
	| 'checkerboardOut'
	| 'blindsOut'
	| 'wheelOut'
	| 'randomBarsOut'
	| 'diamondOut'
	| 'plusOut'
	| 'wedgeOut';

export const EXIT_SHAPE_KEYFRAME_DEFINITIONS: Record<ExitShapeEffectName, string> = {
	boxOut: `@keyframes pptx-boxOut {
	from { ${maskShapeDecl('boxOut', 'shown')} opacity: 1; }
	to { ${maskShapeDecl('boxOut', 'hidden')} opacity: 0; }
}`,
	checkerboardOut: `@keyframes pptx-checkerboardOut {
	0% { opacity: 1; }
	50% { opacity: 0.5; }
	100% { opacity: 0; }
}`,
	blindsOut: `@keyframes pptx-blindsOut {
	from { ${maskEdgeDecl('top', 'shown')} opacity: 1; }
	to { ${maskEdgeDecl('top', 'hidden')} opacity: 0; }
}`,
	wheelOut: `@keyframes pptx-wheelOut {
	from { opacity: 1; transform: rotate(0deg) scale(1); }
	to { opacity: 0; transform: rotate(360deg) scale(0.5); }
}`,
	randomBarsOut: `@keyframes pptx-randomBarsOut {
	0% { ${maskEdgeDecl('left', 'shown')} opacity: 1; }
	30% { ${maskEdgePartialDecl('left', 0.7)} opacity: 1; }
	60% { ${maskEdgePartialDecl('left', 0.4)} opacity: 1; }
	100% { ${maskEdgeDecl('left', 'hidden')} opacity: 0; }
}`,
	diamondOut: `@keyframes pptx-diamondOut {
	from { ${maskShapeDecl('diamondOut', 'shown')} opacity: 1; }
	to { ${maskShapeDecl('diamondOut', 'hidden')} opacity: 0; }
}`,
	plusOut: `@keyframes pptx-plusOut {
	from { ${maskShapeDecl('plusOut', 'shown')} opacity: 1; }
	to { ${maskShapeDecl('plusOut', 'hidden')} opacity: 0; }
}`,
	wedgeOut: `@keyframes pptx-wedgeOut {
	from { ${maskShapeDecl('wedgeOut', 'shown')} opacity: 1; }
	to { ${maskShapeDecl('wedgeOut', 'hidden')} opacity: 0; }
}`,
};
