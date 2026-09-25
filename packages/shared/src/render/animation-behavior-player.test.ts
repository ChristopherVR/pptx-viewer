import type {
	PptxAnimationBehavior,
	PptxAnimationBehaviorTiming,
	PptxAnimationKeyframe,
	PptxNativeAnimation,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildBehaviorKeyframes } from './animation-behavior-keyframes';
import { createBehaviorPlayer } from './animation-behavior-player';
import type { AnimationElementBox } from './animation-render-context';
import { buildTimeline } from './animation-timeline-builder';

// Behaviour trees shaped exactly like PowerPoint writes them (core's
// `animation-behavior-captures.json`).
function visibility(
	value: 'visible' | 'hidden',
	timing: PptxAnimationBehaviorTiming = { durationMs: 1 },
): PptxAnimationBehavior {
	return { kind: 'set', attrNames: ['style.visibility'], value, timing };
}

function tav(tm: number, value: string | number, fmla?: string): PptxAnimationKeyframe {
	return {
		tm,
		value,
		valueType: typeof value === 'number' ? 'flt' : 'str',
		...(fmla ? { fmla } : {}),
	};
}

function ramp(
	attr: string,
	from: string | number,
	to: string | number,
	timing: PptxAnimationBehaviorTiming,
): PptxAnimationBehavior {
	return {
		kind: 'anim',
		attrNames: [attr],
		calcMode: 'lin',
		valueType: 'num',
		keyframes: [tav(0, from), tav(100000, to)],
		timing,
	};
}

function effect(
	presetClass: 'entr' | 'exit',
	behaviors: PptxAnimationBehavior[],
	durationMs: number,
	extra: Partial<PptxNativeAnimation> = {},
): PptxNativeAnimation {
	return { presetClass, behaviors, durationMs, targetId: 'shape-1', ...extra };
}

/** A 200 x 200 px square at (380, 170) on a 960 x 540 slide. */
const BOX: AnimationElementBox = {
	x: 380 / 960,
	y: 170 / 540,
	width: 200 / 960,
	height: 200 / 540,
	slideAspect: 960 / 540,
};

const flyInFromLeft = (ms: number): PptxAnimationBehavior[] => [
	visibility('visible'),
	ramp('ppt_x', '0-#ppt_w/2', '#ppt_x', { durationMs: ms }),
	ramp('ppt_y', '#ppt_y', '#ppt_y', { durationMs: ms }),
];

describe('createBehaviorPlayer: Fly', () => {
	it('starts a Fly In just off the slide edge, so the distance depends on position', () => {
		// CreateVideo: a 200 px square at x = 380 enters at x = -200 and
		// travels 580 px; a 100 px one at x = 100 travels 200 px.
		const player = createBehaviorPlayer(effect('entr', flyInFromLeft(2000), 2000), BOX)!;
		const start = player.frameAt(0);
		expect(start.dx).toBeCloseTo(-(BOX.x + BOX.width), 6);
		expect(start.dy).toBe(0);
		expect(player.frameAt(1000).dx).toBeCloseTo(-(BOX.x + BOX.width) / 2, 6);
		expect(player.frameAt(2000).dx).toBeCloseTo(0, 9);

		const near = { ...BOX, x: 100 / 960, width: 100 / 960 };
		const small = createBehaviorPlayer(effect('entr', flyInFromLeft(2000), 2000), near)!;
		expect(small.frameAt(0).dx).toBeCloseTo(-200 / 960, 6);
	});

	it('never fades a Fly In: it is opaque from its first instant', () => {
		const player = createBehaviorPlayer(effect('entr', flyInFromLeft(500), 500), BOX)!;
		expect(player.frameAt(0).opacity).toBe(1);
		expect(player.frameAt(250).opacity).toBe(1);
	});

	it('holds a Fly Out opaque until its closing visibility set, then hides it', () => {
		const behaviors = [
			ramp('ppt_x', 'ppt_x', 'ppt_x', { durationMs: 2000 }),
			ramp('ppt_y', 'ppt_y', '1+ppt_h/2', { durationMs: 2000 }),
			visibility('hidden', { durationMs: 1, delayMs: 1999 }),
		];
		const player = createBehaviorPlayer(effect('exit', behaviors, 2000), BOX)!;
		expect(player.frameAt(1998).opacity).toBe(1);
		expect(player.frameAt(1999).opacity).toBe(0);
		// Ends with its top edge on the slide's bottom edge.
		expect(BOX.y + BOX.height / 2 + player.frameAt(2000).dy).toBeCloseTo(1 + BOX.height / 2, 6);
	});
});

