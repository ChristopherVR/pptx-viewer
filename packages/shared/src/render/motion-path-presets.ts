/**
 * `motion-path-presets`: the authoring catalogue of PowerPoint motion-path
 * effects (Lines, Arcs, Turns, Shapes, Loops).
 *
 * WHY a path string and not a preset id: OOXML carries a motion path as free
 * form geometry in `p:animMotion/@path`; the integer `presetID` on a `path`
 * class node is informational and is NOT how PowerPoint reconstructs the
 * curve. So a preset here is a *named path string*, and applying one simply
 * writes that string onto the element's animation. Anything the user then
 * drags stays representable, and a deck authored elsewhere round-trips through
 * the same field.
 *
 * Coordinate space: the numbers are fractions of the SLIDE box, measured from
 * the animated element's own centre (`pathEditMode="relative"`), which is what
 * PowerPoint emits. `0.25 0` means "a quarter of the slide width to the right
 * of where the shape sits". Keeping the catalogue in the wire units means no
 * conversion happens on apply or save, only on render.
 *
 * The shapes/loops use x fractions of 0.125 against y fractions of 0.2222 so
 * they read as visually round on the 16:9 canvas the viewer renders at
 * (0.125 * 1280 === 0.2222 * 720 === 160 px).
 *
 * @module render/motion-path-presets
 */

/** PowerPoint's five motion-path families, in ribbon order. */
export type MotionPathFamily = 'lines' | 'arcs' | 'turns' | 'shapes' | 'loops';

/** One named motion path offered by the authoring UI. */
export interface MotionPathPreset {
	/** Stable id, also the i18n label suffix (`pptx.animation.motionPath.preset.<id>`). */
	id: string;
	/** Which PowerPoint gallery family the preset belongs to. */
	family: MotionPathFamily;
	/** OOXML path data in slide fractions, relative to the element centre. */
	path: string;
}

/** Bezier handle length for a circular quadrant (4/3 * tan(pi/8)). */
const K = 0.5523;

/** Half-extents used by the closed shapes, equal in rendered pixels on 16:9. */
const RX = 0.125;
const RY = 0.2222;

const CIRCLE = [
	'M 0 0',
	`C ${-K * RX} 0 ${-RX} ${-RY + K * RY} ${-RX} ${-RY}`,
	`C ${-RX} ${-RY - K * RY} ${-K * RX} ${-2 * RY} 0 ${-2 * RY}`,
	`C ${K * RX} ${-2 * RY} ${RX} ${-RY - K * RY} ${RX} ${-RY}`,
	`C ${RX} ${-RY + K * RY} ${K * RX} 0 0 0`,
]
	.join(' ')
	.replace(/(\d\.\d{4})\d+/gu, '$1');

/**
 * Every motion-path preset, grouped by family in gallery order. Lines travel a
 * quarter of the slide, matching the distance PowerPoint's own line presets use
 * for a shape dropped near the middle of a slide.
 */
