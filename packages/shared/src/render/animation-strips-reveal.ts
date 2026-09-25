/**
 * `animation-strips-reveal`: the Strips entrance/exit (`presetID` 18,
 * `p:animEffect filter="strips(<dir>)"`) as a diagonal corner-to-corner
 * mask sweep.
 *
 * Ground truth (PowerPoint 365, COM `AddEffect(msoAnimEffectStrips)` then
 * `Presentation.CreateVideo` at 62.5 fps, frame-diffed on a 200x200 red
 * rectangle): the reveal starts at ONE corner and sweeps linearly to the
 * opposite corner along the diagonal. The token names the TRAVEL direction,
 * so `downLeft` starts at the top-right corner, `upLeft` at the bottom-right,
 * `downRight` at the top-left and `upRight` at the bottom-left
 * (`presetSubtype` 12 / 9 / 6 / 3 respectively). The sweep front sits at the
 * effect's linear progress (half-coverage at 50%), and the leading edge is a
 * soft band about 1/8 of the corner-to-corner distance wide (PowerPoint draws
 * that band as a 16x16 staircase of cells; this mask draws it as a smooth
 * ramp). The exit form plays the same sweep time-reversed: the hidden region
 * grows from the END corner back toward the start corner.
 *
 * The mask is one `linear-gradient(to <corner>)` image sized 3x the element
 * on both axes; only `mask-position` animates, which browsers interpolate
 * smoothly, and the "magic corner" gradient keeps the isolines parallel to
 * the element's own diagonal for any aspect ratio.
 *
 * @module render/animation-strips-reveal
 */

/** A `strips(<token>)` filter subtype: the direction the sweep travels. */
export type StripsDirection = 'downLeft' | 'upLeft' | 'downRight' | 'upRight';

interface StripsCorner {
	/** The sweep starts on the element's right edge. */
	right: boolean;
	/** The sweep starts on the element's bottom edge. */
	bottom: boolean;
	/** CSS gradient direction from the start corner to the opposite corner. */
	toward: string;
}

const START_CORNER: Readonly<Record<StripsDirection, StripsCorner>> = {
	downLeft: { right: true, bottom: false, toward: 'to bottom left' },
	upLeft: { right: true, bottom: true, toward: 'to top left' },
	downRight: { right: false, bottom: false, toward: 'to bottom right' },
	upRight: { right: false, bottom: true, toward: 'to top right' },
};

/** Mask image size as a multiple of the element box (both axes). */
const IMAGE_SCALE = 3;

/** Soft leading-band width, as a fraction of the corner-to-corner travel. */
export const STRIPS_BAND = 0.125;

/** `presetSubtype` codes PowerPoint writes for each Strips direction (COM-verified). */
export const STRIPS_SUBTYPE_TO_DIRECTION: Readonly<Record<number, StripsDirection>> = {
	3: 'upRight',
	6: 'downRight',
	9: 'upLeft',
	12: 'downLeft',
};

/** PowerPoint's default Strips direction (`AddEffect` with no Direction set). */
export const DEFAULT_STRIPS_DIRECTION: StripsDirection = 'downLeft';

/** Narrow a filter subtype token to a {@link StripsDirection}. */
export function isStripsDirection(token: string | undefined): token is StripsDirection {
	return token !== undefined && Object.hasOwn(START_CORNER, token);
}

function format(value: number): string {
	return `${(value * 100).toFixed(3)}%`;
}

/**
 * `mask-position` that puts the sweep front (the band's midline) at `front`,
 * where `front` is the distance from the start corner along the diagonal as a
 * fraction of the corner-to-corner travel (0 = start corner, 1 = far corner).
 *
 * Derivation: with the image `k` times the element and positioned at
 * `(px, py)`, a magic-corner gradient's parameter at an element point whose
 * diagonal distance is `d` is `s = (2d + (k - 1)(qx + qy)) / 2k`, where `qx`
 * is `px` (left start) or `1 - px` (right start), likewise `qy`. The band is
 * centred on `s = 0.5`, so `qx = qy = (k - 2 front) / (2 (k - 1))`.
 */
export function stripsMaskPosition(direction: StripsDirection, front: number): string {
	const corner = START_CORNER[direction];
	const q = (IMAGE_SCALE - 2 * front) / (2 * (IMAGE_SCALE - 1));
	const px = corner.right ? 1 - q : q;
	const py = corner.bottom ? 1 - q : q;
	return `${format(px)} ${format(py)}`;
}

function stripsImage(direction: StripsDirection): string {
	const half = STRIPS_BAND / (2 * IMAGE_SCALE);
	return `linear-gradient(${START_CORNER[direction].toward}, #000 ${format(0.5 - half)}, transparent ${format(0.5 + half)})`;
}

