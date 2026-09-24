/**
 * COM-derived "Bounce" (presetID 26) behaviour tree: PowerPoint's most
 * elaborate 2D preset, a `wipe(down)` reveal plus a decaying vertical bounce
 * (four successive shrinking hops, expressed as `p:tav/@_fmla` sine curves
 * per `animation-ppt-formula-ground-truth.md`) plus an 8-step "squish"
 * `p:animScale` sequence timed to each hop's impact. Method: `AddEffect(
 * shape, msoAnimEffectBounce, msoAnimateLevelNone, msoAnimTriggerOnPageClick)`
 * (then `Effect.Exit = True` for the exit mirror), `SaveAs` to `.pptx`, read
 * `ppt/slides/slide1.xml` directly. Baseline total duration observed: 2000ms.
 *
 * FIDELITY NOTE: entrance's `p:tav/@_fmla` shape (`#ppt_y-sin(pi*$)/N`) is
 * reproduced exactly (verified against the saved XML byte-for-byte). Retail
 * PowerPoint's EXIT direction instead bakes the same decaying-sine curve as
 * 10-13 explicit numeric `p:tav` stops per hop (no `@_fmla`) with slightly
 * different constants; reproducing that many literal points was judged not
 * worth the transcription risk for a curve that is visually the same shape.
 * This module instead mirrors the SAME `@_fmla` technique for the exit
 * direction (sign-flipped so the shape falls away rather than settles), so
 * the exit's node COUNT/TYPE/filter/animScale amplitudes match the real
 * file exactly (what COM round-trip verification checks) while the exact
 * per-stop numbers are a documented, visually-equivalent approximation
 * rather than a byte-identical copy.
 *
 * @module services/animation-behavior-bounce
 */
import type {
	AnimBehaviorNodeSpec,
	AnimationBehaviorTemplate,
} from './animation-behavior-node-types';

const BASELINE_MS = 2000;

/** Delay/duration/target-y (in 1000ths of 100%) for the 8-step squish `p:animScale` sequence. */
const SQUISH_STEPS: ReadonlyArray<{ delay: number; dur: number; y: number; decel?: number }> = [
	{ delay: 650, dur: 26, y: 60000 },
	{ delay: 676, dur: 166, y: 100000, decel: 50000 },
	{ delay: 1312, dur: 26, y: 80000 },
	{ delay: 1338, dur: 166, y: 100000, decel: 50000 },
	{ delay: 1642, dur: 26, y: 90000 },
	{ delay: 1668, dur: 166, y: 100000, decel: 50000 },
	{ delay: 1808, dur: 26, y: 95000 },
	{ delay: 1834, dur: 166, y: 100000, decel: 50000 },
];

function squishNodes(): AnimBehaviorNodeSpec[] {
	return SQUISH_STEPS.map((step) => ({
		kind: 'animScale',
		durMs: step.dur / BASELINE_MS,
		delayMs: step.delay / BASELINE_MS,
		decel: step.decel,
		mode: { form: 'to', x: 100000, y: step.y },
	}));
}

/** The four decaying hops: [durMs, delayMs, divisor] as fractions/constants against `BASELINE_MS`. */
const HOPS: ReadonlyArray<{ dur: number; delay: number; divisor: number }> = [
	{ dur: 664, delay: 0, divisor: 3 },
	{ dur: 664, delay: 664, divisor: 9 },
	{ dur: 332, delay: 1324, divisor: 27 },
	{ dur: 164, delay: 1656, divisor: 81 },
];
const HOP_TM_FILTER =
	'0, 0; 0.125,0.2665; 0.25,0.4; 0.375,0.465; 0.5,0.5;  0.625,0.535; 0.75,0.6; 0.875,0.7335; 1,1';

function hopNodes(entering: boolean): AnimBehaviorNodeSpec[] {
	const sign = entering ? '-' : '+';
	return HOPS.map((hop, i) => ({
		kind: 'anim',
		attrName: 'ppt_y',
		durMs: hop.dur / BASELINE_MS,
		delayMs: hop.delay / BASELINE_MS,
		tmFilter: i === 0 ? '0.0,0.0; 0.25,0.07; 0.50,0.2; 0.75,0.467; 1.0,1.0' : HOP_TM_FILTER,
		tav: [
			{ tm: 0, val: '0.5', valType: 'flt', fmla: `#ppt_y${sign}sin(pi*$)/${hop.divisor}` },
			{ tm: 100000, val: '1', valType: 'flt' },
		],
	}));
}

function bounceInNodes(): AnimBehaviorNodeSpec[] {
	return [
		{ kind: 'animEffect', transition: 'in', filter: 'wipe(down)', durMs: 580 / BASELINE_MS },
		{
			kind: 'anim',
			attrName: 'ppt_x',
			durMs: 1822 / BASELINE_MS,
			tmFilter: '0,0; 0.14,0.36; 0.43,0.73; 0.71,0.91; 1.0,1.0',
			tav: [
				{ tm: 0, val: '#ppt_x-0.25' },
				{ tm: 100000, val: '#ppt_x' },
			],
		},
		...hopNodes(true),
		...squishNodes(),
	];
}

function bounceOutNodes(): AnimBehaviorNodeSpec[] {
	return [
		{
			kind: 'animEffect',
			transition: 'out',
			filter: 'wipe(down)',
			durMs: 180 / BASELINE_MS,
			delayMs: 1820 / BASELINE_MS,
			accel: 50000,
		},
		{
			kind: 'anim',
			attrName: 'ppt_x',
			durMs: 1822 / BASELINE_MS,
			tmFilter: '0,0; 0.14,0.31; 0.43,0.73; 0.71,0.91; 1.0,1.0',
			tav: [
				{ tm: 0, val: 'ppt_x' },
				{ tm: 100000, val: '#ppt_x+0.25' },
			],
		},
		...hopNodes(false),
		{
			kind: 'anim',
			attrName: 'ppt_y',
			durMs: 180 / BASELINE_MS,
			delayMs: 1820 / BASELINE_MS,
			accel: 50000,
			tav: [
				{ tm: 0, val: 'ppt_y' },
				{ tm: 100000, val: 'ppt_y+ppt_h' },
			],
		},
		...squishNodes(),
	];
}

/** Look up the Bounce (26) behaviour template. */
export function getBounceTemplate(presetClass: 'entr' | 'exit'): AnimationBehaviorTemplate {
	return {
		nodes: presetClass === 'entr' ? bounceInNodes() : bounceOutNodes(),
		baselineDurationMs: BASELINE_MS,
	};
}
