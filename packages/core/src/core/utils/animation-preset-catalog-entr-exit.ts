/**
 * Entrance and exit halves of the animation preset catalogue, derived from
 * retail PowerPoint via COM rather than guessed.
 *
 * METHOD: every `MsoAnimEffect` value 1..82 was added to a blank rectangle
 * with `Slide.TimeLine.MainSequence.AddEffect`, once as an entrance and once
 * with `Effect.Exit = True`, and the saved `p:cTn/@presetID` read back. The
 * reverse check (a deck whose slide `k` carries `presetID="k"`, reopened in
 * PowerPoint and read through `Effect.EffectType`) agrees exactly: these 52
 * ids are the whole entrance/exit preset space. The object model's own enum
 * and the OOXML presetID diverge from id 32 up (`msoAnimEffectLightSpeed` is
 * 32 but saves presetID 34, `msoAnimEffectFold` is 53 but saves 58, and so
 * on), which is how the previous hand-written catalogue drifted: it labelled
 * ids 27+ by guesswork. Ids 32, 33, 36, 44, 46, 57 and 59..68 are not
 * gallery presets (PowerPoint reports no effect type for them) and are not
 * offered.
 *
 * `defaultDurationMs` is PowerPoint's own default `Effect.Timing.Duration`
 * for that preset. Exit labels use PowerPoint's exit-gallery name where the
 * exit form has one (Disappear, Sink Down, Contract, Collapse, ...).
 *
 * @module utils/animation-preset-catalog-entr-exit
 */
import type { AnimationPresetInfo } from './animation-preset-catalog';

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
const DIRECTIONS_WHEEL = ['1spoke', '2spoke', '3spoke', '4spoke', '8spoke'];
const DIRECTIONS_CHECKERBOARD = ['across', 'down'];
const DIRECTIONS_STRIPS = ['leftDown', 'leftUp', 'rightDown', 'rightUp'];

function preset(
	category: 'entrance' | 'exit',
	presetClass: 'entr' | 'exit',
	id: number,
	label: string,
	defaultDurationMs: number,
	directions?: string[],
): AnimationPresetInfo {
	return {
		presetId: `${presetClass}.${id}`,
		label,
		category,
		defaultDurationMs,
		hasDirection: directions !== undefined,
		...(directions ? { directions } : {}),
		hasTextBuild: true,
	};
}

function entr(
	id: number,
	label: string,
	defaultDurationMs: number,
	directions?: string[],
): AnimationPresetInfo {
	return preset('entrance', 'entr', id, label, defaultDurationMs, directions);
}

function exit(
	id: number,
	label: string,
	defaultDurationMs: number,
	directions?: string[],
): AnimationPresetInfo {
	return preset('exit', 'exit', id, label, defaultDurationMs, directions);
}

export const ENTRANCE_PRESETS: AnimationPresetInfo[] = [
	entr(1, 'Appear', 0),
	entr(2, 'Fly In', 500, DIRECTIONS_8WAY),
	entr(3, 'Blinds', 500, DIRECTIONS_AXIS),
	entr(4, 'Box', 2000, DIRECTIONS_INOUT),
	entr(5, 'Checkerboard', 500, DIRECTIONS_CHECKERBOARD),
	entr(6, 'Circle', 2000, DIRECTIONS_INOUT),
	entr(7, 'Crawl In', 5000, DIRECTIONS_4WAY),
	entr(8, 'Diamond', 2000, DIRECTIONS_INOUT),
	entr(9, 'Dissolve In', 500),
	entr(10, 'Fade', 500),
	entr(11, 'Flash Once', 1000),
	entr(12, 'Peek In', 500, DIRECTIONS_4WAY),
	entr(13, 'Plus', 2000, DIRECTIONS_INOUT),
	entr(14, 'Random Bars', 500, DIRECTIONS_AXIS),
	entr(15, 'Spiral In', 1000),
	entr(16, 'Split', 500, DIRECTIONS_AXIS_INOUT),
	entr(17, 'Stretch', 500),
	entr(18, 'Strips', 500, DIRECTIONS_STRIPS),
	entr(19, 'Swivel', 5000, DIRECTIONS_AXIS),
	entr(20, 'Wedge', 2000),
	entr(21, 'Wheel', 2000, DIRECTIONS_WHEEL),
	entr(22, 'Wipe', 500, DIRECTIONS_4WAY),
	entr(23, 'Zoom', 500, DIRECTIONS_ZOOM_IN),
	entr(24, 'Random Effects', 0),
	entr(25, 'Boomerang', 1000),
	entr(26, 'Bounce', 2000),
	entr(27, 'Color Typewriter', 80),
	entr(28, 'Credits', 15000),
	entr(29, 'Ease In', 1000),
	entr(30, 'Float', 1000),
	entr(31, 'Grow & Turn', 1000),
	entr(34, 'Light Speed', 1000),
	entr(35, 'Pinwheel', 2000),
	entr(37, 'Rise Up', 1000),
	entr(38, 'Swish', 1000),
	entr(39, 'Thin Line', 500),
	entr(40, 'Unfold', 1000),
	entr(41, 'Whip', 500),
	entr(42, 'Ascend', 1000),
	entr(43, 'Center Revolve', 1000),
	entr(45, 'Faded Swivel', 2000),
	entr(47, 'Descend', 1000),
	entr(48, 'Sling', 1000),
	entr(49, 'Spinner', 500),
	entr(50, 'Compress', 1000),
	entr(51, 'Zip', 2000),
	entr(52, 'Arc Up', 1000),
	entr(53, 'Faded Zoom', 500),
	entr(54, 'Glide', 500),
	entr(55, 'Expand', 1000),
	entr(56, 'Flip', 1000),
	entr(58, 'Fold', 500),
];