/** Sweep front for a linear progress `p` (0-1): fully hidden at 0, fully shown at 1. */
export function stripsFrontAt(progress: number): number {
	const clamped = Math.max(0, Math.min(1, progress));
	return -STRIPS_BAND / 2 + clamped * (1 + STRIPS_BAND);
}

/** Kebab-case declarations for the Strips mask at a linear reveal progress (0-1). */
export function stripsDecl(direction: StripsDirection, progress: number): string {
	const size = `${IMAGE_SCALE * 100}% ${IMAGE_SCALE * 100}%`;
	const position = stripsMaskPosition(direction, stripsFrontAt(progress));
	return `mask-image: ${stripsImage(direction)}; mask-size: ${size}; mask-repeat: no-repeat; mask-position: ${position};`;
}

/** CamelCase inline-style map for a Strips entrance's HIDDEN state. */
export function stripsInitialStyle(direction: StripsDirection): Record<string, string | number> {
	return {
		maskImage: stripsImage(direction),
		maskSize: `${IMAGE_SCALE * 100}% ${IMAGE_SCALE * 100}%`,
		maskRepeat: 'no-repeat',
		maskPosition: stripsMaskPosition(direction, stripsFrontAt(0)),
		opacity: 1,
	};
}

const SUFFIX: Readonly<Record<StripsDirection, string>> = {
	downLeft: 'DownLeft',
	upLeft: 'UpLeft',
	downRight: 'DownRight',
	upRight: 'UpRight',
};

/** Every Strips keyframe name, by direction and class. */
export type StripsEffectName =
	| 'stripsInDownLeft'
	| 'stripsInUpLeft'
	| 'stripsInDownRight'
	| 'stripsInUpRight'
	| 'stripsOutDownLeft'
	| 'stripsOutUpLeft'
	| 'stripsOutDownRight'
	| 'stripsOutUpRight';

/** The Strips effect name for a direction and class. */
export function stripsEffectName(direction: StripsDirection, isExit: boolean): StripsEffectName {
	return `strips${isExit ? 'Out' : 'In'}${SUFFIX[direction]}` as StripsEffectName;
}

/**
 * Resolve the Strips direction from the filter subtype token (the literal
 * PowerPoint pairs with every Strips preset), falling back to the numeric
 * `presetSubtype`, then to PowerPoint's own default.
 */
export function resolveStripsDirection(
	filterSubtype: string | undefined,
	presetSubtype: number | undefined,
): StripsDirection {
	if (isStripsDirection(filterSubtype)) {
		return filterSubtype;
	}
	if (presetSubtype !== undefined && STRIPS_SUBTYPE_TO_DIRECTION[presetSubtype]) {
		return STRIPS_SUBTYPE_TO_DIRECTION[presetSubtype];
	}
	return DEFAULT_STRIPS_DIRECTION;
}

function buildKeyframes(direction: StripsDirection, isExit: boolean): string {
	const name = stripsEffectName(direction, isExit);
	const from = stripsDecl(direction, isExit ? 1 : 0);
	const to = stripsDecl(direction, isExit ? 0 : 1);
	return `@keyframes pptx-${name} {
	from { ${from} opacity: 1; }
	to { ${to} opacity: 1; }
}`;
}

const DIRECTIONS = Object.keys(START_CORNER) as StripsDirection[];

/** Static `@keyframes` for every Strips direction, entrance and exit. */
export const STRIPS_KEYFRAME_DEFINITIONS = Object.fromEntries(
	DIRECTIONS.flatMap((direction) => [
		[stripsEffectName(direction, false), buildKeyframes(direction, false)],
		[stripsEffectName(direction, true), buildKeyframes(direction, true)],
	]),
) as Record<StripsEffectName, string>;

/**
 * Redirect a default Strips effect name (`stripsInDownLeft` /
 * `stripsOutDownLeft`, what the preset tables map `presetID` 18 to) onto the
 * animation's own direction. Any other effect name is returned unchanged.
 */
export function redirectStripsEffect<T extends string>(
	effect: T | undefined,
	filter: { family: string; subtype?: string } | undefined,
	presetSubtype: number | undefined,
): T | StripsEffectName | undefined {
	if (effect !== 'stripsInDownLeft' && effect !== 'stripsOutDownLeft') {
		return effect;
	}
	const token = filter?.family === 'strips' ? filter.subtype : undefined;
	return stripsEffectName(
		resolveStripsDirection(token, presetSubtype),
		effect.startsWith('stripsOut'),
	);
}

/** The travel direction a Strips ENTRANCE effect name encodes, or `undefined`. */
export function stripsEntranceDirection(effect: string): StripsDirection | undefined {
	return DIRECTIONS.find((direction) => stripsEffectName(direction, false) === effect);
}
