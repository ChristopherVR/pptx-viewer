/**
 * Text warp preset classifier and CSS transform generators.
 *
 * Classifies 40+ OOXML prstTxWarp presets into rendering strategy categories:
 *   - `path`:     Works well with SVG textPath (arcs, waves, circles, curves)
 *   - `envelope`: Needs per-line CSS transform approximation (inflate, deflate, can)
 *   - `simple`:   Works with basic CSS transforms (slant, fade, cascade)
 *   - `none`:     No transform applied (textNoShape, textPlain)
 *
 * For `envelope` and `simple` presets, provides CSS property generators that
 * approximate the warp effect using perspective, scale, skew, and clip-path.
 */
import type React from 'react';

export type WarpCategory = 'path' | 'envelope' | 'simple' | 'none';

// ── Category maps ─────────────────────────────────────────────────────

const NONE_PRESETS = new Set<string>(['textNoShape', 'textPlain']);

/** Presets that render best with SVG textPath along curved/circular paths. */
const PATH_PRESETS = new Set<string>([
	'textArchUp',
	'textArchDown',
	'textCircle',
	'textWave1',
	'textWave2',
	'textWave4',
	'textDoubleWave1',
	'textCurveUp',
	'textCurveDown',
	'textArchUpPour',
	'textArchDownPour',
	'textCirclePour',
	'textButton',
	'textButtonPour',
	'textRingInside',
	'textRingOutside',
	'textTriangle',
	'textTriangleInverted',
	'textChevron',
	'textChevronInverted',
	'textStop',
]);

/**
 * Envelope presets stretch text non-uniformly (wider/narrower per line).
 * SVG textPath alone cannot capture the vertical scaling; CSS transforms
 * approximate the visual effect per text line.
 */
const ENVELOPE_PRESETS = new Set<string>([
	'textInflate',
	'textDeflate',
	'textInflateBottom',
	'textInflateTop',
	'textDeflateBottom',
	'textDeflateTop',
	'textDeflateInflate',
	'textDeflateInflateDeflate',
	'textCanUp',
	'textCanDown',
]);

/** Simple presets that work with basic 2D CSS transforms (skew, perspective). */
const SIMPLE_PRESETS = new Set<string>([
	'textSlantUp',
	'textSlantDown',
	'textFadeRight',
	'textFadeLeft',
	'textFadeUp',
	'textFadeDown',
	'textCascadeUp',
	'textCascadeDown',
]);

// ── Public classifier ─────────────────────────────────────────────────

/**
 * Classify a warp preset into a rendering strategy category.
 *
 * Returns `'none'` for unknown or empty presets so callers can safely
 * skip rendering without an explicit allowlist check.
 */
export function getWarpCategory(preset: string | undefined): WarpCategory {
	if (!preset || NONE_PRESETS.has(preset)) {
		return 'none';
	}
	if (PATH_PRESETS.has(preset)) {
		return 'path';
	}
	if (ENVELOPE_PRESETS.has(preset)) {
		return 'envelope';
	}
	if (SIMPLE_PRESETS.has(preset)) {
		return 'simple';
	}
	// Unknown preset -- fall through to none so rendering is safe
	return 'none';
}

/**
 * All known warp presets that are classified (excludes `none`).
 * Useful for exhaustive checks.
 */
export const ALL_CLASSIFIED_PRESETS: ReadonlySet<string> = new Set([
	...NONE_PRESETS,
	...PATH_PRESETS,
	...ENVELOPE_PRESETS,
	...SIMPLE_PRESETS,
]);

// ── Envelope CSS transform generators ─────────────────────────────────

/**
 * Default OOXML adjustment values for envelope presets.
 * Units are raw OOXML 1/60000th values.
 */
const ENVELOPE_DEFAULTS: Record<string, { adj1: number; adj2: number }> = {
	textInflate: { adj1: 18750, adj2: 0 },
	textDeflate: { adj1: 18750, adj2: 0 },
	textInflateBottom: { adj1: 18750, adj2: 0 },
	textInflateTop: { adj1: 18750, adj2: 0 },
	textDeflateBottom: { adj1: 18750, adj2: 0 },
	textDeflateTop: { adj1: 18750, adj2: 0 },
	textDeflateInflate: { adj1: 18750, adj2: 0 },
	textDeflateInflateDeflate: { adj1: 18750, adj2: 0 },
	textCanUp: { adj1: 18750, adj2: 0 },
	textCanDown: { adj1: 18750, adj2: 0 },
};

/**
 * Generate CSS properties that approximate an envelope warp effect.
 *
 * Envelope warps distort text non-uniformly -- e.g. inflate makes the
 * middle lines wider and the top/bottom narrower. Since CSS cannot bend
 * individual glyphs, we use `scaleX`, `perspective`, and `rotateX` to
 * give a reasonable visual hint.
 *
 * @param preset  One of the envelope warp preset names.
 * @param adj1    Optional first adjustment value (OOXML units).
 * @param adj2    Optional second adjustment value (OOXML units).
 */
