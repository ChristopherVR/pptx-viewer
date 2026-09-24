/**
 * `animation-mask-reveal`: CSS `mask`-based reveal states for the clip family
 * of entrance/exit effects (wipe, peek, blinds, split, box, random bars).
 *
 * These effects used to animate `clip-path: inset(...)`, but the element
 * container ALSO carries its shape geometry as a `clip-path` (a parallelogram,
 * a freeform outline, an image crop). A CSS animation's `clip-path` keyframe
 * REPLACES that inline geometry for the whole animation, so a thin diagonal
 * stripe wiped in as its full BOUNDING BOX: a huge filled rectangle "blob"
 * until the animation ended. A CSS `mask` composites WITH `clip-path` instead
 * of replacing it, so the reveal sweeps the actual painted shape.
 *
 * Each reveal is a hard-stop gradient mask sized at 2x the element on the
 * travel axis; only `mask-position` animates between the hidden and shown
 * states, which browsers interpolate smoothly.
 *
 * @module render/animation-mask-reveal
 */

import type {
	BlindsDirection,
	CheckerboardDirection,
	RandomBarsDirection,
} from './animation-presets-subtypes';

/** The edge a reveal grows FROM (the first part of the element to appear). */
export type RevealEdge = 'left' | 'right' | 'top' | 'bottom';

/** One mask configuration: constant image/size/repeat, animated position. */
interface MaskRevealConfig {
	image: string;
	size: string;
	repeat: string;
	/** `mask-position` while fully hidden. */
	hiddenPos: string;
	/** `mask-position` while fully shown. */
	shownPos: string;
}

const HARD_STOP = '#000 50%, transparent 50%';

/** Directional wipe configs: black half slides across a 2x-sized mask. */
const EDGE_CONFIG: Record<RevealEdge, MaskRevealConfig> = {
	left: {
		image: `linear-gradient(to right, ${HARD_STOP})`,
		size: '200% 100%',
		repeat: 'no-repeat',
		hiddenPos: '100% 0%',
		shownPos: '0% 0%',
	},
	right: {
		image: `linear-gradient(to left, ${HARD_STOP})`,
		size: '200% 100%',
		repeat: 'no-repeat',
		hiddenPos: '0% 0%',
		shownPos: '100% 0%',
	},
	top: {
		image: `linear-gradient(to bottom, ${HARD_STOP})`,
		size: '100% 200%',
		repeat: 'no-repeat',
		hiddenPos: '0% 100%',
		shownPos: '0% 0%',
	},
	bottom: {
		image: `linear-gradient(to top, ${HARD_STOP})`,
		size: '100% 200%',
		repeat: 'no-repeat',
		hiddenPos: '0% 0%',
		shownPos: '0% 100%',
	},
};

/**
 * Non-directional reveal shapes. `mask-size` animates instead of the position:
 *  - `splitHorizontalIn`: two bands growing from the top + bottom edges inward.
 *  - `splitHorizontalOut`: one centred band growing outward vertically.
 *  - `splitVerticalIn`: two bands growing from the left + right edges inward.
 *  - `splitVerticalOut`: one centred band growing outward horizontally.
 *  - `boxOut`: one centred rectangle growing outward on both axes.
 *  - `circleOut`: one centred circle growing outward on both axes (the Circle
 *    entrance/exit preset's iris-style reveal).
 *  - `diamondOut`: one centred diamond (rotated square) growing outward on
 *    both axes, for the `diamond` SMIL filter family.
 *  - `plusOut`: a horizontal bar and a vertical bar, both centred, growing
 *    outward simultaneously; their union traces a cross/plus shape from a
 *    point at centre to full coverage, for the `plus` SMIL filter family.
 *  - `wedgeOut`: a centred convex hexagon (a vertical lens shape standing in
 *    for PowerPoint's two-wedge bowtie sweep, which needs an animated sweep
 *    ANGLE that this mask-size/position-only technique cannot express) for
 *    the `wedge` SMIL filter family.
 */
