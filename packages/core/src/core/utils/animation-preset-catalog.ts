/**
 * Animation preset catalog for the animation editor UI.
 *
 * Provides categorized lists of available animation presets with
 * human-readable labels, default durations, and effect options.
 * This catalog is consumed by the animation pane to populate
 * the "Add Animation" dropdown menus.
 *
 * The `presetId` strings encode the OOXML preset class and integer ID
 * separated by a dot (e.g. `entr.1` = entrance presetID 1 = "Appear").
 * Motion-path entries use a stable string key (`path.<shape>.<variant>`)
 * because the OOXML motion-path presetID is informational only — the
 * actual SVG path is carried in `p:animMotion/@path`.
 *
 * The list is intentionally broad: it covers the full PowerPoint
 * preset library (entrance, emphasis, exit, motion path) so editors
 * and renderers can name and offer the presets. Round-trip integrity
 * for unknown presets is preserved by the raw `presetID` field on
 * `PptxNativeAnimation`; this catalog provides typed names for the
 * presets PowerPoint emits.
 *
 * @module utils/animation-preset-catalog
 */

export type AnimationCategory = 'entrance' | 'exit' | 'emphasis' | 'motionPath';

export interface AnimationPresetInfo {
	/** Unique preset key. For entr/exit/emph this is `<class>.<presetID>`. */
	presetId: string;
	/** Human-readable label for the UI. */
	label: string;
	/** Animation category. */
	category: AnimationCategory;
	/** Default duration in milliseconds. */
	defaultDurationMs: number;
	/** Whether direction options are available. */
	hasDirection: boolean;
	/** Available directions (if applicable). */
	directions?: string[];
	/** Whether text build options are available. */
	hasTextBuild: boolean;
}

// ---------------------------------------------------------------------------
// Direction option presets shared across many entrance/exit effects.
// ---------------------------------------------------------------------------

const DIRECTIONS_4WAY = ['fromBottom', 'fromLeft', 'fromRight', 'fromTop'];
const DIRECTIONS_4WAY_OUT = ['toBottom', 'toLeft', 'toRight', 'toTop'];
const DIRECTIONS_8WAY = [
	'fromBottom',
	'fromLeft',
	'fromRight',
	'fromTop',
	'fromBottomLeft',
	'fromBottomRight',
	'fromTopLeft',
	'fromTopRight',
];
const DIRECTIONS_8WAY_OUT = [
	'toBottom',
	'toLeft',
	'toRight',
	'toTop',
	'toBottomLeft',
	'toBottomRight',
	'toTopLeft',
	'toTopRight',
];
const DIRECTIONS_AXIS = ['horizontal', 'vertical'];
const DIRECTIONS_AXIS_INOUT = ['horizontalIn', 'horizontalOut', 'verticalIn', 'verticalOut'];
const DIRECTIONS_INOUT = ['in', 'out'];
const DIRECTIONS_ZOOM_IN = ['inFromScreenCenter', 'inSlightly', 'objectCenter'];
const DIRECTIONS_ZOOM_OUT = ['outFromScreenCenter', 'outSlightly', 'objectCenter'];
const DIRECTIONS_SPIN = ['clockwise', 'counterClockwise'];
const DIRECTIONS_WHEEL = ['1spoke', '2spoke', '3spoke', '4spoke', '8spoke'];
const DIRECTIONS_CHECKERBOARD = ['across', 'down'];

// ---------------------------------------------------------------------------
// Entrance presets
// ---------------------------------------------------------------------------