export const EXIT_PRESETS: AnimationPresetInfo[] = [
	exit(1, 'Disappear', 0),
	exit(2, 'Fly Out', 500, DIRECTIONS_8WAY_OUT),
	exit(3, 'Blinds', 500, DIRECTIONS_AXIS),
	exit(4, 'Box', 2000, DIRECTIONS_INOUT),
	exit(5, 'Checkerboard', 500, DIRECTIONS_CHECKERBOARD),
	exit(6, 'Circle', 2000, DIRECTIONS_INOUT),
	exit(7, 'Crawl Out', 5000, DIRECTIONS_4WAY_OUT),
	exit(8, 'Diamond', 2000, DIRECTIONS_INOUT),
	exit(9, 'Dissolve Out', 500),
	exit(10, 'Fade', 500),
	exit(11, 'Flash Once', 1000),
	exit(12, 'Peek Out', 500, DIRECTIONS_4WAY_OUT),
	exit(13, 'Plus', 2000, DIRECTIONS_INOUT),
	exit(14, 'Random Bars', 500, DIRECTIONS_AXIS),
	exit(15, 'Spiral Out', 1000),
	exit(16, 'Split', 500, DIRECTIONS_AXIS_INOUT),
	exit(17, 'Collapse', 500),
	exit(18, 'Strips', 500, DIRECTIONS_STRIPS),
	exit(19, 'Swivel', 5000, DIRECTIONS_AXIS),
	exit(20, 'Wedge', 2000),
	exit(21, 'Wheel', 2000, DIRECTIONS_WHEEL),
	exit(22, 'Wipe', 500, DIRECTIONS_4WAY),
	exit(23, 'Zoom', 500, DIRECTIONS_ZOOM_OUT),
	exit(24, 'Random Effects', 0),
	exit(25, 'Boomerang', 1000),
	exit(26, 'Bounce', 2000),
	exit(27, 'Color Typewriter', 80),
	exit(28, 'Credits', 15000),
	exit(29, 'Ease Out', 1000),
	exit(30, 'Float', 1000),
	exit(31, 'Shrink & Turn', 1000),
	exit(34, 'Light Speed', 1000),
	exit(35, 'Pinwheel', 2000),
	exit(37, 'Sink Down', 1000),
	exit(38, 'Swish', 1000),
	exit(39, 'Thin Line', 500),
	exit(40, 'Unfold', 1000),
	exit(41, 'Whip', 500),
	exit(42, 'Ascend', 1000),
	exit(43, 'Center Revolve', 1000),
	exit(45, 'Faded Swivel', 2000),
	exit(47, 'Descend', 1000),
	exit(48, 'Sling', 1000),
	exit(49, 'Spinner', 500),
	exit(50, 'Stretchy', 1000),
	exit(51, 'Zip', 2000),
	exit(52, 'Arc Up', 1000),
	exit(53, 'Faded Zoom', 500),
	exit(54, 'Glide', 500),
	exit(55, 'Contract', 1000),
	exit(56, 'Flip', 1000),
	exit(58, 'Fold', 500),
];
