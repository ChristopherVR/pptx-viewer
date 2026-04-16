/**
 * Animation preset catalog for the animation editor UI.
 *
 * Provides categorized lists of available animation presets with
 * human-readable labels, default durations, and effect options.
 * This catalog is consumed by the animation pane to populate
 * the "Add Animation" dropdown menus.
 *
 * @module utils/animation-preset-catalog
 */

export type AnimationCategory = 'entrance' | 'exit' | 'emphasis' | 'motionPath';

export interface AnimationPresetInfo {
	/** OOXML preset class id (e.g. "entr.1" for appear). */
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
// Entrance presets
// ---------------------------------------------------------------------------

export const ENTRANCE_PRESETS: AnimationPresetInfo[] = [
	{
		presetId: 'entr.1',
		label: 'Appear',
		category: 'entrance',
		defaultDurationMs: 0,
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
		presetId: 'entr.2',
		label: 'Fly In',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: [
			'fromBottom',
			'fromLeft',
			'fromRight',
			'fromTop',
			'fromBottomLeft',
			'fromBottomRight',
			'fromTopLeft',
			'fromTopRight',
		],
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
		presetId: 'entr.23',
		label: 'Zoom',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['inFromScreenCenter', 'inSlightly', 'objectCenter'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.14',
		label: 'Bounce',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.22',
		label: 'Wipe',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['fromBottom', 'fromLeft', 'fromRight', 'fromTop'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.16',
		label: 'Split',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['horizontalIn', 'horizontalOut', 'verticalIn', 'verticalOut'],
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
		presetId: 'entr.21',
		label: 'Wheel',
		category: 'entrance',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: ['1spoke', '2spoke', '3spoke', '4spoke', '8spoke'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.3',
		label: 'Blinds',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['horizontal', 'vertical'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.4',
		label: 'Box',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['in', 'out'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.12',
		label: 'Float Up',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.42',
		label: 'Rise Up',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'entr.45',
		label: 'Swivel',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['horizontal', 'vertical'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.17',
		label: 'Checkerboard',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['across', 'down'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.18',
		label: 'Flash Once',
		category: 'entrance',
		defaultDurationMs: 300,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'entr.19',
		label: 'Peek In',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['fromBottom', 'fromLeft', 'fromRight', 'fromTop'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.20',
		label: 'Random Bars',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['horizontal', 'vertical'],
		hasTextBuild: true,
	},
	{
		presetId: 'entr.49',
		label: 'Expand',
		category: 'entrance',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
];

// ---------------------------------------------------------------------------
// Exit presets
// ---------------------------------------------------------------------------

export const EXIT_PRESETS: AnimationPresetInfo[] = [
	{
		presetId: 'exit.1',
		label: 'Disappear',
		category: 'exit',
		defaultDurationMs: 0,
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
		presetId: 'exit.2',
		label: 'Fly Out',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['toBottom', 'toLeft', 'toRight', 'toTop'],
		hasTextBuild: true,
	},
	{
		presetId: 'exit.23',
		label: 'Zoom',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['outFromScreenCenter', 'outSlightly', 'objectCenter'],
		hasTextBuild: true,
	},
	{
		presetId: 'exit.14',
		label: 'Bounce',
		category: 'exit',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: true,
	},
	{
		presetId: 'exit.22',
		label: 'Wipe',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: true,
		directions: ['fromBottom', 'fromLeft', 'fromRight', 'fromTop'],
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
		presetId: 'exit.48',
		label: 'Shrink & Turn',
		category: 'exit',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: true,
	},
];

// ---------------------------------------------------------------------------
// Emphasis presets
// ---------------------------------------------------------------------------

export const EMPHASIS_PRESETS: AnimationPresetInfo[] = [
	{
		presetId: 'emph.32',
		label: 'Pulse',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.8',
		label: 'Spin',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: true,
		directions: ['clockwise', 'counterClockwise'],
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
		presetId: 'emph.35',
		label: 'Teeter',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
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
		presetId: 'emph.34',
		label: 'Bold Flash',
		category: 'emphasis',
		defaultDurationMs: 500,
		hasDirection: false,
		hasTextBuild: false,
	},
	{
		presetId: 'emph.36',
		label: 'Wave',
		category: 'emphasis',
		defaultDurationMs: 1000,
		hasDirection: false,
		hasTextBuild: false,
	},
];

// ---------------------------------------------------------------------------
// Motion path presets
// ---------------------------------------------------------------------------

export const MOTION_PATH_PRESETS: AnimationPresetInfo[] = [
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
		presetId: 'path.line.up',
		label: 'Lines: Up',
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
