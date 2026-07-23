/**
 * `animation-directional`: generate direction-aware `@keyframes` for the
 * clip-path family of entrance/exit effects (wipe, peek, blinds, split) so a
 * `p:cTn/@presetSubtype` direction code is honoured, not just for Fly.
 *
 * PowerPoint encodes the direction as an origin-edge bitmask (1=top, 2=right,
 * 4=bottom, 8=left; corners combine bits). The static preset keyframes bake in
 * one fixed direction, so a deck that wipes "from the top" would previously
 * always render the default "from the left". This module produces a dynamic
 * clip-path keyframe for the requested direction instead. Effects that are not
 * a directional clip-path (Fly is redirected earlier, zoom/spin/etc. carry no
 * direction) return `undefined` and fall back to their static effect.
 *
 * @module render/animation-directional
 */

import { FLY_SUBTYPE_TO_EDGE } from './animation-presets';
import type { EffectName } from './animation-timeline-types';

/** Effects whose reveal/hide is a single directional clip-path sweep. */
const WIPE_LIKE: ReadonlySet<EffectName> = new Set<EffectName>([
	'wipeIn',
	'peekIn',
	'blindsIn',
	'wipeOut',
]);

/** Effects whose reveal opens symmetrically from the centre (split bands). */
const SPLIT_LIKE: ReadonlySet<EffectName> = new Set<EffectName>(['splitIn']);

/** Starting `clip-path` inset for a wipe that reveals from the given edge. */
function wipeStartInset(edge: 'top' | 'right' | 'bottom' | 'left'): string {
	switch (edge) {
		case 'left':
			return 'inset(0 100% 0 0)';
		case 'right':
			return 'inset(0 0 0 100%)';
		case 'top':
			return 'inset(0 0 100% 0)';
		case 'bottom':
		default:
			return 'inset(100% 0 0 0)';
	}
}

/** Build a wipe reveal (entrance) keyframe growing from `edge`. */
function wipeRevealCss(name: string, edge: 'top' | 'right' | 'bottom' | 'left'): string {
	return `@keyframes ${name} {\n\tfrom { clip-path: ${wipeStartInset(edge)}; opacity: 1; }\n\tto { clip-path: inset(0 0 0 0); opacity: 1; }\n}`;
}

/** Build a wipe hide (exit) keyframe collapsing toward `edge`. */
function wipeHideCss(name: string, edge: 'top' | 'right' | 'bottom' | 'left'): string {
	return `@keyframes ${name} {\n\tfrom { clip-path: inset(0 0 0 0); opacity: 1; }\n\tto { clip-path: ${wipeStartInset(edge)}; opacity: 0; }\n}`;
}

/** Build a split reveal keyframe opening vertically or horizontally. */
function splitRevealCss(name: string, orientation: 'vertical' | 'horizontal'): string {
	const start = orientation === 'vertical' ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)';
	return `@keyframes ${name} {\n\tfrom { clip-path: ${start}; opacity: 1; }\n\tto { clip-path: inset(0 0 0 0); opacity: 1; }\n}`;
}

/**
 * Build a directional `@keyframes` block for a clip-path entrance/exit effect,
 * or `undefined` when the effect is not directional or no direction subtype was
 * supplied (so the caller keeps the static preset).
 */
export function buildDirectionalKeyframe(
	effect: EffectName,
	subtype: number | undefined,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (subtype === undefined) {
		return undefined;
	}
	const edge = FLY_SUBTYPE_TO_EDGE[subtype];
	if (!edge) {
		return undefined;
	}
	const name = `pptx-tl-dir-${uid}`;

	if (SPLIT_LIKE.has(effect)) {
		const orientation = edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal';
		return { keyframeName: name, css: splitRevealCss(name, orientation) };
	}
	if (WIPE_LIKE.has(effect)) {
		const css = effect === 'wipeOut' ? wipeHideCss(name, edge) : wipeRevealCss(name, edge);
		return { keyframeName: name, css };
	}
	return undefined;
}
