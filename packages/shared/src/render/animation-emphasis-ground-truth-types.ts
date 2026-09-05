/**
 * `animation-emphasis-ground-truth-types` - the row shape for the COM +
 * UI-Automation emphasis ground-truth table. Split out of
 * `animation-emphasis-ground-truth.ts` to keep that module under the repo's
 * file-size guideline.
 *
 * @module render/animation-emphasis-ground-truth-types
 */

/** One COM/UIA-observed OOXML `p:cTn` + child-node signature for an emphasis preset id. */
export interface AnimationEmphasisGroundTruthRow {
	presetId: number;
	/** `p:cTn/@presetSubtype`. */
	presetSubtype: number;
	/** The named `MsoAnimEffect` constant that reproduced this id via `AddEffect`, if any. */
	msoName?: string;
	/** The literal ribbon / "Add Emphasis Effect" dialog item name that reproduced this id via UI Automation, if any. */
	ribbonName?: string;
	/** `p:animEffect/@filter`, when the effect carries one. */
	filter?: string;
	/** `p:attrNameLst/p:attrName` values named by this effect's `p:anim`/`p:animClr`/`p:set` children, if any. */
	attrNames?: readonly string[];
	/** Which child animation node kinds the saved XML carried. */
	children: ReadonlyArray<'animClr' | 'animScale' | 'animRot' | 'animMotion' | 'anim' | 'set'>;
	/** `true` when the saved `<p:childTnLst>` was empty (no representable 2D animation). */
	noAnimationContent?: boolean;
}