describe('createBehaviorPlayer: composed presets', () => {
	it('reads a bare ppt_w as the value when that behaviour starts (Boomerang exit)', () => {
		// Shrink to 5% over the first half, then `ppt_w` -> `ppt_w/.05` grows
		// from that sliver back to full width (CreateVideo: 14 px wide at 1 s).
		const behaviors = [
			ramp('ppt_w', 'ppt_w', 'ppt_w*.05', { durationMs: 1000 }),
			ramp('ppt_w', 'ppt_w', 'ppt_w/.05', { durationMs: 1000, delayMs: 1000 }),
		];
		const player = createBehaviorPlayer(
			effect('exit', [...behaviors, visibility('hidden', { durationMs: 1, delayMs: 1999 })], 2000),
			BOX,
		)!;
		expect(player.frameAt(1000).scaleX).toBeCloseTo(0.05, 6);
		expect(player.frameAt(1500).scaleX).toBeCloseTo(0.525, 6);
		expect(player.frameAt(2000).scaleX).toBeCloseTo(1, 6);
	});

	it('spreads the effect accel over each behaviour (Swish drops in on its first leg)', () => {
		// Swish: effect accel 50%, first ppt_y leg over the first 45.5%.
		const leg = ramp('ppt_y', '#ppt_y-1', '#ppt_y', { durationMs: 910 });
		const player = createBehaviorPlayer(
			effect('entr', [visibility('visible'), leg], 2000, { accel: 0.5 }),
			BOX,
		)!;
		// The leg ends at 910 ms, not after a ramp stretched over 2 s.
		expect(player.frameAt(910).dy).toBeCloseTo(0, 9);
		// Half-cosine ramp over the leg's first half: slower than linear.
		expect(-player.frameAt(455).dy).toBeGreaterThan(0.5);
	});

	it('masks a Peek from its wipe edge while it rises', () => {
		const behaviors: PptxAnimationBehavior[] = [
			visibility('visible'),
			ramp('ppt_y', '#ppt_y+#ppt_h', '#ppt_y', { durationMs: 1000 }),
			{
				kind: 'animEffect',
				attrNames: [],
				filter: 'wipe(up)',
				transition: 'in',
				timing: { durationMs: 1000 },
			},
		];
		const player = createBehaviorPlayer(effect('entr', behaviors, 1000), BOX)!;
		// `wipe(up)` reveals from the TOP edge, so the rising shape shows its
		// top first, clipped at its resting bottom edge.
		expect(player.frameAt(250).wipe).toStrictEqual({ edge: 'top', revealed: 0.25 });
	});

	it('conceals a wipe exit from its edge', () => {
		const behaviors: PptxAnimationBehavior[] = [
			ramp('ppt_y', 'ppt_y', 'ppt_y+ppt_h', { durationMs: 1000 }),
			{
				kind: 'animEffect',
				attrNames: [],
				filter: 'wipe(down)',
				transition: 'out',
				timing: { durationMs: 1000 },
			},
		];
		const player = createBehaviorPlayer(effect('exit', behaviors, 1000), BOX)!;
		expect(player.frameAt(250).wipe).toStrictEqual({ edge: 'top', revealed: 0.75 });
	});

	it('moves along a motion path at an even pace', () => {
		const path: PptxAnimationBehavior = {
			kind: 'animMotion',
			attrNames: ['ppt_x', 'ppt_y'],
			// A long first leg then a short second one, in slide fractions.
			path: 'M 0 0 L 0.3 0 L 0.3 0.1',
			timing: { durationMs: 1000 },
		};
		const player = createBehaviorPlayer(effect('entr', [visibility('visible'), path], 1000), {
			...BOX,
			slideAspect: 1,
		})!;
		// 0.3 of 0.4 total length: 75% of the time reaches the corner.
		expect(player.frameAt(750).dx).toBeCloseTo(0.3, 6);
		expect(player.frameAt(750).dy).toBeCloseTo(0, 6);
	});

	it('declines a tree with no transform, an unknown attribute or no box', () => {
		const fadeOnly: PptxAnimationBehavior[] = [
			visibility('visible'),
			{ kind: 'animEffect', attrNames: [], filter: 'fade', transition: 'in', timing: {} },
		];
		expect(createBehaviorPlayer(effect('entr', fadeOnly, 500), BOX)).toBeUndefined();
		const colour = [ramp('fillcolor', 0, 1, { durationMs: 500 }), ...flyInFromLeft(500)];
		expect(createBehaviorPlayer(effect('entr', colour, 500), BOX)).toBeUndefined();
		expect(
			createBehaviorPlayer(effect('entr', flyInFromLeft(500), 500), undefined),
		).toBeUndefined();
	});
});

