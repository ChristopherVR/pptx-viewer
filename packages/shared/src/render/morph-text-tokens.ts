/**
 * Intelligent token-level diffing and morph animation for text morphing.
 *
 * The base matcher in `morph-text` pairs tokens by exact text then proximity,
 * which loses ordering when the same word repeats and treats every change as a
 * crossfade. This module adds a Longest-Common-Subsequence (LCS) alignment so
 * that tokens present in both the outgoing and incoming text are matched in a
 * stable, order-preserving way and animated as a move (slide + restyle), while
 * tokens that only appear on one side are classified as added (fade in) or
 * removed (fade out).
 *
 * @module render/morph-text-tokens
 */
import { parseHexColor, lerpColor } from './morph-color';
import type { MorphAnimationStyle, MorphTextToken } from './morph-types';
import { MORPH_EASING } from './morph-types';

// ---------------------------------------------------------------------------
// Token diff (LCS)
// ---------------------------------------------------------------------------

/** Classification of a token across the two text states. */
export type MorphTokenChange = 'shared' | 'added' | 'removed';

/** A single diff entry aligning a from-token and/or a to-token. */
export interface MorphTokenOp {
	change: MorphTokenChange;
	from: MorphTextToken | null;
	to: MorphTextToken | null;
	/** Original index in the from-token list, or -1 for added tokens. */
	fromIndex: number;
	/** Original index in the to-token list, or -1 for removed tokens. */
	toIndex: number;
}

/**
 * Diff two ordered token lists into shared/added/removed operations using an
 * LCS backtrace. Shared tokens preserve order and repetition; insertions and
 * deletions are emitted in their natural sequence position.
 *
 * @param fromTokens Tokens from the outgoing element.
 * @param toTokens   Tokens from the incoming element.
 * @returns Ordered diff operations describing the token-level transition.
 */
export function diffTokens(
	fromTokens: MorphTextToken[],
	toTokens: MorphTextToken[],
): MorphTokenOp[] {
	const n = fromTokens.length;
	const m = toTokens.length;

	// LCS length table.
	const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i][j] =
				fromTokens[i].text === toTokens[j].text
					? lcs[i + 1][j + 1] + 1
					: Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	// Backtrace into ordered ops.
	const ops: MorphTokenOp[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (fromTokens[i].text === toTokens[j].text) {
			ops.push({
				change: 'shared',
				from: fromTokens[i],
				to: toTokens[j],
				fromIndex: i,
				toIndex: j,
			});
			i++;
			j++;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
			ops.push({ change: 'removed', from: fromTokens[i], to: null, fromIndex: i, toIndex: -1 });
			i++;
		} else {
			ops.push({ change: 'added', from: null, to: toTokens[j], fromIndex: -1, toIndex: j });
			j++;
		}
	}
	while (i < n) {
		ops.push({ change: 'removed', from: fromTokens[i], to: null, fromIndex: i, toIndex: -1 });
		i++;
	}
	while (j < m) {
		ops.push({ change: 'added', from: null, to: toTokens[j], fromIndex: -1, toIndex: j });
		j++;
	}
	return ops;
}

// ---------------------------------------------------------------------------
// Animation building
// ---------------------------------------------------------------------------

/** Resolve a token colour to a CSS string, preferring a parsed rgba form. */
function tokenColor(token: MorphTextToken): string {
	const parsed = parseHexColor(token.color);
	return parsed ? lerpColor(parsed, parsed, 0) : token.color;
}

/** Build a shared-token move keyframe: slide + restyle between positions. */
function sharedKeyframes(name: string, op: MorphTokenOp): string {
	const from = op.from as MorphTextToken;
	const to = op.to as MorphTextToken;
	return `
@keyframes ${name} {
\tfrom {
\t\tleft: ${Number((from.x * 100).toFixed(2))}%;
\t\ttop: ${Number((from.y * 100).toFixed(2))}%;
\t\tfont-size: ${from.fontSize}pt;
\t\tfont-weight: ${from.fontWeight};
\t\tcolor: ${tokenColor(from)};
\t\topacity: 1;
\t}
\tto {
\t\tleft: ${Number((to.x * 100).toFixed(2))}%;
\t\ttop: ${Number((to.y * 100).toFixed(2))}%;
\t\tfont-size: ${to.fontSize}pt;
\t\tfont-weight: ${to.fontWeight};
\t\tcolor: ${tokenColor(to)};
\t\topacity: 1;
\t}
}`;
}

/** Build a fade keyframe for an added (in) or removed (out) token. */
function fadeKeyframes(name: string, fadeIn: boolean): string {
	const a = fadeIn ? 0 : 1;
	const b = fadeIn ? 1 : 0;
	return `
@keyframes ${name} {
\tfrom { opacity: ${a}; }
\tto { opacity: ${b}; }
}`;
}

/**
 * Build per-token CSS animations from a token diff. Shared tokens animate their
 * position/size/colour between states; added tokens fade in; removed tokens
 * fade out. Element ids embed the originating token index so bindings can map
 * a generated `<span>` to its keyframe.
 *
 * @param ops        Ordered token diff from {@link diffTokens}.
 * @param fromId     The outgoing element id (used for removed tokens).
 * @param toId       The incoming element id (used for shared/added tokens).
 * @param durationMs Animation duration in milliseconds.
 * @param pairIndex  Index of the owning element pair for unique naming.
 * @returns Per-token animation style descriptors.
 */
export function buildTokenMorphAnimations(
	ops: MorphTokenOp[],
	fromId: string,
	toId: string,
	durationMs: number,
	pairIndex: number,
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];
	for (let k = 0; k < ops.length; k++) {
		const op = ops[k];
		const name = `pptx-morph-tok-${pairIndex}-${k}`;
		const anim = `${name} ${durationMs}ms ${MORPH_EASING} forwards`;
		if (op.change === 'shared') {
			animations.push({
				elementId: `${toId}__token_${op.toIndex}`,
				animation: anim,
				keyframes: sharedKeyframes(name, op),
			});
		} else if (op.change === 'added') {
			animations.push({
				elementId: `${toId}__token_${op.toIndex}`,
				animation: anim,
				keyframes: fadeKeyframes(name, true),
			});
		} else {
			animations.push({
				elementId: `${fromId}__token_${op.fromIndex}`,
				animation: anim,
				keyframes: fadeKeyframes(name, false),
			});
		}
	}
	return animations;
}