export function getEnvelopeCssTransform(
	preset: string,
	adj1?: number,
	adj2?: number,
): React.CSSProperties {
	const defaults = ENVELOPE_DEFAULTS[preset] ?? { adj1: 18750, adj2: 0 };
	const a1 = adj1 ?? defaults.adj1;
	const _a2 = adj2 ?? defaults.adj2;

	// Normalise adj1 to a 0..1 intensity factor (default adj 18750 -> factor 1).
	const intensity = Math.max(0, Math.min(a1 / 18750, 4));

	switch (preset) {
		// ── Inflate family ────────────────────────────────────────────
		case 'textInflate':
			return {
				transform: `scaleY(${1 + 0.15 * intensity}) scaleX(${1 + 0.05 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textInflateBottom':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${-8 * intensity}deg)`,
				transformOrigin: 'center bottom',
			};
		case 'textInflateTop':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${8 * intensity}deg)`,
				transformOrigin: 'center top',
			};

		// ── Deflate family ────────────────────────────────────────────
		case 'textDeflate':
			return {
				transform: `scaleY(${1 - 0.12 * intensity}) scaleX(${1 - 0.05 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textDeflateBottom':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${6 * intensity}deg)`,
				transformOrigin: 'center bottom',
			};
		case 'textDeflateTop':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${-6 * intensity}deg)`,
				transformOrigin: 'center top',
			};

		// ── Compound deflate/inflate ──────────────────────────────────
		case 'textDeflateInflate':
			return {
				transform: `scaleY(${1 - 0.08 * intensity}) scaleX(${1 + 0.04 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textDeflateInflateDeflate':
			return {
				transform: `scaleY(${1 - 0.15 * intensity}) scaleX(${1 + 0.06 * intensity})`,
				transformOrigin: 'center center',
			};

		// ── Can (cylindrical) ─────────────────────────────────────────
		case 'textCanUp':
			return {
				transform: `perspective(${500 - 80 * intensity}px) rotateX(${-6 * intensity}deg)`,
				transformOrigin: 'center center',
			};
		case 'textCanDown':
			return {
				transform: `perspective(${500 - 80 * intensity}px) rotateX(${6 * intensity}deg)`,
				transformOrigin: 'center center',
			};

		default:
			return {};
	}
}

// ── Simple CSS transform generators ───────────────────────────────────

/**
 * Default OOXML adjustment values for simple presets.
 */
const SIMPLE_DEFAULTS: Record<string, { adj1: number }> = {
	textSlantUp: { adj1: 55000 },
	textSlantDown: { adj1: 55000 },
	textFadeRight: { adj1: 50000 },
	textFadeLeft: { adj1: 50000 },
	textFadeUp: { adj1: 50000 },
	textFadeDown: { adj1: 50000 },
	textCascadeUp: { adj1: 44444 },
	textCascadeDown: { adj1: 44444 },
};

/**
 * Generate CSS properties that approximate a simple warp effect.
 *
 * Simple warps (slant, fade, cascade) are well-modelled by basic CSS
 * transforms such as `skewY`, `perspective`, and `rotateY`.
 *
 * @param preset  One of the simple warp preset names.
 * @param adj1    Optional adjustment value (OOXML units).
 */
export function getSimpleCssTransform(preset: string, adj1?: number): React.CSSProperties {
	const defaults = SIMPLE_DEFAULTS[preset] ?? { adj1: 50000 };
	const a1 = adj1 ?? defaults.adj1;

	switch (preset) {
		// ── Slant ─────────────────────────────────────────────────────
		case 'textSlantUp': {
			const skew = -4 * (a1 / 55000);
			return {
				transform: `perspective(500px) rotateY(${8 * (a1 / 55000)}deg) skewY(${skew}deg)`,
				transformOrigin: 'left center',
			};
		}
		case 'textSlantDown': {
			const skew = 4 * (a1 / 55000);
			return {
				transform: `perspective(500px) rotateY(${-8 * (a1 / 55000)}deg) skewY(${skew}deg)`,
				transformOrigin: 'right center',
			};
		}

		// ── Fade ──────────────────────────────────────────────────────
		case 'textFadeRight': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateY(${-angle}deg)`,
				transformOrigin: 'left center',
			};
		}
		case 'textFadeLeft': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateY(${angle}deg)`,
				transformOrigin: 'right center',
			};
		}
		case 'textFadeUp': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateX(${-angle}deg)`,
				transformOrigin: 'center bottom',
			};
		}
		case 'textFadeDown': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateX(${angle}deg)`,
				transformOrigin: 'center top',
			};
		}

		// ── Cascade ───────────────────────────────────────────────────
		case 'textCascadeUp': {
			const skew = -8 * (a1 / 44444);
			return {
				transform: `skewY(${skew}deg)`,
				transformOrigin: 'left top',
			};
		}
		case 'textCascadeDown': {
			const skew = 8 * (a1 / 44444);
			return {
				transform: `skewY(${skew}deg)`,
				transformOrigin: 'left top',
			};
		}

		default:
			return {};
	}
}