export type MaskRevealShape =
	| 'splitHorizontalIn'
	| 'splitHorizontalOut'
	| 'splitVerticalIn'
	| 'splitVerticalOut'
	| 'boxOut'
	| 'circleOut'
	| 'diamondOut'
	| 'plusOut'
	| 'wedgeOut';

interface MaskSizeConfig {
	image: string;
	position: string;
	repeat: string;
	hiddenSize: string;
	shownSize: string;
}

const SOLID = 'linear-gradient(#000, #000)';

const SHAPE_CONFIG: Record<MaskRevealShape, MaskSizeConfig> = {
	splitHorizontalIn: {
		image: `${SOLID}, ${SOLID}`,
		position: 'left top, left bottom',
		repeat: 'no-repeat, no-repeat',
		hiddenSize: '100% 0%, 100% 0%',
		shownSize: '100% 50.5%, 100% 50.5%',
	},
	splitHorizontalOut: {
		image: SOLID,
		position: 'center',
		repeat: 'no-repeat',
		hiddenSize: '100% 0%',
		shownSize: '100% 101%',
	},
	splitVerticalIn: {
		image: `${SOLID}, ${SOLID}`,
		position: 'left top, right top',
		repeat: 'no-repeat, no-repeat',
		hiddenSize: '0% 100%, 0% 100%',
		shownSize: '50.5% 100%, 50.5% 100%',
	},
	splitVerticalOut: {
		image: SOLID,
		position: 'center',
		repeat: 'no-repeat',
		hiddenSize: '0% 100%',
		shownSize: '101% 100%',
	},
	boxOut: {
		image: SOLID,
		position: 'center',
		repeat: 'no-repeat',
		hiddenSize: '0% 0%',
		shownSize: '101% 101%',
	},
	circleOut: {
		// A circle (not a square) needs extra headroom past 100% so its
		// inscribed radius still reaches the element's corners at full size.
		image: 'radial-gradient(circle, #000 0%, #000 100%)',
		position: 'center',
		repeat: 'no-repeat',
		hiddenSize: '0% 0%',
		shownSize: '150% 150%',
	},
	diamondOut: {
		// A rotated square (diamond) touches the box's edge midpoints at
		// 100%; it needs roughly sqrt(2) headroom to reach the corners.
		image: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon points='50,0 100,50 50,100 0,50' fill='%23000'/%3E%3C/svg%3E")`,
		position: 'center',
		repeat: 'no-repeat',
		hiddenSize: '0% 0%',
		shownSize: '150% 150%',
	},
	plusOut: {
		// Two independent solid bars (mask layers composite by union): a
		// full-width horizontal bar and a full-height vertical bar, both
		// growing from a point at centre, so together they trace a cross.
		image: `${SOLID}, ${SOLID}`,
		position: 'center, center',
		repeat: 'no-repeat, no-repeat',
		hiddenSize: '100% 0%, 0% 100%',
		shownSize: '100% 101%, 101% 100%',
	},
	wedgeOut: {
		// A convex hexagon (vertical lens) approximating PowerPoint's
		// two-wedge bowtie sweep. Needs generous headroom (~195%) for its
		// narrower mid-height vertices to still reach the box's corners.
		image: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon points='50,0 90,38 90,62 50,100 10,62 10,38' fill='%23000'/%3E%3C/svg%3E")`,
		position: 'center',
		repeat: 'no-repeat',
		hiddenSize: '0% 0%',
		shownSize: '220% 220%',
	},
};

/** Kebab-case declaration list for a directional wipe keyframe stop. */
export function maskEdgeDecl(edge: RevealEdge, phase: 'hidden' | 'shown'): string {
	const cfg = EDGE_CONFIG[edge];
	const pos = phase === 'hidden' ? cfg.hiddenPos : cfg.shownPos;
	return `mask-image: ${cfg.image}; mask-size: ${cfg.size}; mask-repeat: ${cfg.repeat}; mask-position: ${pos};`;
}

