/**
 * COM-derived multi-node emphasis behaviour trees: Pulse (presetID 26),
 * Color Pulse (27), Desaturate (25), Teeter (32) and Wave (34). Method:
 * `AddEffect(shape, <MsoAnimEffect>, msoAnimateLevelNone,
 * msoAnimTriggerOnPageClick)` (`msoAnimEffectFlashBulb` for Pulse and
 * `msoAnimEffectFlicker` for Color Pulse - see the module doc on
 * `animation-emphasis-ground-truth.ts` for why those names, not the ribbon
 * names, are the reachable `MsoAnimEffect` constants), `SaveAs` to `.pptx`,
 * read `ppt/slides/slide1.xml` directly.
 *
 * Blink (35) has NO `MsoAnimEffect` constant at all (ribbon-only per that
 * same ground-truth table) so it could not be reached this way; its
 * template below is a reasonable discrete visibility-toggle approximation
 * (alternating `p:set style.visibility`), not a COM-verified capture, and is
 * flagged as such rather than presented as ground truth.
 *
 * @module services/animation-behavior-emphasis-rich
 */
import type {
	AnimBehaviorNodeSpec,
	AnimationBehaviorTemplate,
} from './animation-behavior-node-types';

const PULSE: AnimationBehaviorTemplate = {
	nodes: [
		{
			kind: 'animEffect',
			transition: 'out',
			filter: 'fade',
			durMs: 1,
			tmFilter: '0, 0; .2, .5; .8, .5; 1, 0',
		},
		{
			kind: 'animScale',
			durMs: 0.5,
			autoRev: true,
			fill: 'hold',
			mode: { form: 'by', x: 105000, y: 105000 },
		},
	],
	baselineDurationMs: 500,
};

const COLOR_PULSE: AnimationBehaviorTemplate = {
	nodes: [
		{
			kind: 'animClr',
			attrName: 'style.color',
			clrSpc: 'rgb',
			durMs: 1,
			autoRev: true,
			fill: 'remove',
			overrideChildStyle: true,
			mode: { form: 'toSchemeClr', val: 'bg1' },
		},
		{
			kind: 'animClr',
			attrName: 'fillcolor',
			clrSpc: 'rgb',
			durMs: 1,
			autoRev: true,
			fill: 'remove',
			mode: { form: 'toSchemeClr', val: 'bg1' },
		},
		{ kind: 'set', attrName: 'fill.type', to: 'solid', durMs: 1, autoRev: true, fill: 'remove' },
		{ kind: 'set', attrName: 'fill.on', to: 'true', durMs: 1, autoRev: true, fill: 'remove' },
	],
	baselineDurationMs: 250,
};

const DESATURATE_HSL = { h: 0, s: -70588, l: 0 };
const DESATURATE: AnimationBehaviorTemplate = {
	nodes: [
		{
			kind: 'animClr',
			attrName: 'style.color',
			clrSpc: 'hsl',
			durMs: 1,
			fill: 'hold',
			overrideChildStyle: true,
			mode: { form: 'byHsl', ...DESATURATE_HSL },
		},
		{
			kind: 'animClr',
			attrName: 'fillcolor',
			clrSpc: 'hsl',
			durMs: 1,
			fill: 'hold',
			mode: { form: 'byHsl', ...DESATURATE_HSL },
		},
		{
			kind: 'animClr',
			attrName: 'stroke.color',
			clrSpc: 'hsl',
			durMs: 1,
			fill: 'hold',
			mode: { form: 'byHsl', ...DESATURATE_HSL },
		},
		{ kind: 'set', attrName: 'fill.type', to: 'solid', durMs: 1, fill: 'hold' },
	],
	baselineDurationMs: 500,
};

/** Teeter: 5 successive small oscillating rotations (degrees, as 60000ths). */
const TEETER_STEPS: ReadonlyArray<{ delay: number; dur: number; by: number }> = [
	{ delay: 0, dur: 100, by: 120000 },
	{ delay: 200, dur: 200, by: -240000 },
	{ delay: 400, dur: 200, by: 240000 },
	{ delay: 600, dur: 200, by: -240000 },
	{ delay: 800, dur: 200, by: 120000 },
];
const TEETER_BASELINE = 1000;
const TEETER: AnimationBehaviorTemplate = {
	nodes: TEETER_STEPS.map((step) => ({
		kind: 'animRot',
		durMs: step.dur / TEETER_BASELINE,
		delayMs: step.delay / TEETER_BASELINE,
		fill: 'hold',
		by: step.by,
	})),
	baselineDurationMs: TEETER_BASELINE,
};

/** Wave: a small relative motion-path ripple plus 4 small counter-rotations. */
const WAVE_BASELINE = 500;
const WAVE_ROT_STEPS: ReadonlyArray<{ delay: number; by: number }> = [
	{ delay: 0, by: 1500000 },
	{ delay: 125, by: -1500000 },
	{ delay: 250, by: -1500000 },
	{ delay: 375, by: 1500000 },
];
const WAVE: AnimationBehaviorTemplate = {
	nodes: [
		{
			kind: 'animMotion',
			path: 'M 0.0 0.0 L 0.0 -0.07213',
			origin: 'layout',
			pathEditMode: 'relative',
			durMs: 250 / WAVE_BASELINE,
			accel: 50000,
			decel: 50000,
			autoRev: true,
			fill: 'hold',
		},
		...WAVE_ROT_STEPS.map((step): AnimBehaviorNodeSpec => ({
			kind: 'animRot',
			durMs: 125 / WAVE_BASELINE,
			delayMs: step.delay / WAVE_BASELINE,
			fill: 'hold',
			by: step.by,
		})),
	],
	baselineDurationMs: WAVE_BASELINE,
};

/** Blink: NOT COM-verified (ribbon-only, no reachable `MsoAnimEffect`); a discrete toggle approximation. */
const BLINK_BASELINE = 1000;
const BLINK: AnimationBehaviorTemplate = {
	nodes: [0, 0.25, 0.5, 0.75].map((fraction, i): AnimBehaviorNodeSpec => ({
		kind: 'set',
		attrName: 'style.visibility',
		to: i % 2 === 0 ? 'hidden' : 'visible',
		durMs: 1 / BLINK_BASELINE,
		delayMs: fraction,
	})),
	baselineDurationMs: BLINK_BASELINE,
};

/** Look up the Desaturate (25), Pulse (26), Color Pulse (27), Teeter (32), Wave (34) or Blink (35) template. */
export function getRichEmphasisTemplate(presetId: number): AnimationBehaviorTemplate | undefined {
	switch (presetId) {
		case 25:
			return DESATURATE;
		case 26:
			return PULSE;
		case 27:
			return COLOR_PULSE;
		case 32:
			return TEETER;
		case 34:
			return WAVE;
		case 35:
			return BLINK;
		default:
			return undefined;
	}
}
