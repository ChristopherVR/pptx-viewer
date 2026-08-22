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
 */
export type MaskRevealShape =
	| 'splitHorizontalIn'
	| 'splitHorizontalOut'
	| 'splitVerticalIn'
	| 'splitVerticalOut'
	| 'boxOut'
	| 'circleOut';

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