/** Kebab-case declarations for a partially swept directional wipe (0..1). */
export function maskEdgePartialDecl(edge: RevealEdge, revealedFraction: number): string {
	const cfg = EDGE_CONFIG[edge];
	const clamped = Math.max(0, Math.min(1, revealedFraction));
	// Position interpolates linearly hidden -> shown; both axes carry at most
	// one percentage that differs between the two states.
	const lerp = (from: string, to: string): string => {
		const f = from.split(' ').map((p) => Number.parseFloat(p));
		const t = to.split(' ').map((p) => Number.parseFloat(p));
		return f.map((v, i) => `${v + (t[i] - v) * clamped}%`).join(' ');
	};
	const pos = lerp(cfg.hiddenPos, cfg.shownPos);
	return `mask-image: ${cfg.image}; mask-size: ${cfg.size}; mask-repeat: ${cfg.repeat}; mask-position: ${pos};`;
}

/** Kebab-case declaration list for a size-animated (split / box) stop. */
export function maskShapeDecl(shape: MaskRevealShape, phase: 'hidden' | 'shown'): string {
	const cfg = SHAPE_CONFIG[shape];
	const size = phase === 'hidden' ? cfg.hiddenSize : cfg.shownSize;
	return `mask-image: ${cfg.image}; mask-position: ${cfg.position}; mask-repeat: ${cfg.repeat}; mask-size: ${size};`;
}

/**
 * CamelCase inline-style map for a directional wipe's HIDDEN state, used to
 * pre-seed an element before its entrance plays (mirrors the keyframe `from`).
 */
export function maskEdgeInitialStyle(edge: RevealEdge): Record<string, string | number> {
	const cfg = EDGE_CONFIG[edge];
	return {
		maskImage: cfg.image,
		maskSize: cfg.size,
		maskRepeat: cfg.repeat,
		maskPosition: cfg.hiddenPos,
		opacity: 1,
	};
}

/** CamelCase inline-style map for a split / box reveal's HIDDEN state. */
export function maskShapeInitialStyle(shape: MaskRevealShape): Record<string, string | number> {
	const cfg = SHAPE_CONFIG[shape];
	return {
		maskImage: cfg.image,
		maskPosition: cfg.position,
		maskRepeat: cfg.repeat,
		maskSize: cfg.hiddenSize,
		opacity: 1,
	};
}

// ==========================================================================
// Blinds / Random Bars (parallel bands), Checkerboard (tiled diagonal grid),
// Wheel (radial spokes) - direction/spoke-count-aware reveals.
//
// The `BlindsDirection`/`CheckerboardDirection` types these take come from
// `animation-presets-subtypes.ts`, which is also where the animation's own
// `p:animEffect/@filter` subtype token (e.g. `blinds(vertical)`) is decoded
// into one of them.
// ==========================================================================

/**
 * A directional multi-band reveal: `bandCount` parallel strips (divided
 * along the axis `direction` names) all widen simultaneously from their
 * shared leading edge, tiled across the element via `mask-repeat`. Blinds
 * (`bandCount = 8`) and Random Bars (`bandCount = 16`, thinner strips) share
 * this builder. Every band still arrives in lockstep (this builder has no
 * notion of "randomness"; it is one fixed-fraction frame of the reveal) -
 * Random Bars' authored direction is now honoured, but its arrival order is
 * a synchronised sweep rather than PowerPoint's genuinely scattered one; a
 * closer match would need a per-instance dynamic keyframe (like the motion
 * path / rotation / scale builders in `animation-transform-keyframes.ts`)
 * rather than this fixed static-catalog entry.
 */
