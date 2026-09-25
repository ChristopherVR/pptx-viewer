/**
 * `animation-circle-iris`: the Circle EXIT (`presetID` 6,
 * `p:animEffect filter="circle(in)" transition="out"`) as an iris closing on
 * the box centre.
 *
 * Ground truth (PowerPoint 365, COM `AddEffect(msoAnimEffectCircle)` +
 * `Effect.Exit = True`, `Presentation.CreateVideo` at 62.5 fps on a 200x200
 * red rectangle): the visible region is a feathered circle whose half-alpha
 * radius starts just outside the box corners and shrinks linearly to the
 * centre (half the half-diagonal at 50% progress), with a soft edge about
 * 1/8 of the half-diagonal wide. The radius is measured in the box's own
 * inscribed-ellipse frame, so a non-square box closes as an ellipse.
 *
 * A gradient's stop positions do not interpolate in CSS, so the keyframe
 * block steps through discrete stops, like `animation-wedge-reveal`.
 *
 * @module render/animation-circle-iris
 */

/** Soft edge width, as a fraction of the half-diagonal. */
export const IRIS_BAND = 0.127;

const STEPS = 30;

/** Half-diagonal as a percentage of the inscribed (closest-side) radius. */
const HALF_DIAGONAL_PCT = 100 * Math.SQRT2;

/** Half-alpha radius, as a fraction of the half-diagonal, at exit progress `p`. */
export function irisRadiusAt(progress: number): number {
	const remaining = 1 - Math.max(0, Math.min(1, progress));
	return -IRIS_BAND / 2 + remaining * (1 + IRIS_BAND);
}

/** Kebab-case mask declarations for the closing iris at exit progress `p` (0-1). */
export function irisDecl(progress: number): string {
	const radius = irisRadiusAt(progress);
	const inner = Math.max(0, radius - IRIS_BAND / 2) * HALF_DIAGONAL_PCT;
	const outer = Math.max(0, radius + IRIS_BAND / 2) * HALF_DIAGONAL_PCT;
	const image = `radial-gradient(closest-side, #000 ${inner.toFixed(2)}%, transparent ${outer.toFixed(2)}%)`;
	return `mask-image: ${image}; mask-size: 100% 100%; mask-repeat: no-repeat; mask-position: center;`;
}

function buildKeyframes(): string {
	const stops: string[] = [];
	for (let index = 0; index <= STEPS; index += 1) {
		const progress = index / STEPS;
		stops.push(`\t${(progress * 100).toFixed(2)}% { ${irisDecl(progress)} opacity: 1; }`);
	}
	return `@keyframes pptx-circleOut {\n${stops.join('\n')}\n}`;
}

/** Static `@keyframes pptx-circleOut`. */
export const CIRCLE_OUT_KEYFRAMES = buildKeyframes();
