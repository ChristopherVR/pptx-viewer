/**
 * `animation-behavior-keyframes` - bake a {@link BehaviorPlayer} into one CSS
 * `@keyframes` block for the click-group timeline.
 *
 * A purely linear tree (Fly, Crawl) needs only its breakpoints. Anything
 * curved (formula stops, accel/decel, `tmFilter`, motion paths) is sampled
 * densely. The effect's own accel/decel is baked into the samples too (it
 * applies per behaviour, see `animation-behavior-timing`), and the step is
 * then played linearly: a CSS timing function applies per keyframe
 * interval, so it could not express that ramp over many stops anyway.
 *
 * @module render/animation-behavior-keyframes
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';

import type { BehaviorFrame } from './animation-behavior-player';
import { createBehaviorPlayer } from './animation-behavior-player';
import type { RevealEdge } from './animation-mask-reveal';
import { maskEdgePartialDecl } from './animation-mask-reveal';
import type { AnimationElementBox } from './animation-render-context';

/** Uniform samples across a curved effect (every ~1.7% of its duration). */
const DENSE_SAMPLES = 60;

/** Offset (fraction of the effect) that holds a value just before a discrete change. */
const HOLD_EPSILON = 0.00001;

export interface BehaviorKeyframes {
	keyframeName: string;
	css: string;
	/** Set when the effect's accel/decel was baked into the samples: play the step linearly. */
	easing?: 'linear';
}

function fmt(value: number, digits: number = 4): string {
	const rounded = Number(value.toFixed(digits));
	return String(Object.is(rounded, -0) ? 0 : rounded);
}

interface Usage {
	/** Slide size in px, when the caller measured it; else the stage's CSS variables. */
	slidePx?: { width: number; height: number };
	rotate: boolean;
	shear: boolean;
	scale: boolean;
	/** The wipe edge, when any frame masks: every frame then carries a mask so it interpolates. */
	wipeEdge?: RevealEdge;
}

function declarations(frame: BehaviorFrame, usage: Usage): string {
	const parts = [
		usage.slidePx
			? `translate(${fmt(frame.dx * usage.slidePx.width, 2)}px, ${fmt(frame.dy * usage.slidePx.height, 2)}px)`
			: `translate(calc(var(--pptx-slide-w, 1280px) * ${fmt(frame.dx)}), calc(var(--pptx-slide-h, 720px) * ${fmt(frame.dy)}))`,
	];
	if (usage.rotate) {
		parts.push(`rotate(${fmt(frame.rotation, 2)}deg)`);
	}
	if (usage.shear) {
		parts.push(`skewX(${fmt((Math.atan(frame.shearX) * 180) / Math.PI, 2)}deg)`);
	}
	if (usage.scale) {
		parts.push(`scale(${fmt(frame.scaleX)}, ${fmt(frame.scaleY)})`);
	}
	const mask = usage.wipeEdge
		? ` ${maskEdgePartialDecl(usage.wipeEdge, frame.wipe?.revealed ?? 1)}`
		: '';
	return `opacity: ${fmt(frame.opacity, 3)}; transform: ${parts.join(' ')};${mask}`;
}

/** Naming and units for {@link buildBehaviorKeyframes}. */
export interface BehaviorKeyframesOptions {
	/** Keyframe name prefix (`pptx-tl-bhvr` for the slide-show timeline). */
	prefix?: string;
	/**
	 * Slide size in px: translations are then written in px instead of against
	 * the `--pptx-slide-w`/`--pptx-slide-h` stage variables (the editor canvas
	 * preview measures its own stage).
	 */
	slidePx?: { width: number; height: number };
}

/**
 * Keyframes that play `anim`'s own behaviour tree, or `undefined` when the
 * player cannot represent it (see {@link createBehaviorPlayer}).
 */
export function buildBehaviorKeyframes(
	anim: Pick<PptxNativeAnimation, 'behaviors' | 'durationMs' | 'presetClass' | 'accel' | 'decel'>,
	uid: number,
	box: AnimationElementBox | undefined,
	options: BehaviorKeyframesOptions = {},
): BehaviorKeyframes | undefined {
	const player = createBehaviorPlayer(anim, box);
	if (!player) {
		return undefined;
	}
	const duration = player.durationMs;
	// The effect's accel/decel already lives in each behaviour's clock (see
	// `behaviorClock`), so the step itself must play linearly.
	const eased = Boolean(anim.accel || anim.decel);
	const offsets = new Set<number>([0, 1]);
	if (!player.piecewiseLinear) {
		for (let i = 1; i < DENSE_SAMPLES; i++) {
			offsets.add(i / DENSE_SAMPLES);
		}
	}
	// Every breakpoint gets a frame, and a discrete change (the exit's
	// closing visibility `p:set`) must not be interpolated across the
	// preceding interval, so the old state is held until just before it.
	for (const point of player.breakpointsMs) {
		const offset = point / duration;
		offsets.add(offset);
		if (offset > HOLD_EPSILON) {
			offsets.add(offset - HOLD_EPSILON);
		}
	}
	const frames = [...offsets]
		.sort((a, b) => a - b)
		.map((offset) => ({ offset, frame: player.frameAt(offset * duration) }));
	const usage: Usage = {
		...(options.slidePx ? { slidePx: options.slidePx } : {}),
		rotate: frames.some(({ frame }) => Math.abs(frame.rotation) > 1e-6),
		shear: frames.some(({ frame }) => Math.abs(frame.shearX) > 1e-6),
		scale: frames.some(
			({ frame }) => Math.abs(frame.scaleX - 1) > 1e-6 || Math.abs(frame.scaleY - 1) > 1e-6,
		),
		wipeEdge: frames.find(({ frame }) => frame.wipe)?.frame.wipe?.edge,
	};
	const name = `${options.prefix ?? 'pptx-tl-bhvr'}-${uid}`;
	const lines = frames.map(
		({ offset, frame }) => `\t${fmt(offset * 100, 3)}% { ${declarations(frame, usage)} }`,
	);
	if (anim.presetClass === 'entr') {
		// Hidden until the effect starts: PowerPoint's visibility `p:set`
		// fires at the effect's first instant, so the shape must not show its
		// start pose during the step's delay (the fill-backwards frame).
		lines[0] = lines[0].replace(/^\t0% \{ opacity: [\d.]+;/u, '\t0% { opacity: 0;');
		lines.splice(1, 0, `\t0.001% { ${declarations(frames[0].frame, usage)} }`);
	}
	return {
		keyframeName: name,
		css: `@keyframes ${name} {\n${lines.join('\n')}\n}`,
		...(eased ? { easing: 'linear' as const } : {}),
	};
}