function bandRevealDecl(
	direction: BlindsDirection,
	revealedFraction: number,
	bandCount: number,
): string {
	const clamped = Math.max(0, Math.min(1, revealedFraction));
	const pct = (clamped * 100).toFixed(3);
	const bandPct = (100 / bandCount).toFixed(4);
	const gradientDir = direction === 'vertical' ? 'to right' : 'to bottom';
	const image = `linear-gradient(${gradientDir}, #000 ${pct}%, transparent ${pct}%)`;
	const size = direction === 'vertical' ? `${bandPct}% 100%` : `100% ${bandPct}%`;
	const repeat = direction === 'vertical' ? 'repeat-x' : 'repeat-y';
	return `mask-image: ${image}; mask-size: ${size}; mask-repeat: ${repeat}; mask-position: 0 0;`;
}

/** Kebab-case declarations for a Blinds reveal (8 parallel bands) at a given fraction (0-1). */
export function blindsDecl(direction: BlindsDirection, revealedFraction: number): string {
	return bandRevealDecl(direction, revealedFraction, 8);
}

/**
 * Kebab-case declarations for a Random Bars reveal (16 thinner parallel
 * bands) at a given fraction (0-1). See {@link bandRevealDecl}'s doc for why
 * this is a directional band sweep rather than a genuinely randomised one.
 */
export function randomBarsBandDecl(
	direction: RandomBarsDirection,
	revealedFraction: number,
): string {
	return bandRevealDecl(direction, revealedFraction, 16);
}

/**
 * Kebab-case declarations for a tiled checkerboard reveal at a given
 * fraction (0-1), swept along `direction` ('across' = left-to-right, 'down'
 * = top-to-bottom).
 *
 * Two identical 45deg diagonal-gradient tiles, offset by half a cell, union
 * (`mask-composite: add`, the default combine mode) into solid alternating
 * squares - the same construction commonly used for a checkerboard CSS
 * background, applied here as a mask instead of a paint. A third mask layer
 * (a plain directional wipe) then INTERSECTS that checkerboard shape, so
 * only the squares within the swept region are visible.
 */
export function checkerboardDecl(
	direction: CheckerboardDirection,
	revealedFraction: number,
): string {
	const clamped = Math.max(0, Math.min(1, revealedFraction));
	const pct = (clamped * 100).toFixed(3);
	const cell = 12.5; // An 8x8 grid of cells across each axis.
	const half = cell / 2;
	const tile = `linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%)`;
	const wipeDir = direction === 'across' ? 'to right' : 'to bottom';
	const wipe = `linear-gradient(${wipeDir}, #000 ${pct}%, transparent ${pct}%)`;
	return [
		`mask-image: ${tile}, ${tile}, ${wipe};`,
		`mask-size: ${cell}% ${cell}%, ${cell}% ${cell}%, 100% 100%;`,
		'mask-repeat: repeat, repeat, no-repeat;',
		`mask-position: 0 0, ${half}% ${half}%, 0 0;`,
		'mask-composite: add, intersect;',
	].join(' ');
}

/**
 * Kebab-case declarations for a Wheel reveal at a given fraction (0-1):
 * `spokeCount` pie-slice sectors, all growing simultaneously from their
 * shared leading edge, via a hard-stop `repeating-conic-gradient`. Matches
 * PowerPoint's "Spokes" Effect Option (1, 2, 3, 4, or 8; see
 * `resolveWheelSpokeCount` in `animation-presets-subtypes.ts`).
 */
export function wheelDecl(spokeCount: number, revealedFraction: number): string {
	const clamped = Math.max(0, Math.min(1, revealedFraction));
	const sectorDeg = 360 / Math.max(1, spokeCount);
	const growDeg = (sectorDeg * clamped).toFixed(3);
	const image = `repeating-conic-gradient(#000 0deg, #000 ${growDeg}deg, transparent ${growDeg}deg, transparent ${sectorDeg.toFixed(3)}deg)`;
	return `mask-image: ${image}; mask-size: 100% 100%; mask-repeat: no-repeat; mask-position: center;`;
}
