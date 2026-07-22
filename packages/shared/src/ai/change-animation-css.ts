/**
 * Shared styling for the AI change overlay: the keyframes/glow CSS injected once
 * per binding, and a pure per-change ghost-rect style builder so React / Vue /
 * Angular / Svelte / Vanilla all animate an edit identically. The overlay is a
 * layer INSIDE the already-scaled slide stage, so bounds are used verbatim (in
 * slide CSS pixels). A ghost has two phases: `start` (pre-flip) and `end`
 * (post-flip); toggling from start to end on the next frame drives the CSS
 * transition (glide old->new, fade/scale in-out). The glow-pulse rides on top.
 */

import type { ResolvedAiChangeAnimationConfig } from './change-animator';
import type { AiElementChange } from './change-diff';

/** Data attribute a binding stamps on a real element node to glow it. */
export const AI_CHANGE_ATTR = 'data-pptx-ai-changed';

/** Keyframes + the real-element glow rule, parameterised by the resolved config. */
export function aiChangeAnimationCss(config: ResolvedAiChangeAnimationConfig): string {
	const { color, durationMs } = config;
	return `
@keyframes pptx-ai-change-glow {
	0% { box-shadow: 0 0 0 0 ${color}, 0 0 0 0 ${color}; }
	50% { box-shadow: 0 0 0 4px transparent, 0 0 16px 5px ${color}; }
	100% { box-shadow: 0 0 0 0 transparent, 0 0 10px 2px transparent; }
}
[${AI_CHANGE_ATTR}] {
	animation: pptx-ai-change-glow ${durationMs}ms ease-out;
	outline: 2px solid ${color};
	outline-offset: 1px;
	border-radius: 3px;
	transition: color ${Math.round(durationMs / 2)}ms ease, fill ${Math.round(durationMs / 2)}ms ease,
		stroke ${Math.round(durationMs / 2)}ms ease, background-color ${Math.round(durationMs / 2)}ms ease;
}
`;
}

/** A plain style object usable as React inline style / Vue :style / etc. */
export interface GhostStyle {
	position: 'absolute';
	left: number;
	top: number;
	width: number;
	height: number;
	opacity: number;
	transform: string;
	transition: string;
	boxShadow: string;
	border: string;
	borderRadius: string;
	pointerEvents: 'none';
	zIndex: number;
}

const PAD = 3;

/**
 * Compute the ghost rectangle style for one change at a given phase. `start` is
 * the pre-flip state, `end` the post-flip state a binding sets on the next frame
 * so the browser transitions between them.
 */
export function changeGhostStyle(
	change: AiElementChange,
	phase: 'start' | 'end',
	config: ResolvedAiChangeAnimationConfig,
): GhostStyle {
	const at = phase === 'start' ? (change.from ?? change.to) : (change.to ?? change.from);
	const box = at ?? { x: 0, y: 0, width: 0, height: 0 };
	const ms = config.durationMs;
	const tween = config.tween;

	// Entrance/exit fade+scale for added/removed; glide for moved/resized.
	let opacity = 1;
	let transform = 'scale(1)';
	if (change.kind === 'added') {
		opacity = phase === 'start' ? 0 : 1;
		transform = phase === 'start' ? 'scale(0.92)' : 'scale(1)';
	} else if (change.kind === 'removed') {
		opacity = phase === 'start' ? 0.9 : 0;
		transform = phase === 'start' ? 'scale(1)' : 'scale(0.92)';
	} else {
		// moved / resized / restyled / text: a soft ghost that fades out at the end.
		opacity = phase === 'start' ? 0.85 : 0;
	}

	const transition = tween
		? `left ${ms}ms ease, top ${ms}ms ease, width ${ms}ms ease, height ${ms}ms ease, opacity ${ms}ms ease, transform ${ms}ms ease`
		: `opacity ${ms}ms ease`;

	return {
		position: 'absolute',
		left: box.x - PAD,
		top: box.y - PAD,
		width: box.width + PAD * 2,
		height: box.height + PAD * 2,
		opacity,
		transform,
		transition,
		boxShadow: config.glow ? `0 0 14px 3px ${config.color}` : 'none',
		border: `2px solid ${config.color}`,
		borderRadius: '4px',
		pointerEvents: 'none',
		zIndex: 9997,
	};
}
