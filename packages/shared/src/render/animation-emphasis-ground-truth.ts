/**
 * `animation-emphasis-ground-truth` - raw COM + UI-Automation-derived facts
 * about what OOXML `p:cTn` nodes retail PowerPoint actually writes for the
 * emphasis preset catalogue, gathered for the W3-B pass that closed the "64
 * emphasis preset IDs, only 8 covered" gap and resolved the emph.26 "Pulse
 * vs Flash Bulb" question.
 *
 * Method, TWO independent techniques that cross-check each other:
 *  1. `MainSequence.AddEffect(shape, <MsoAnimEffect>, missing, msoAnimTriggerOnPageClick)`
 *     for every NAMED `MsoAnimEffect` constant in the 54-82 range (Change
 *     Fill Color through Wave, per the official VBA enumeration docs), one
 *     shape per slide, `SaveAs` to `.pptx`, then reading the saved
 *     `ppt/slides/slideN.xml` for the effect's own `p:cTn/@presetClass` /
 *     `@presetID` / `@presetSubtype` and its child animation node(s)
 *     (`p:animEffect/@filter`, `p:anim`, `p:animClr`, `p:animScale`,
 *     `p:animRot`, `p:animMotion`, `p:set`) plus every `p:attrName` it names.
 *  2. UI Automation (`System.Windows.Automation`): selected a shape,
 *     programmatically switched the ribbon to the Animations tab, and
 *     INVOKED the literal gallery / "Add Emphasis Effect" dialog list items
 *     by their displayed name, then read the same saved-XML facts. This was
 *     required because five ribbon-only names (Pulse, Color Pulse, Object
 *     Color, Blink, Shimmer, plus two unnamed "3D" group items) have NO
 *     corresponding `MsoAnimEffect` constant, so method 1 alone cannot reach
 *     them. Enumerating the "Add Emphasis Effect" dialog's full item tree via
 *     UI Automation (`Basic` / `3D` / `Subtle` / `Moderate` / `Exciting`
 *     groups, 26 items total) confirmed this ground truth covers the ENTIRE
 *     PowerPoint-exposed emphasis catalogue: every dialog item resolves to a
 *     row below, and no additional named effect was left un-enumerated.
 *
 * CONFIDENCE: every row below is a directly observed `presetId` plus its
 * exact child-node shape; nothing here is inferred by name-matching against
 * another table (contrast `animation-preset-ground-truth.ts`'s ids 27+ for
 * entrance/exit, where classic `AddEffect` automation could not reproduce the
 * full authored richness). `msoName` / `ribbonName` record which of the two
 * methods reached a given id (a row can have either, or both, when the same
 * preset is reachable both ways - e.g. id 26 has BOTH `FlashBulb` (method 1)
 * and `Pulse` (method 2), which is the direct evidence that they are the same
 * preset, not two effects that got swapped onto one id).
 *
 * The rows themselves are split into `animation-emphasis-ground-truth-early.ts`
 * (ids 1-19) and `animation-emphasis-ground-truth-late.ts` (ids 20-41) to
 * keep this module under the repo's file-size guideline; the row shape lives
 * in `animation-emphasis-ground-truth-types.ts`.
 *
 * @module render/animation-emphasis-ground-truth
 */

import { ANIMATION_EMPHASIS_GROUND_TRUTH_EARLY } from './animation-emphasis-ground-truth-early';
import { ANIMATION_EMPHASIS_GROUND_TRUTH_LATE } from './animation-emphasis-ground-truth-late';

export type { AnimationEmphasisGroundTruthRow } from './animation-emphasis-ground-truth-types';

export const ANIMATION_EMPHASIS_GROUND_TRUTH: readonly (typeof ANIMATION_EMPHASIS_GROUND_TRUTH_EARLY)[number][] =
	[...ANIMATION_EMPHASIS_GROUND_TRUTH_EARLY, ...ANIMATION_EMPHASIS_GROUND_TRUTH_LATE];
