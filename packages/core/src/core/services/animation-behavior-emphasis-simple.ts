/**
 * COM-derived single-phase emphasis behaviour trees: Grow/Shrink (presetID
 * 6), Spin (8) and Transparency (9). Method: `AddEffect(shape,
 * <MsoAnimEffect>, msoAnimateLevelNone, msoAnimTriggerOnPageClick)`, `SaveAs`
 * to `.pptx`, read `ppt/slides/slide1.xml` directly. All three are exactly
 * one or two behaviour nodes with a single duration, so unlike Bounce/Float/
 * Grow & Turn they need no multi-phase fraction table.
 *
 * Transparency's real shape is a DISCRETE `p:set style.opacity=0.5` plus a
 * `p:animEffect filter="image"` (an IE-era rendering hint, `prLst="opacity:
 * 0.5"`), not an animated fade tween: this replaces the pre-existing
 * `OPACITY_EMPHASIS` bucket's 3-stop `0 -> 0.4 -> 1` flash tween for this
 * preset specifically (that tween remains correct for `flash`/`boldFlash`,
 * which this same COM pass found actually drive `style.fontWeight`, not
 * opacity at all - left as a separate, out-of-scope finding).
 *
 * @module services/animation-behavior-emphasis-simple
 */
import type { AnimationBehaviorTemplate } from './animation-behavior-node-types';

const GROW_SHRINK: AnimationBehaviorTemplate = {
	nodes: [
		{ kind: 'animScale', durMs: 1, fill: 'hold', mode: { form: 'by', x: 150000, y: 150000 } },
	],
	baselineDurationMs: 2000,
};

const SPIN: AnimationBehaviorTemplate = {
	nodes: [{ kind: 'animRot', durMs: 1, fill: 'hold', by: 21600000 }],
	baselineDurationMs: 2000,
};

const TRANSPARENCY: AnimationBehaviorTemplate = {
	nodes: [
		{ kind: 'set', attrName: 'style.opacity', to: '0.5', durMs: 1 },
		{ kind: 'animEffect', prLst: 'opacity: 0.5', durMs: 1 },
	],
	baselineDurationMs: 500,
};

/** Look up the Grow/Shrink (6), Spin (8) or Transparency (9) emphasis template. */
export function getSimpleEmphasisTemplate(presetId: number): AnimationBehaviorTemplate | undefined {
	switch (presetId) {
		case 6:
			return GROW_SHRINK;
		case 8:
			return SPIN;
		case 9:
			return TRANSPARENCY;
		default:
			return undefined;
	}
}
