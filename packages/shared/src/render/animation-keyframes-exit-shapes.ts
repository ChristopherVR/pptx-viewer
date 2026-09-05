/**
 * `animation-keyframes-exit-shapes`: CSS `@keyframes` definitions for the
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
	| 'wedgeOut'
	| 'peekOut'
	| 'peekOutDown'
	| 'splitOut';

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
	// Peek Out (exit.16): the exit-gallery counterpart of Peek In, which had
	// no dedicated exit keyframe before this pass. Collapses back toward the
	// same bottom-origin edge Peek In reveals from.
	peekOut: `@keyframes pptx-peekOut {
	from { ${maskEdgeDecl('bottom', 'shown')} opacity: 1; }
	to { ${maskEdgeDecl('bottom', 'hidden')} opacity: 0; }
}`,
	// Peek Out (exit.12), verified via COM (this repo's own PowerShell
	// automation): `AddEffect` with the Peek In `MsoAnimEffect` constant then
	// `Effect.Exit = True` re-emits `presetID="12" presetSubtype="4"` with a
	// child `p:animEffect[@filter="wipe(down)"]` - a DIFFERENT, distinct
	// preset id from exit.16 above (whose own "Peek Out" naming is a
	// pre-existing, out-of-scope mismatch; see that entry's note), so this
	// gets its own non-colliding keyframe name. `presetSubtype="4"` is the
	// bottom-edge bit (matching entr.12's `peekIn`, also bottom-origin), so
	// this reuses the identical mask technique.
	peekOutDown: `@keyframes pptx-peekOutDown {
	from { ${maskEdgeDecl('bottom', 'shown')} opacity: 1; }
	to { ${maskEdgeDecl('bottom', 'hidden')} opacity: 0; }
}`,
	// Split (exit.17): the exit-gallery counterpart of Split, closing the
	// centred band back to nothing rather than growing it outward.
	splitOut: `@keyframes pptx-splitOut {
	from { ${maskShapeDecl('splitHorizontalOut', 'shown')} opacity: 1; }
	to { ${maskShapeDecl('splitHorizontalOut', 'hidden')} opacity: 0; }
}`,
};