export const MOTION_PATH_PRESETS: readonly MotionPathPreset[] = [
	// -- Lines ---------------------------------------------------------------
	{ id: 'lineRight', family: 'lines', path: 'M 0 0 L 0.25 0' },
	{ id: 'lineLeft', family: 'lines', path: 'M 0 0 L -0.25 0' },
	{ id: 'lineDown', family: 'lines', path: 'M 0 0 L 0 0.25' },
	{ id: 'lineUp', family: 'lines', path: 'M 0 0 L 0 -0.25' },
	{ id: 'lineDiagonalUpRight', family: 'lines', path: 'M 0 0 L 0.25 -0.25' },
	{ id: 'lineDiagonalDownRight', family: 'lines', path: 'M 0 0 L 0.25 0.25' },
	{ id: 'lineDiagonalUpLeft', family: 'lines', path: 'M 0 0 L -0.25 -0.25' },
	{ id: 'lineDiagonalDownLeft', family: 'lines', path: 'M 0 0 L -0.25 0.25' },

	// -- Arcs ----------------------------------------------------------------
	{
		id: 'arcUp',
		family: 'arcs',
		path: 'M 0 0 C 0 -0.1227 0.0559 -0.2222 0.125 -0.2222 C 0.1941 -0.2222 0.25 -0.1227 0.25 0',
	},
	{
		id: 'arcDown',
		family: 'arcs',
		path: 'M 0 0 C 0 0.1227 0.0559 0.2222 0.125 0.2222 C 0.1941 0.2222 0.25 0.1227 0.25 0',
	},
	{
		id: 'arcRight',
		family: 'arcs',
		path: 'M 0 0 C 0.069 0 0.125 0.0995 0.125 0.2222 C 0.125 0.3449 0.069 0.4444 0 0.4444',
	},
	{
		id: 'arcLeft',
		family: 'arcs',
		path: 'M 0 0 C -0.069 0 -0.125 0.0995 -0.125 0.2222 C -0.125 0.3449 -0.069 0.4444 0 0.4444',
	},

	// -- Turns ---------------------------------------------------------------
	{ id: 'turnUp', family: 'turns', path: 'M 0 0 L 0.25 0 L 0.25 -0.25' },
	{ id: 'turnDown', family: 'turns', path: 'M 0 0 L 0.25 0 L 0.25 0.25' },
	{ id: 'turnRight', family: 'turns', path: 'M 0 0 L 0 0.25 L 0.25 0.25' },
	{ id: 'turnLeft', family: 'turns', path: 'M 0 0 L 0 0.25 L -0.25 0.25' },
	{
		id: 'sCurve',
		family: 'turns',
		path: 'M 0 0 C 0.0833 -0.1111 0.1667 0.1111 0.25 0',
	},
	{
		id: 'zigzag',
		family: 'turns',
		path: 'M 0 0 L 0.0625 -0.1111 L 0.125 0 L 0.1875 -0.1111 L 0.25 0',
	},

	// -- Shapes --------------------------------------------------------------
	{ id: 'circle', family: 'shapes', path: CIRCLE },
	{ id: 'square', family: 'shapes', path: 'M 0 0 L 0.125 0 L 0.125 -0.2222 L 0 -0.2222 Z' },
	{ id: 'triangle', family: 'shapes', path: 'M 0 0 L 0.0625 -0.2222 L 0.125 0 Z' },
	{
		id: 'diamond',
		family: 'shapes',
		path: 'M 0 0 L 0.0625 -0.1111 L 0.125 0 L 0.0625 0.1111 Z',
	},
	{
		id: 'hexagon',
		family: 'shapes',
		path: 'M 0 0 L 0.0417 -0.1111 L 0.125 -0.1111 L 0.1667 0 L 0.125 0.1111 L 0.0417 0.1111 Z',
	},

	// -- Loops ---------------------------------------------------------------
	{
		id: 'loopDeLoop',
		family: 'loops',
		path: 'M 0 0 C 0.0625 0 0.0972 -0.2222 0.1667 -0.2222 C 0.2361 -0.2222 0.2708 0 0.1667 0 L 0.3333 0',
	},
	{
		id: 'figureEight',
		family: 'loops',
		path: 'M 0 0 C -0.0833 0 -0.0833 -0.2222 0 -0.2222 C 0.0833 -0.2222 0.0833 0 0.1667 0 C 0.25 0 0.25 -0.2222 0.1667 -0.2222 C 0.0833 -0.2222 0.0833 0 0 0',
	},
	{
		id: 'spiral',
		family: 'loops',
		path: 'M 0 0 C 0.0417 0 0.0417 -0.0741 0 -0.0741 C -0.0625 -0.0741 -0.0625 -0.1852 0 -0.1852 C 0.0833 -0.1852 0.0833 -0.3333 0 -0.3333',
	},
];

/** The five families in gallery order, for building grouped UI. */
export const MOTION_PATH_FAMILIES: readonly MotionPathFamily[] = [
	'lines',
	'arcs',
	'turns',
	'shapes',
	'loops',
];

/** i18n key for a family heading (`Lines`, `Arcs`, ...). */
export function motionPathFamilyLabelKey(family: MotionPathFamily): string {
	return `pptx.animation.motionPath.family.${family}`;
}

/** i18n key for a preset's label (`Right`, `Arc Up`, ...). */
export function motionPathPresetLabelKey(presetId: string): string {
	return `pptx.animation.motionPath.preset.${presetId}`;
}

/** Look a preset up by id. */
export function motionPathPresetById(presetId: string): MotionPathPreset | undefined {
	return MOTION_PATH_PRESETS.find((preset) => preset.id === presetId);
}

/** Every preset in one family, in catalogue order. */
export function motionPathPresetsByFamily(family: MotionPathFamily): MotionPathPreset[] {
	return MOTION_PATH_PRESETS.filter((preset) => preset.family === family);
}

/**
 * Reverse lookup: the preset id whose path string matches `path`, or
 * `undefined` for a hand-dragged (custom) path. Lets the panel name the applied
 * effect instead of showing raw path data.
 */
export function motionPathPresetIdForPath(path: string | undefined): string | undefined {
	if (!path) {
		return undefined;
	}
	const normalized = path.trim().replace(/\s+/gu, ' ');
	return MOTION_PATH_PRESETS.find(
		(preset) => preset.path.trim().replace(/\s+/gu, ' ') === normalized,
	)?.id;
}

/** The path applied by the ribbon's one-click "Path Animation" command. */
export const DEFAULT_MOTION_PATH_PRESET_ID = 'lineRight';
