/**
 * `animation-directional`: generate direction-aware `@keyframes` for the
 * mask-reveal family of entrance/exit effects (wipe, peek, blinds, split) so a
 * `p:cTn/@presetSubtype` direction code is honoured, not just for Fly.
 *
 * Two different subtype encodings are in play (verified against
 * PowerPoint-authored XML, which pairs each subtype with an explicit
 * `p:animEffect/@filter` direction):
 *  - Fly / Peek / Blinds use the origin-edge bitmask (1=top, 2=right,
 *    4=bottom, 8=left): the code names the edge the object/reveal comes FROM.
 *  - Wipe uses the TRAVEL direction: subtype 1 = `wipe(up)` (reveal grows
 *    from the bottom edge), i.e. the opposite edge of the fly encoding.
 *  - Split uses barn-door variant codes (21 = `barn(inVertical)`, etc.).
 *
 * The reveals are CSS `mask` sweeps rather than `clip-path` keyframes: a
 * `clip-path` animation REPLACES the element's own geometry clip (parallelogram
 * outlines, image crops), flooding the bounding box with fill mid-animation.
 * See `animation-mask-reveal`.
 *
 * @module render/animation-directional
 */

import { maskEdgeDecl, maskShapeDecl } from './animation-mask-reveal';
import type { RevealEdge } from './animation-mask-reveal';
import {
	FLY_SUBTYPE_TO_EDGE,
	SPLIT_SUBTYPE_TO_VARIANT,
	WIPE_SUBTYPE_TO_EDGE,
} from './animation-presets';
import type { SplitVariant } from './animation-presets';
import type { EffectName } from './animation-timeline-types';

/** Effects whose subtype is a WIPE travel-direction code. */
const WIPE_ENCODED: ReadonlySet<EffectName> = new Set<EffectName>(['wipeIn', 'wipeOut']);

/** Effects whose subtype is an origin-edge code (like Fly). */
const ORIGIN_ENCODED: ReadonlySet<EffectName> = new Set<EffectName>(['peekIn', 'blindsIn']);

/** Build a mask reveal (entrance) keyframe growing from `edge`. */
function maskRevealCss(name: string, edge: RevealEdge): string {
	return `@keyframes ${name} {\n\tfrom { ${maskEdgeDecl(edge, 'hidden')} opacity: 1; }\n\tto { ${maskEdgeDecl(edge, 'shown')} opacity: 1; }\n}`;
}

/** Build a mask hide (exit) keyframe collapsing toward `edge`. */
function maskHideCss(name: string, edge: RevealEdge): string {
	return `@keyframes ${name} {\n\tfrom { ${maskEdgeDecl(edge, 'shown')} opacity: 1; }\n\tto { ${maskEdgeDecl(edge, 'hidden')} opacity: 0; }\n}`;
}

/** Build a split (barn-door) reveal keyframe for the given variant. */
function splitRevealCss(name: string, variant: SplitVariant): string {
	return `@keyframes ${name} {\n\tfrom { ${maskShapeDecl(variant, 'hidden')} opacity: 1; }\n\tto { ${maskShapeDecl(variant, 'shown')} opacity: 1; }\n}`;
}

/**
 * Build a directional `@keyframes` block for a mask-reveal entrance/exit
 * effect, or `undefined` when the effect is not directional or no direction
 * subtype was supplied (so the caller keeps the static preset).
 */
export function buildDirectionalKeyframe(
	effect: EffectName,
	subtype: number | undefined,
	uid: number,
): { keyframeName: string; css: string } | undefined {
	if (subtype === undefined) {
		return undefined;
	}
	const name = `pptx-tl-dir-${uid}`;

	if (effect === 'splitIn') {
		const variant = SPLIT_SUBTYPE_TO_VARIANT[subtype];
		if (!variant) {
			return undefined;
		}
		return { keyframeName: name, css: splitRevealCss(name, variant) };
	}
	if (WIPE_ENCODED.has(effect)) {
		const edge = WIPE_SUBTYPE_TO_EDGE[subtype];
		if (!edge) {
			return undefined;
		}
		const css = effect === 'wipeOut' ? maskHideCss(name, edge) : maskRevealCss(name, edge);
		return { keyframeName: name, css };
	}
	if (ORIGIN_ENCODED.has(effect)) {
		const edge = FLY_SUBTYPE_TO_EDGE[subtype];
		if (!edge) {
			return undefined;
		}
		return { keyframeName: name, css: maskRevealCss(name, edge) };
	}
	return undefined;
}
