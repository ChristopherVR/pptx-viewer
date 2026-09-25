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

import { ENTRANCE_PRESETS, EXIT_PRESETS } from './animation-preset-catalog-entr-exit';

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

const DIRECTIONS_SPIN = ['clockwise', 'counterClockwise'];

// Entrance and exit presets live in `animation-preset-catalog-entr-exit.ts`
// (COM-derived, see that module's doc); re-exported here unchanged.
export { ENTRANCE_PRESETS, EXIT_PRESETS };

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