export const ENTRANCE_PRESETS: AnimationPresetInfo[] = [
	// Basic
	{
		presetId: 'entr.1',
		label: 'Appear',
		category: 'entrance',
		defaultDurationMs: 0,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.2',
		label: 'Fly In',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_8WAY,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.3',
		label: 'Blinds',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.4',
		label: 'Box',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.5',
		label: 'Checkerboard',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_CHECKERBOARD,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.6',
		label: 'Circle',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.7',
		label: 'Crawl In',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_4WAY,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.8',
		label: 'Diamond',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.9',
		label: 'Dissolve In',
		category: 'entrance',
		defaultDurationMs: 700,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.10',
		label: 'Fade',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified against retail PowerPoint via COM automation: entr.11
		// emits a plain visibility flash with no filter (Flash Once), not
		// Flash Bulb. Flash Bulb is an EMPHASIS effect (emph.26), not an
		// entrance effect at all, and is out of this catalog's entrance list.
		presetId: 'entr.11',
		label: 'Flash Once',
		category: 'entrance',
		defaultDurationMs: 300,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		// Verified via COM: entr.12 carries `filter="wipe(up)"`, a peek reveal.
		presetId: 'entr.12',
		label: 'Peek In',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_4WAY,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.13',
		label: 'Plus',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.14',
		label: 'Random Bars',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.15',
		label: 'Spiral In',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: entr.16 carries `filter="barn(inVertical)"`, the
		// split barn-door reveal.
		presetId: 'entr.16',
		label: 'Split',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_AXIS_INOUT,
		hasTextBuild: true,
	},
	{
		// Verified via COM: entr.17 emits a plain `ppt_w`/`ppt_h` grow from 0
		// to full size (no filter), matching Stretch. Note entr.18 already
		// carries its own (separately unverified) "Stretch" label in this
		// catalog; that duplicate is a pre-existing, out-of-scope issue this
		// fix does not resolve.
		presetId: 'entr.17',
		label: 'Stretch',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: entr.18 carries `filter="strips(...)"`, the Strips
		// reveal, not Stretch (real Stretch is entr.17 above; this entry used
		// to duplicate that label). entr.19 (below) was previously mislabelled
		// "Strips"; the two were swapped.
		presetId: 'entr.18',
		label: 'Strips',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['leftDown', 'leftUp', 'rightDown', 'rightUp'],
		hasTextBuild: true,
	},
	{
		// Verified via COM: entr.19 is Swivel (`msoAnimEffectSwivel` serializes
		// as presetID 19), not Strips (real Strips is entr.18 above).
		presetId: 'entr.19',
		label: 'Swivel',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.20',
		label: 'Wedge',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.21',
		label: 'Wheel',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_WHEEL,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.22',
		label: 'Wipe',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_4WAY,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.23',
		label: 'Zoom',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_ZOOM_IN,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.24',
		label: 'Random Effects',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'entr.25',
		label: 'Boomerang',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: `msoAnimEffectBounce` serializes as presetID 26,
		// not "Rise Up" (real Rise Up is entr.37, see below). The two were
		// previously swapped in this catalog.
		presetId: 'entr.26',
		label: 'Bounce',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.27',
		label: 'Credits',
		category: 'entrance',
		defaultDurationMs: 8000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'entr.28',
		label: 'Float Up',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.29',
		label: 'Pinwheel',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.30',
		label: 'Spinner',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_SPIN,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.31',
		label: 'Expand',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.32',
		label: 'Whip',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.33',
		label: 'Arrive',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.34',
		label: 'Basic Swivel',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.35',
		label: 'Beveled Arrival',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.36',
		label: 'Curve Up',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: `msoAnimEffectRiseUp` serializes as presetID 37,
		// not "Bounce" (real Bounce is entr.26 above). The two were
		// previously swapped in this catalog.
		presetId: 'entr.37',
		label: 'Rise Up',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.38',
		label: 'Fold',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.39',
		label: 'Faded Swivel',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.40',
		label: 'Faded Zoom',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.41',
		label: 'Light Speed',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.42',
		label: 'Float In',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.43',
		label: 'Flip',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.44',
		label: 'Glide',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.45',
		label: 'Grow & Rotate',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.46',
		label: 'Grow with Color',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: entr.47 is "Descend" (`msoAnimEffectDescend`
		// serializes as presetID 47), not Swivel (real Swivel is entr.19, see
		// above). Note entr.61 already carries its own (separately
		// unverified) "Descend" label in this catalog; that duplicate is a
		// newly surfaced, out-of-scope issue this fix does not resolve.
		presetId: 'entr.47',
		label: 'Descend',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.48',
		label: 'Magnify',
		category: 'entrance',
		defaultDurationMs: 1500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: `msoAnimEffectSpinner` serializes as presetID 49,
		// matching write-mappings' existing `spinnerIn`; the catalog's
		// previous "Pinwheel IV" label was internally inconsistent with that.
		// Note entr.30 already carries its own (separately unverified)
		// "Spinner" label in this catalog; that duplicate is a newly
		// surfaced, out-of-scope issue this fix does not resolve.
		presetId: 'entr.49',
		label: 'Spinner',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.50',
		label: 'Sling',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.51',
		label: 'Compress',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.52',
		label: 'Unfold',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.53',
		label: 'Grow & Turn',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.54',
		label: 'Zoom Rotate',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.55',
		label: 'Curvy Star',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.56',
		label: 'Rotate',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.57',
		label: 'Center Revolve',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.58',
		label: 'Thread',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.59',
		label: 'Drop In',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.60',
		label: 'Ascend',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.61',
		label: 'Descend',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.62',
		label: 'Center Stage',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.63',
		label: 'Ease In',
		category: 'entrance',
		defaultDurationMs: 800,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.64',
		label: 'Stretchy',
		category: 'entrance',
		defaultDurationMs: 800,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.65',
		label: 'Zip',
		category: 'entrance',
		defaultDurationMs: 600,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.66',
		label: 'Bars',
		category: 'entrance',
		defaultDurationMs: 600,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.67',
		label: 'Cover',
		category: 'entrance',
		defaultDurationMs: 700,
		hasDirection: true,
		directions: DIRECTIONS_4WAY,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.68',
		label: 'Reveal',
		category: 'entrance',
		defaultDurationMs: 700,
		hasDirection: true,
		directions: DIRECTIONS_4WAY,
		hasTextBuild: true,
	},
];

// ---------------------------------------------------------------------------
// Exit presets
// ---------------------------------------------------------------------------

export const EXIT_PRESETS: AnimationPresetInfo[] = [
	// Basic
	{
		presetId: 'exit.1',
		label: 'Disappear',
		category: 'exit',
		defaultDurationMs: 0,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.2',
		label: 'Fly Out',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_8WAY_OUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.3',
		label: 'Blinds',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.4',
		label: 'Box',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.5',
		label: 'Checkerboard',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_CHECKERBOARD,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.6',
		label: 'Circle',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.7',
		label: 'Crawl Out',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_4WAY_OUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.8',
		label: 'Diamond',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.9',
		label: 'Dissolve Out',
		category: 'exit',
		defaultDurationMs: 700,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.10',
		label: 'Fade',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via COM: `msoAnimEffectFlashOnce` with `Effect.Exit = True`
		// serializes as presetID 11 (no filter, matching entr.11); Flash Bulb
		// cannot be made an exit effect at all (`Effect.Exit = True` throws
		// for it).
		presetId: 'exit.11',
		label: 'Flash Once',
		category: 'exit',
		defaultDurationMs: 300,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		// Verified via COM (this repo's own PowerShell automation): `AddEffect`
		// with the Peek In `MsoAnimEffect` constant then `Effect.Exit = True`
		// re-emits `presetID="12" presetSubtype="4"` with a child
		// `p:animEffect[@filter="wipe(down)"]`, matching
		// `pptx-viewer-shared`'s `animation-preset-ground-truth.ts`
		// (`row('exit', 12, { sub: 4, filter: 'wipe(down)' })`) exactly. exit.12
		// IS "Peek Out", the exit-gallery counterpart of entr.12's "Peek In"
		// above; this label previously duplicated "Flash Once" as an
		// out-of-scope, unresolved placeholder.
		presetId: 'exit.12',
		label: 'Peek Out',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_4WAY_OUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.13',
		label: 'Plus',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.14',
		label: 'Random Bars',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.15',
		label: 'Spiral Out',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.16',
		label: 'Peek Out',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_4WAY_OUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.17',
		label: 'Split',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_AXIS_INOUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.18',
		label: 'Collapse',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.19',
		label: 'Strips',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['leftDown', 'leftUp', 'rightDown', 'rightUp'],
		hasTextBuild: true,
	},
	{
		presetId: 'exit.20',
		label: 'Wedge',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.21',
		label: 'Wheel',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_WHEEL,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.22',
		label: 'Wipe',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_4WAY,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.23',
		label: 'Zoom',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: DIRECTIONS_ZOOM_OUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.24',
		label: 'Random Effects',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'exit.25',
		label: 'Boomerang',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via a fresh COM pass: `msoAnimEffectBounce` with
		// `Effect.Exit = True` re-emits presetID 26, the SAME id as its
		// entrance form (see entr.26 above), i.e. exit.26 is Bounce, not Sink
		// Down (real Sink Down is exit.37, see below). The two were swapped
		// in this catalog.
		presetId: 'exit.26',
		label: 'Bounce',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.27',
		label: 'Credits',
		category: 'exit',
		defaultDurationMs: 8000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'exit.28',
		label: 'Float Down',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.29',
		label: 'Pinwheel',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.30',
		label: 'Spinner',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_SPIN,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.31',
		label: 'Contract',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.32',
		label: 'Whip',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.33',
		label: 'Leave',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.34',
		label: 'Basic Swivel',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.35',
		label: 'Beveled Departure',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.36',
		label: 'Curve Down',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		// Verified via a fresh COM pass: `msoAnimEffectRiseUp` with
		// `Effect.Exit = True` re-emits presetID 37, the SAME id as its
		// entrance form (see entr.37 above), i.e. exit.37 is Sink Down
		// (Rise Up's exit-gallery name), not Bounce (real Bounce is exit.26,
		// see above). The two were swapped in this catalog.
		presetId: 'exit.37',
		label: 'Sink Down',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.38',
		label: 'Unfold',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.39',
		label: 'Faded Swivel',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.40',
		label: 'Faded Zoom',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.41',
		label: 'Light Speed',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.42',
		label: 'Float Out',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.43',
		label: 'Flip',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.44',
		label: 'Glide',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.45',
		label: 'Shrink & Rotate',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.46',
		label: 'Shrink with Color',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.47',
		label: 'Swivel',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.48',
		label: 'Shrink & Turn',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.49',
		label: 'Pinwheel IV',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.50',
		label: 'Sling',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.51',
		label: 'Stretch Out',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.52',
		label: 'Fold Out',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.53',
		label: 'Shrink & Spin',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.54',
		label: 'Zoom Rotate',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.55',
		label: 'Curvy Star',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.56',
		label: 'Rotate',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.57',
		label: 'Center Revolve',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.58',
		label: 'Thread Out',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.59',
		label: 'Drop Out',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.60',
		label: 'Ascend',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.61',
		label: 'Descend',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.62',
		label: 'Exit Stage',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.63',
		label: 'Ease Out',
		category: 'exit',
		defaultDurationMs: 800,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.64',
		label: 'Stretchy',
		category: 'exit',
		defaultDurationMs: 800,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.65',
		label: 'Zip Out',
		category: 'exit',
		defaultDurationMs: 600,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.66',
		label: 'Bars Out',
		category: 'exit',
		defaultDurationMs: 600,
		hasDirection: true,
		directions: DIRECTIONS_AXIS,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.67',
		label: 'Uncover',
		category: 'exit',
		defaultDurationMs: 700,
		hasDirection: true,
		directions: DIRECTIONS_4WAY_OUT,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.68',
		label: 'Conceal',
		category: 'exit',
		defaultDurationMs: 700,
		hasDirection: true,
		directions: DIRECTIONS_4WAY_OUT,
		hasTextBuild: true,
	},
];

// ---------------------------------------------------------------------------
// Emphasis presets
// ---------------------------------------------------------------------------

// FULL GROUND TRUTH (2026-09-05): every id below was directly observed via
// TWO independent COM/UI-Automation methods - (1) `MainSequence.AddEffect`
// with a named `MsoAnimEffect` constant, and (2) UI Automation invoking the
// literal ribbon / "Add Emphasis Effect" dialog item by its displayed name,
// required for the five ribbon-only names (Pulse, Color Pulse, Object Color,
// Blink, Shimmer) with no `MsoAnimEffect` constant. All 26 items in the "Add
// Emphasis Effect" dialog's Basic/3D/Subtle/Moderate/Exciting groups were
// enumerated via UI Automation and every one resolves to an entry below; see
// `pptx-viewer-shared`'s `animation-emphasis-ground-truth.ts` for the raw
// per-id XML. ids 11/12/13/17/29/37/38/39 correspond to NO named effect
// anywhere in PowerPoint's UI or object model and are correctly absent.
//
// The previous version of this array filled ids 11-64 by sequentially
// GUESSING a label per id with no verification (Spin Slow/Fast, Wobble,
// Jiggle, Heartbeat, Glow, Rainbow, Bob, etc., none of which are real
// PowerPoint emphasis effects); every guess disagreed with the ground truth
// and has been removed. The real catalogue tops out at id 41 (two unnamed
// "3D" dialog items with no representable 2D animation) - there is no id
// 42-64.
//
// emph.26 is both Pulse (the modern ribbon name) and Flash Bulb (the
// `MsoAnimEffect` name): the two methods produced byte-identical XML
// (`presetID="26"`, a `filter="fade"` flash curve plus a 105%/105%
// `autoRev` `animScale`), so this is one preset with two historical names,
// not two effects that were swapped onto one id. Likewise emph.27 is both
// Flicker and Color Pulse.
export const EMPHASIS_PRESETS: AnimationPresetInfo[] = [
	{
		presetId: 'emph.1',
		label: 'Fill Color',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.2',
		label: 'Change Font',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.3',
		label: 'Font Color',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.4',
		label: 'Change Font Size',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.5',
		label: 'Change Font Style',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.6',
		label: 'Grow/Shrink',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.7',
		label: 'Line Color',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.8',
		label: 'Spin',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: DIRECTIONS_SPIN,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.9',
		label: 'Transparency',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.10',
		label: 'Bold Flash',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.14',
		label: 'Blast',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.15',
		label: 'Bold Reveal',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.16',
		label: 'Brush on Color',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.18',
		label: 'Underline',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.19',
		label: 'Object Color',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.20',
		label: 'Color Wave',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.21',
		label: 'Complementary Color',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.22',
		label: 'Complementary Color 2',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.23',
		label: 'Contrasting Color',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.24',
		label: 'Darken',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.25',
		label: 'Desaturate',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.26',
		label: 'Pulse',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.27',
		label: 'Color Pulse',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.28',
		label: 'Grow With Color',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.30',
		label: 'Lighten',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.31',
		label: 'Style Emphasis',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.32',
		label: 'Teeter',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.33',
		label: 'Vertical Grow',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.34',
		label: 'Wave',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.35',
		label: 'Blink',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.36',
		label: 'Shimmer',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		// The "Add Emphasis Effect" dialog's "3D" group has two unnamed
		// "Custom" items; both save with an empty `<p:childTnLst>` (nothing
		// 2D-representable). Labelled descriptively since PowerPoint's own
		// dialog does not name them either.
		presetId: 'emph.40',
		label: '3D Custom 1',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.41',
		label: '3D Custom 2',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
];

// ---------------------------------------------------------------------------
// Motion path presets
//
// Motion paths in OOXML are usually emitted with `presetClass="path"` and an
// SVG-like path string in `p:animMotion/@path`. The integer `presetID` for
// path presets is informational; PowerPoint ships dozens of named paths
// grouped into Lines, Arcs, Turns, Shapes, and Loops. We use stable
// string keys (`path.<group>.<variant>`) so editors can list and search
// the canonical paths without round-trip ambiguity.
// ---------------------------------------------------------------------------

export const MOTION_PATH_PRESETS: AnimationPresetInfo[] = [
	// Lines
	{
		presetId: 'path.line.up',
		label: 'Lines: Up',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.down',
		label: 'Lines: Down',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.left',
		label: 'Lines: Left',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.right',
		label: 'Lines: Right',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.upLeft',
		label: 'Lines: Up-Left',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.upRight',
		label: 'Lines: Up-Right',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.downLeft',
		label: 'Lines: Down-Left',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.line.downRight',
		label: 'Lines: Down-Right',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	// Arcs
	{
		presetId: 'path.arc.up',
		label: 'Arcs: Up',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.arc.down',
		label: 'Arcs: Down',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.arc.left',
		label: 'Arcs: Left',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.arc.right',
		label: 'Arcs: Right',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	// Turns
	{
		presetId: 'path.turn.upLeft',
		label: 'Turns: Up-Left',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.turn.upRight',
		label: 'Turns: Up-Right',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.turn.downLeft',
		label: 'Turns: Down-Left',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.turn.downRight',
		label: 'Turns: Down-Right',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.turn.uTurn',
		label: 'Turns: U-Turn',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	// Shapes
	{
		presetId: 'path.circle',
		label: 'Shapes: Circle',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.diamond',
		label: 'Shapes: Diamond',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.hexagon',
		label: 'Shapes: Hexagon',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.octagon',
		label: 'Shapes: Octagon',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.parallelogram',
		label: 'Shapes: Parallelogram',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.pentagon',
		label: 'Shapes: Pentagon',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.rightTriangle',
		label: 'Shapes: Right Triangle',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.equilateralTriangle',
		label: 'Shapes: Equilateral Triangle',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.trapezoid',
		label: 'Shapes: Trapezoid',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.square',
		label: 'Shapes: Square',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.star4',
		label: 'Shapes: 4 Point Star',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.star5',
		label: 'Shapes: 5 Point Star',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.star6',
		label: 'Shapes: 6 Point Star',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.star8',
		label: 'Shapes: 8 Point Star',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.crescent',
		label: 'Shapes: Crescent Moon',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.heart',
		label: 'Shapes: Heart',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.football',
		label: 'Shapes: Football',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.teardrop',
		label: 'Shapes: Teardrop',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
	// Loops
	{
		presetId: 'path.loop.deCay',
		label: 'Loops: Decaying Wave',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.figure8',
		label: 'Loops: Figure 8',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.figure8Four',
		label: 'Loops: Figure 8 Four',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.horizFigure8',
		label: 'Loops: Horizontal Figure 8',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.vertFigure8',
		label: 'Loops: Vertical Figure 8',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.loopDeLoop',
		label: 'Loops: Loop de Loop',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.neutron',
		label: 'Loops: Neutron',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.peanut',
		label: 'Loops: Peanut',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.pretzel',
		label: 'Loops: Pretzel',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.spring',
		label: 'Loops: Spring',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.swoosh',
		label: 'Loops: Swoosh',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.zigzag',
		label: 'Loops: Zigzag',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.heartBeat',
		label: 'Loops: Heartbeat',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.curvyLeft',
		label: 'Loops: Curvy Left',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.curvyRight',
		label: 'Loops: Curvy Right',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.curvyStar',
		label: 'Loops: Curvy Star',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.figure8Side',
		label: 'Loops: Figure 8 Side',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.spiral',
		label: 'Loops: Spiral',
		category: 'motionPath',
		defaultDurationMs: 3000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.wave',
		label: 'Loops: Wave',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.bean',
		label: 'Loops: Bean',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.buzzSaw',
		label: 'Loops: Buzz Saw',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.cogwheel',
		label: 'Loops: Cogwheel',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.cornerStar',
		label: 'Loops: Corner Star',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.crossPath',
		label: 'Loops: Cross',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.diamond4',
		label: 'Loops: Diamond 4',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.fanIn',
		label: 'Loops: Fan In',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.figure8Top',
		label: 'Loops: Figure 8 Top',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.heartBig',
		label: 'Loops: Big Heart',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.inverted',
		label: 'Loops: Inverted',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.loop.plus',
		label: 'Loops: Plus',
		category: 'motionPath',
		defaultDurationMs: 2500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'path.custom',
		label: 'Custom Path',
		category: 'motionPath',
		defaultDurationMs: 2000,
		hasDirection: false,
		hasTextBuild: false,
	},
];

// ---------------------------------------------------------------------------
// Combined catalog
// ---------------------------------------------------------------------------

export const ALL_ANIMATION_PRESETS: AnimationPresetInfo[] = [
	...ENTRANCE_PRESETS,
	...EXIT_PRESETS,
	...EMPHASIS_PRESETS,
	...MOTION_PATH_PRESETS,
];

/**
 * Look up a preset by its ID.
 */
export function getAnimationPresetInfo(presetId: string): AnimationPresetInfo | undefined {
	return ALL_ANIMATION_PRESETS.find((p) => p.presetId === presetId);
}

/**
 * Get all presets for a given category.
 */
export function getPresetsByCategory(category: AnimationCategory): AnimationPresetInfo[] {
	switch (category) {
		case 'entrance':
			return ENTRANCE_PRESETS;
		case 'exit':
			return EXIT_PRESETS;
		case 'emphasis':
			return EMPHASIS_PRESETS;
		case 'motionPath':
			return MOTION_PATH_PRESETS;
	}
}

/**
 * Resolve native OOXML preset metadata from a parsed `(presetClass, presetId)`
 * pair to the typed catalog entry. Returns `undefined` for unknown
 * combinations — callers should fall back to the raw `presetID` for
 * round-trip preservation.
 *
 * @example
 * ```ts
 * getNativeAnimationPresetMetadata({ presetClass: "entr", presetId: 10 });
 * // => { presetId: "entr.10", label: "Fade", category: "entrance", ... }
 * ```
 */
export function getNativeAnimationPresetMetadata(args: {
	presetClass: 'entr' | 'exit' | 'emph' | 'path';
	presetId: number;
}): AnimationPresetInfo | undefined {
	const { presetClass, presetId } = args;
	if (presetClass === 'path') {
		// Path presets in this catalog use string keys (`path.<group>.<variant>`)
		// not integer IDs; integer presetIDs for path are not standardized.
		return undefined;
	}
	const key = `${presetClass}.${presetId}`;
	switch (presetClass) {
		case 'entr':
			return ENTRANCE_PRESETS.find((p) => p.presetId === key);
		case 'exit':
			return EXIT_PRESETS.find((p) => p.presetId === key);
		case 'emph':
			return EMPHASIS_PRESETS.find((p) => p.presetId === key);
	}
}
