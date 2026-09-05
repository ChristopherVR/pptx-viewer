/**
 * `animation-preset-ground-truth` - raw COM-derived facts about what OOXML
 * `p:cTn`/`p:animEffect` nodes retail PowerPoint actually writes for the
 * entrance/exit preset catalogue, gathered for the W3-A pass that closed the
 * "68 entrance / 68 exit preset IDs, only 54/200 non-path IDs covered" gap.
 *
 * Method: `MainSequence.AddEffect(shape, <MsoAnimEffect>, msoAnimateLevelNone,
 * msoAnimTriggerOnPageClick)` on a blank rectangle, then (per row) toggling
 * `Effect.Exit = True`, `SaveAs` to `.pptx`, and reading the saved
 * `ppt/slides/slide1.xml` for the effect's own `p:cTn/@presetClass` /
 * `@presetID` / `@presetSubtype` and whether it also carries a
 * `p:animEffect/@filter`, `p:animScale`, `p:animRot`, or `p:animMotion` child.
 *
 * CONFIDENCE, READ BEFORE TRUSTING AN ENTRY: ids 1-26 are trustworthy for
 * BOTH the numeric id (`presetId`) AND the reveal filter, because the
 * `MsoAnimEffect` constant requested for each one produced a `presetId`
 * that already matched (and cross-validates) the independently-established
 * authoring reverse lookup (`animation-write-mappings.ts`) and UI catalog
 * (`animation-preset-catalog.ts`). From id 27 up, PowerPoint's classic
 * `AddEffect` automation could not reproduce most of the "extended"
 * (post-2007) gallery effects with their full authored richness: it degraded
 * them to a plain `filter="fade"` reveal with none of `animScale`/`animRot`
 * ever set, and (per a `msoAnimEffectColorReveal`/`msoAnimEffectCredits`
 * mismatch discovered in this same pass) the specific `MsoAnimEffect`
 * constant requested did not reliably land on the catalog's assumed id for
 * that gallery name. Rows for ids 27+ are kept here only as a record of what
 * automation produced (still useful: presetId itself is spec-defined and not
 * automation-dependent), NOT as proof of which gallery effect that id
 * "really" is; `PRESET_ID_TO_EFFECT`'s ids 27+ are matched by NAME against
 * the pre-existing, previously-reviewed authoring/catalog tables instead (see
 * the comments next to those entries in `animation-presets-extended.ts`).
 *
 * @module render/animation-preset-ground-truth
 */

/** One COM-observed OOXML `p:cTn` + child-node signature for a preset id. */
export interface AnimationPresetGroundTruthRow {
	presetClass: 'entr' | 'exit';
	presetId: number;
	/** `p:cTn/@presetSubtype`, when present. */
	presetSubtype?: number;
	/** `p:animEffect/@filter`, when the effect carries one. */
	filter?: string;
	/** Whether the saved XML also carried a `p:animScale` node. */
	hasAnimScale: boolean;
	/** Whether the saved XML also carried a `p:animRot` node. */
	hasAnimRot: boolean;
	/** Whether the saved XML also carried a `p:animMotion` node. */
	hasAnimMotion: boolean;
}

interface RowOptions {
	sub?: number;
	filter?: string;
	scale?: boolean;
	rot?: boolean;
	motion?: boolean;
}

/** Build one ground-truth row for both entrance and exit at the same id. */
function bothClasses(id: number, opts: RowOptions = {}): AnimationPresetGroundTruthRow[] {
	return [row('entr', id, opts), row('exit', id, opts)];
}

/** Build one ground-truth row for a single preset class + id. */
function row(
	presetClass: 'entr' | 'exit',
	presetId: number,
	opts: RowOptions = {},
): AnimationPresetGroundTruthRow {
	return {
		presetClass,
		presetId,
		presetSubtype: opts.sub,
		filter: opts.filter,
		hasAnimScale: opts.scale ?? false,
		hasAnimRot: opts.rot ?? false,
		hasAnimMotion: opts.motion ?? false,
	};
}

/**
 * COM-confirmed rows for entrance/exit preset ids 1-26: the band where the
 * requested `MsoAnimEffect` constant's resulting `presetId` independently
 * matches the authoring/catalog identity already established across prior
 * COM-verification waves (see the module doc above). Ids above 26 are
 * omitted here: PowerPoint's `AddEffect` automation is not a reliable source
 * for the gallery-name identity of those ids for the reasons documented
 * above, even though the numeric id it wrote is real.
 */
export const ANIMATION_PRESET_GROUND_TRUTH: readonly AnimationPresetGroundTruthRow[] = [
	...bothClasses(1), // Appear / Disappear
	...bothClasses(2, { sub: 4 }), // Fly In / Fly Out
	...bothClasses(3, { sub: 10, filter: 'blinds(horizontal)' }), // Blinds
	...bothClasses(4, { sub: 16, filter: 'box(in)' }), // Box
	...bothClasses(5, { sub: 10, filter: 'checkerboard(across)' }), // Checkerboard
	...bothClasses(6, { sub: 16, filter: 'circle(in)' }), // Circle
	...bothClasses(7, { sub: 4 }), // Crawl In / Out
	...bothClasses(8, { sub: 16, filter: 'diamond(in)' }), // Diamond
	...bothClasses(9, { filter: 'dissolve' }), // Dissolve
	...bothClasses(10, { filter: 'fade' }), // Fade
	...bothClasses(11), // Flash Once
	row('entr', 12, { sub: 4, filter: 'wipe(up)' }), // Peek In
	row('exit', 12, { sub: 4, filter: 'wipe(down)' }), // Peek "Out" reading (see confidence note)
	...bothClasses(13, { sub: 16, filter: 'plus(in)' }), // Plus
	...bothClasses(14, { sub: 10, filter: 'randombar(horizontal)' }), // Random Bars
	...bothClasses(15), // Spiral In / Out
	...bothClasses(16, { sub: 21, filter: 'barn(inVertical)' }), // Split
	...bothClasses(17, { sub: 10 }), // Stretch
	...bothClasses(18, { sub: 12, filter: 'strips(downLeft)' }), // Strips
	...bothClasses(19, { sub: 10 }), // Swivel
	...bothClasses(20, { filter: 'wedge' }), // Wedge
	...bothClasses(21, { sub: 1, filter: 'wheel(1)' }), // Wheel
	...bothClasses(22, { sub: 4, filter: 'wipe(down)' }), // Wipe
	...bothClasses(23, { sub: 16 }), // Zoom
	...bothClasses(24), // Random Effects
	...bothClasses(25, { filter: 'fade' }), // Boomerang
	...bothClasses(26, { filter: 'wipe(down)', scale: true }), // Bounce
];
