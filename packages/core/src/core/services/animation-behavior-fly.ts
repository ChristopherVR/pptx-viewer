/**
 * COM-derived "Fly In"/"Fly Out" (presetID 2, all 8 `presetSubtype`
 * directions) behaviour tree. Method: eight rectangles, one per direction,
 * `Slide.TimeLine.MainSequence.AddEffect(shape, msoAnimEffectFly,
 * msoAnimateLevelNone, msoAnimTriggerOnPageClick)` with
 * `Effect.EffectParameters.Direction` set to each of the 8 `MsoAnimDirection`
 * values, then the same again with `Effect.Exit = True` for the exit
 * mirror; `SaveAs` to `.pptx` and read each shape's own
 * `p:cTn/@_presetSubtype` plus its two `p:anim` (`ppt_x`/`ppt_y`) children's
 * `p:tavLst` stops directly from the saved `ppt/slides/slide1.xml`.
 *
 * Real Fly In/Out carries NO `p:animEffect` at all: motion is a plain
 * `p:anim` pair on `ppt_x`/`ppt_y` (the shape's own authored centre position,
 * expressed as a slide-fraction, offset by `+-` half the shape's own
 * width/height so it starts/ends flush with the slide edge). This matches
 * `DIRECTION_TO_SUBTYPE` in `animation-write-mappings-motion.ts` exactly
 * (independently re-derived here, not assumed): subtype 1 = from/to Top,
 * 2 = Right, 3 = Top-Right, 4 = Bottom, 6 = Bottom-Right, 8 = Left,
 * 9 = Top-Left, 12 = Bottom-Left.
 *
 * @module services/animation-behavior-fly
 */
import type {
	AnimBehaviorNodeSpec,
	AnimationBehaviorTemplate,
} from './animation-behavior-node-types';

/** One direction's off-slide edge, as `(dx, dy)` fractions of the shape's own width/height. */
interface FlyOffset {
	/** `x` offset formula suffix, or `undefined` for "no horizontal offset". */
	dx?: 'left' | 'right';
	dy?: 'top' | 'bottom';
}

/** `DIRECTION_TO_SUBTYPE` (`animation-write-mappings-motion.ts`), re-verified via COM above. */
const SUBTYPE_TO_OFFSET: Readonly<Record<number, FlyOffset>> = {
	1: { dy: 'top' },
	2: { dx: 'right' },
	3: { dx: 'right', dy: 'top' },
	4: { dy: 'bottom' },
	6: { dx: 'right', dy: 'bottom' },
	8: { dx: 'left' },
	9: { dx: 'left', dy: 'top' },
	12: { dx: 'left', dy: 'bottom' },
};

function entranceFormula(
	axis: 'x' | 'y',
	edge: 'left' | 'right' | 'top' | 'bottom' | undefined,
): string {
	if (!edge) {
		return `#ppt_${axis}`;
	}
	// Off-slide start: top/left = negative half-extent past the edge; bottom/right = 1 + half-extent.
	const dim = axis === 'x' ? 'w' : 'h';
	return edge === 'top' || edge === 'left' ? `0-#ppt_${dim}/2` : `1+#ppt_${dim}/2`;
}

function exitFormula(
	axis: 'x' | 'y',
	edge: 'left' | 'right' | 'top' | 'bottom' | undefined,
): string {
	if (!edge) {
		return axis === 'x' ? 'ppt_x' : 'ppt_y';
	}
	const dim = axis === 'x' ? 'w' : 'h';
	return edge === 'top' || edge === 'left' ? `0-ppt_${dim}/2` : `1+ppt_${dim}/2`;
}

/** Build the (fraction-of-duration = 1.0, single-phase) Fly In/Out template for one subtype. */
export function getFlyBehaviorTemplate(
	presetClass: 'entr' | 'exit',
	presetSubtype: number,
): AnimationBehaviorTemplate | undefined {
	const offset = SUBTYPE_TO_OFFSET[presetSubtype];
	if (!offset) {
		return undefined;
	}
	const nodes: AnimBehaviorNodeSpec[] =
		presetClass === 'entr'
			? [
					{
						kind: 'anim',
						attrName: 'ppt_x',
						durMs: 1,
						tav: [
							{ tm: 0, val: entranceFormula('x', offset.dx) },
							{ tm: 100000, val: '#ppt_x' },
						],
					},
					{
						kind: 'anim',
						attrName: 'ppt_y',
						durMs: 1,
						tav: [
							{ tm: 0, val: entranceFormula('y', offset.dy) },
							{ tm: 100000, val: '#ppt_y' },
						],
					},
				]
			: [
					{
						kind: 'anim',
						attrName: 'ppt_x',
						durMs: 1,
						tav: [
							{ tm: 0, val: 'ppt_x' },
							{ tm: 100000, val: exitFormula('x', offset.dx) },
						],
					},
					{
						kind: 'anim',
						attrName: 'ppt_y',
						durMs: 1,
						tav: [
							{ tm: 0, val: 'ppt_y' },
							{ tm: 100000, val: exitFormula('y', offset.dy) },
						],
					},
				];
	return { nodes, baselineDurationMs: 500 };
}
