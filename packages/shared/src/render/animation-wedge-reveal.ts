/**
 * `animation-wedge-reveal`: the Wedge entrance/exit (`presetID` 20,
 * `p:animEffect filter="wedge"`) as a two-sided angular sweep.
 *
 * Ground truth (PowerPoint 365, COM `AddEffect(msoAnimEffectWedge)` then
 * `Presentation.CreateVideo` at 62.5 fps, frame-diffed on a 200x200 red
 * rectangle): the entrance opens two wedges from 12 o'clock about the box
 * centre, one sweeping clockwise and one anticlockwise, until they meet at
 * 6 o'clock. The half-alpha edge advances linearly with the effect's
 * progress and is feathered over about 24 degrees. The exit is NOT the
 * entrance reversed: the HIDDEN region is the same pair of wedges opening
 * from 12 o'clock, so the last visible sliver closes at 6 o'clock.
 *
 * A conic gradient's angle is not interpolable in CSS, so each keyframe block
 * steps through {@link WEDGE_STEPS} discrete stops (the same technique
 * `animation-pixelate-filter` uses), about one change per frame for a
 * default-length effect.
 *
 * @module render/animation-wedge-reveal
 */

/** Feather width, as a fraction of the 180-degree half-turn. */
export const WEDGE_BAND = 0.133;

/** Discrete keyframe stops per wedge keyframe block. */
export const WEDGE_STEPS = 40;

function deg(value: number): string {
	return `${value.toFixed(2)}deg`;
}

/** Half-alpha edge angle (0-180 degrees from 12 o'clock) at linear progress `p`. */
export function wedgeEdgeAngle(progress: number): number {
	const clamped = Math.max(0, Math.min(1, progress));
	return 180 * (-WEDGE_BAND / 2 + clamped * (1 + WEDGE_BAND));
}

/**
 * The conic mask image at progress `p`. `covered` is the colour inside the
 * two wedges (`#000` shows it, `transparent` hides it), `rest` the colour
 * outside them.
 */
function wedgeImage(progress: number, covered: string, rest: string): string {
	const edge = wedgeEdgeAngle(progress);
	const half = (180 * WEDGE_BAND) / 2;
	const inner = Math.max(0, Math.min(180, edge - half));
	const outer = Math.max(0, Math.min(180, edge + half));
	return [
		`conic-gradient(from 0deg at 50% 50%, ${covered} 0deg, ${covered} ${deg(inner)}`,
		`${rest} ${deg(outer)}, ${rest} ${deg(360 - outer)}`,
		`${covered} ${deg(360 - inner)}, ${covered} 360deg)`,
	].join(', ');
}

/** Kebab-case declarations for the Wedge mask at linear progress `p` (0-1). */
export function wedgeDecl(progress: number, isExit: boolean): string {
	const image = isExit
		? wedgeImage(progress, 'transparent', '#000')
		: wedgeImage(progress, '#000', 'transparent');
	return `mask-image: ${image}; mask-size: 100% 100%; mask-repeat: no-repeat; mask-position: center;`;
}

/** CamelCase inline-style map for a Wedge entrance's HIDDEN state. */
export function wedgeInitialStyle(): Record<string, string | number> {
	return {
		maskImage: wedgeImage(0, '#000', 'transparent'),
		maskSize: '100% 100%',
		maskRepeat: 'no-repeat',
		maskPosition: 'center',
		opacity: 1,
	};
}

function buildKeyframes(name: string, isExit: boolean): string {
	const stops: string[] = [];
	for (let index = 0; index <= WEDGE_STEPS; index += 1) {
		const progress = index / WEDGE_STEPS;
		stops.push(`\t${(progress * 100).toFixed(2)}% { ${wedgeDecl(progress, isExit)} opacity: 1; }`);
	}
	return `@keyframes pptx-${name} {\n${stops.join('\n')}\n}`;
}

/** Static `@keyframes` for the Wedge entrance and exit. */
export const WEDGE_KEYFRAME_DEFINITIONS: Readonly<Record<'wedgeIn' | 'wedgeOut', string>> = {
	wedgeIn: buildKeyframes('wedgeIn', false),
	wedgeOut: buildKeyframes('wedgeOut', true),
};
