/**
 * `animation-mask-hole-reveal` — the "In" direction reveal for the Box,
 * Circle, Diamond and Plus entrance effects.
 *
 * COM-verified (PowerPoint `Sequence.AddEffect` with
 * `EffectParameters.Direction = msoAnimDirectionIn`, `CreateVideo` frame
 * capture): "In" is the geometric INVERSE of `animation-mask-reveal`'s
 * `boxOut`/`circleOut`/`diamondOut`/`plusOut` shapes. Instead of a solid
 * shape growing from a point at centre outward, a HOLE shaped like the
 * preset (inscribed touching the element's own edges/edge-midpoints) shrinks
 * from that inscribed size down to nothing, so the element appears to fill
 * in from its own edges/corners inward, like a closing picture frame. Every
 * `PptxAnimationPreset` named `boxIn`/`circleIn`/`diamondIn`/`plusIn`
 * (`presetId` 4/6/8/13, entrance class) previously reused the `xOut` shapes
 * verbatim, which is PowerPoint's `msoAnimDirectionOut` visual, not `In` -
 * the wrong direction for what is, by far, the common case (it is also the
 * direction this project's own writer always authors,
 * the captured `box(in)` tree in core's `animation-behavior-captures.json`).
 *
 * Implemented with `mask-composite: exclude` (boolean XOR) against an
 * always-solid base layer: XORing a solid layer with a shape inverts that
 * shape, exactly the "cut a hole out of a solid" operation needed. `plusIn`
 * unions its two independent bars first (`add`) before excluding the union:
 * sequential exclude of two overlapping shapes would incorrectly re-reveal
 * their overlap, since XOR-ing twice cancels out.
 *
 * @module render/animation-mask-hole-reveal
 */

const SOLID = 'linear-gradient(#000, #000)';

/** The three single-hole preset shapes (Plus needs its own two-bar builder). */
export type MaskHoleShape = 'box' | 'circle' | 'diamond';

const HOLE_IMAGE: Record<MaskHoleShape, string> = {
	box: SOLID,
	// `mask-size: 100% 100%` on this gradient draws an ellipse inscribed
	// touching all four edge midpoints, matching the COM capture exactly.
	circle: 'radial-gradient(circle, #000 0%, #000 100%)',
	// This polygon's points already touch the edge midpoints at 100% size
	// (no headroom needed, unlike `diamondOut`'s growing-past-corners variant).
	diamond: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon points='50,0 100,50 50,100 0,50' fill='%23000'/%3E%3C/svg%3E")`,
};

/** Kebab-case declarations for a box/circle/diamond hole reveal (hidden = full hole, shown = no hole). */
export function maskHoleDecl(shape: MaskHoleShape, phase: 'hidden' | 'shown'): string {
	const holeSize = phase === 'hidden' ? '100% 100%' : '0% 0%';
	return [
		`mask-image: ${HOLE_IMAGE[shape]}, ${SOLID};`,
		'mask-position: center, center;',
		'mask-repeat: no-repeat, no-repeat;',
		`mask-size: ${holeSize}, 100% 100%;`,
		'mask-composite: add, exclude;',
	].join(' ');
}

/** CamelCase inline-style map for a box/circle/diamond hole reveal's HIDDEN state. */
export function maskHoleInitialStyle(shape: MaskHoleShape): Record<string, string | number> {
	return {
		maskImage: `${HOLE_IMAGE[shape]}, ${SOLID}`,
		maskPosition: 'center, center',
		maskRepeat: 'no-repeat, no-repeat',
		maskSize: '100% 100%, 100% 100%',
		maskComposite: 'add, exclude',
		opacity: 1,
	};
}

/** Kebab-case declarations for the Plus hole reveal (two bars, unioned then excluded from a solid base). */
export function maskPlusHoleDecl(phase: 'hidden' | 'shown'): string {
	const barSize = phase === 'hidden' ? '100%' : '0%';
	return [
		`mask-image: ${SOLID}, ${SOLID}, ${SOLID};`,
		'mask-position: center, center, center;',
		'mask-repeat: no-repeat, no-repeat, no-repeat;',
		`mask-size: 100% ${barSize}, ${barSize} 100%, 100% 100%;`,
		'mask-composite: add, add, exclude;',
	].join(' ');
}

/** CamelCase inline-style map for the Plus hole reveal's HIDDEN state. */
export function maskPlusHoleInitialStyle(): Record<string, string | number> {
	return {
		maskImage: `${SOLID}, ${SOLID}, ${SOLID}`,
		maskPosition: 'center, center, center',
		maskRepeat: 'no-repeat, no-repeat, no-repeat',
		maskSize: '100% 100%, 100% 100%, 100% 100%',
		maskComposite: 'add, add, exclude',
		opacity: 1,
	};
}
