/**
 * `animation-sampled-mask-keyframes` - `@keyframes` for reveals whose mask is
 * a gradient that changes SHAPE as it plays (Blinds, Checkerboard, Random
 * Bars, Wheel): the hard-stop position or the conic angle moves.
 *
 * Browsers do not interpolate gradient images, so a two-stop keyframe swaps
 * from fully hidden to fully shown at the halfway point: PowerPoint's Blinds
 * sweeps each band open over the whole effect (CreateVideo of a 2 s Blinds:
 * 0.9 % of the shape shown at 0.1 s, 22 % at 0.5 s, 50 % at 1.0 s), while the
 * two-stop keyframe showed nothing until 1.0 s and then everything. Sampling
 * the reveal at many stops makes the swap happen in small steps instead.
 *
 * @module render/animation-sampled-mask-keyframes
 */

/** Stops across the effect: the mask steps every 2.5 % of the duration. */
export const MASK_SAMPLE_STEPS = 40;

/**
 * A `@keyframes` block named `name` whose stop at fraction `f` carries
 * `declAt(f)` (a kebab-case declaration list) with the shape fully opaque.
 */
export function sampledMaskKeyframes(
	name: string,
	declAt: (fraction: number) => string,
	steps: number = MASK_SAMPLE_STEPS,
): string {
	const lines: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const fraction = i / steps;
		lines.push(`\t${Number((fraction * 100).toFixed(3))}% { ${declAt(fraction)} opacity: 1; }`);
	}
	return `@keyframes ${name} {\n${lines.join('\n')}\n}`;
}