describe('buildBehaviorKeyframes', () => {
	it('keeps a linear Fly to its breakpoints and hides it during the delay', () => {
		const built = buildBehaviorKeyframes(effect('entr', flyInFromLeft(2000), 2000), 3, BOX)!;
		expect(built.keyframeName).toBe('pptx-tl-bhvr-3');
		expect(built.easing).toBeUndefined();
		const lines = built.css.split('\n').filter((line) => line.includes('%'));
		expect(lines[0]).toContain('0% { opacity: 0;');
		expect(lines[1]).toContain('0.001% { opacity: 1;');
		expect(lines[1]).toContain(`* ${Number((-(BOX.x + BOX.width)).toFixed(4))})`);
		expect(lines.length).toBeLessThan(8);
		expect(built.css).not.toContain('scale(');
	});

	it('bakes the effect accel/decel into dense samples and plays the step linearly', () => {
		const built = buildBehaviorKeyframes(
			effect('entr', flyInFromLeft(1000), 1000, { accel: 0.5 }),
			0,
			BOX,
		)!;
		expect(built.easing).toBe('linear');
		expect(built.css.split('\n').filter((line) => line.includes('%')).length).toBeGreaterThan(50);
	});

	it('holds an exit opaque up to its closing visibility set', () => {
		const behaviors = [
			ramp('ppt_y', 'ppt_y', '1+ppt_h/2', { durationMs: 2000 }),
			visibility('hidden', { durationMs: 1, delayMs: 1999 }),
		];
		const css = buildBehaviorKeyframes(effect('exit', behaviors, 2000), 0, BOX)!.css;
		expect(css).toContain('99.949% { opacity: 1;');
		expect(css).toContain('99.95% { opacity: 0;');
	});
});

describe('buildTimeline with behaviour trees', () => {
	const anim = effect('entr', flyInFromLeft(2000), 2000, {
		trigger: 'onClick',
		presetId: 2,
		presetSubtype: 8,
	});
	const context = { getElementBox: (id: string) => (id === 'shape-1' ? BOX : undefined) };

	it('plays the deck tree when the element box is known', () => {
		const timeline = buildTimeline([anim], context);
		expect(timeline.clickGroups[0].steps[0].keyframeName).toBe('pptx-tl-bhvr-0');
		expect(timeline.keyframesCss).toContain('@keyframes pptx-tl-bhvr-0');
	});

	it('keeps the preset keyframe without a box', () => {
		const timeline = buildTimeline([anim]);
		expect(timeline.clickGroups[0].steps[0].keyframeName).toBe('pptx-flyInLeft');
	});
});
