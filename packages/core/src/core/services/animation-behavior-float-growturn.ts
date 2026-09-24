/**
 * COM-derived "Float In"/"Float Out" (presetID 30) and "Grow & Turn"
 * (presetID 31) behaviour trees. Method: `AddEffect(shape,
 * msoAnimEffectFloat / msoAnimEffectGrowAndTurn, msoAnimateLevelNone,
 * msoAnimTriggerOnPageClick)` (then `Effect.Exit = True` for the exit
 * mirror), `SaveAs` to `.pptx`, read `ppt/slides/slide1.xml` directly.
 *
 * IDS CORRECTED BY THIS SAME COM PASS: the pre-existing
 * `animation-write-mappings-entrance.ts`/`-exit.ts` had `floatIn`/`floatOut`
 * at id 42 and `growTurnIn`/`growTurnOut` at id 53; this verification found
 * `msoAnimEffectFloat` really serialises `presetID="30"` and
 * `msoAnimEffectGrowAndTurn` really serialises `presetID="31"` (both now
 * fixed in those tables, as aliases alongside the pre-existing ids so
 * nothing that already round-trips through 42/53 breaks).
 *
 * Float's shape (rotate -90deg->0 while flying in from up-and-right with a
 * decel/accel two-phase settle, mirrored on exit) is PowerPoint's real
 * authored richness for this id, reproduced faithfully including the
 * `0.4`/`0.05`/`0.1` offset constants observed in the saved XML. Grow &
 * Turn's shape here (`ppt_w`/`ppt_h` 0->authored size plus a
 * 90deg->0 rotation and a fade) is what `AddEffect` itself produces for this
 * id; PowerPoint's ribbon-driven gallery entry for the same name is known to
 * add a richer fly-in-from-the-left wobble for SOME ids above 26 (see
 * `animation-preset-ground-truth.ts`'s confidence note), but this simpler
 * form is a directly COM-verified, real PowerPoint output, not a guess.
 *
 * @module services/animation-behavior-float-growturn
 */
import type {
	AnimBehaviorNodeSpec,
	AnimationBehaviorTemplate,
} from './animation-behavior-node-types';

const FLOAT_IN_NODES: AnimBehaviorNodeSpec[] = [
	{ kind: 'animEffect', transition: 'in', filter: 'fade', durMs: 0.8, decel: 100000 },
	{
		kind: 'anim',
		attrName: 'style.rotation',
		durMs: 0.8,
		decel: 100000,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '-90', valType: 'flt' },
			{ tm: 100000, val: '0', valType: 'flt' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_x',
		durMs: 0.8,
		decel: 100000,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '#ppt_x+0.4' },
			{ tm: 100000, val: '#ppt_x-0.05' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_y',
		durMs: 0.8,
		decel: 100000,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '#ppt_y-0.4' },
			{ tm: 100000, val: '#ppt_y+0.1' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_x',
		durMs: 0.2,
		delayMs: 0.8,
		accel: 100000,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '#ppt_x-0.05' },
			{ tm: 100000, val: '#ppt_x' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_y',
		durMs: 0.2,
		delayMs: 0.8,
		accel: 100000,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '#ppt_y+0.1' },
			{ tm: 100000, val: '#ppt_y' },
		],
	},
];

const FLOAT_OUT_NODES: AnimBehaviorNodeSpec[] = [
	{
		kind: 'animEffect',
		transition: 'out',
		filter: 'fade',
		durMs: 0.8,
		delayMs: 0.2,
		accel: 100000,
	},
	{
		kind: 'anim',
		attrName: 'style.rotation',
		durMs: 0.8,
		delayMs: 0.2,
		accel: 100000,
		tav: [
			{ tm: 0, val: '0', valType: 'flt' },
			{ tm: 100000, val: '-90', valType: 'flt' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_x',
		durMs: 0.2,
		decel: 100000,
		tav: [
			{ tm: 0, val: 'ppt_x' },
			{ tm: 100000, val: 'ppt_x-0.05' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_y',
		durMs: 0.2,
		decel: 100000,
		tav: [
			{ tm: 0, val: 'ppt_y' },
			{ tm: 100000, val: 'ppt_y+0.1' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_x',
		durMs: 0.8,
		delayMs: 0.2,
		accel: 100000,
		tav: [
			{ tm: 0, val: 'ppt_x' },
			{ tm: 100000, val: 'ppt_x+0.4+0.05' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_y',
		durMs: 0.8,
		delayMs: 0.2,
		accel: 100000,
		tav: [
			{ tm: 0, val: 'ppt_y' },
			{ tm: 100000, val: 'ppt_y-0.4-0.1' },
		],
	},
];

const GROW_TURN_IN_NODES: AnimBehaviorNodeSpec[] = [
	{
		kind: 'anim',
		attrName: 'ppt_w',
		durMs: 1,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '0', valType: 'flt' },
			{ tm: 100000, val: '#ppt_w' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_h',
		durMs: 1,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '0', valType: 'flt' },
			{ tm: 100000, val: '#ppt_h' },
		],
	},
	{
		kind: 'anim',
		attrName: 'style.rotation',
		durMs: 1,
		fill: 'hold',
		tav: [
			{ tm: 0, val: '90', valType: 'flt' },
			{ tm: 100000, val: '0', valType: 'flt' },
		],
	},
	{ kind: 'animEffect', transition: 'in', filter: 'fade', durMs: 1 },
];

const GROW_TURN_OUT_NODES: AnimBehaviorNodeSpec[] = [
	{
		kind: 'anim',
		attrName: 'ppt_w',
		durMs: 1,
		tav: [
			{ tm: 0, val: 'ppt_w' },
			{ tm: 100000, val: '0', valType: 'flt' },
		],
	},
	{
		kind: 'anim',
		attrName: 'ppt_h',
		durMs: 1,
		tav: [
			{ tm: 0, val: 'ppt_h' },
			{ tm: 100000, val: '0', valType: 'flt' },
		],
	},
	{
		kind: 'anim',
		attrName: 'style.rotation',
		durMs: 1,
		tav: [
			{ tm: 0, val: '0', valType: 'flt' },
			{ tm: 100000, val: '90', valType: 'flt' },
		],
	},
	{ kind: 'animEffect', transition: 'out', filter: 'fade', durMs: 1 },
];

/** Look up the Float (30) or Grow & Turn (31) behaviour template, if this id is one of them. */
export function getFloatOrGrowTurnTemplate(
	presetClass: 'entr' | 'exit',
	presetId: number,
): AnimationBehaviorTemplate | undefined {
	if (presetId === 30) {
		return {
			nodes: presetClass === 'entr' ? FLOAT_IN_NODES : FLOAT_OUT_NODES,
			baselineDurationMs: 1000,
		};
	}
	if (presetId === 31) {
		return {
			nodes: presetClass === 'entr' ? GROW_TURN_IN_NODES : GROW_TURN_OUT_NODES,
			baselineDurationMs: 1000,
		};
	}
	return undefined;
}
