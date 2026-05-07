/**
 * ECMA-376 ST_ShapeType preset geometry definitions — action buttons.
 *
 * The 12 `actionButton*` shapes (`actionButtonBlank`, `actionButtonHome`,
 * `actionButtonHelp`, `actionButtonInformation`, `actionButtonForwardNext`,
 * `actionButtonBackPrevious`, `actionButtonEnd`, `actionButtonBeginning`,
 * `actionButtonReturn`, `actionButtonDocument`, `actionButtonSound`,
 * `actionButtonMovie`) all share the same OOXML preset geometry: a beveled
 * rectangle. The inner glyph (home / help / sound / etc.) is rendered
 * separately by the React layer via `ActionButtonGlyphOverlay`, so we only
 * need to express the button frame here.
 *
 * Geometry: outer rectangle covering the full bounds, plus an inner inset
 * rectangle (the bevel "well"). The inset is `ss / 16` — i.e. one sixteenth
 * of the shorter side, encoded as `adj = 6250` in the canonical 100000-based
 * OOXML adjustment scale. Diagonal lines from each outer corner to the
 * matching inner corner ensure a stroked outline reads as a true bevel.
 *
 * All twelve shapes use identical geometry: a single helper, `buildActionButton`,
 * stamps each definition with the right `name` so the table stays a one-line
 * declaration per shape.
 *
 * Aggregation into `PRESET_SHAPE_GEOMETRY_TABLE` is performed manually in
 * `preset-shape-definitions-table.ts` after batch agents return.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

/**
 * Build a beveled-rectangle `actionButton*` definition. All 12 button shapes
 * share the same outer-rectangle + inner-inset + diagonal-bevel geometry — the
 * only thing that varies is `name`.
 *
 * The default `adj` is 6250 (1/16 of ss in OOXML's 100000-based percent scale).
 * The `pin 0 adj 50000` clamp mirrors the ECMA reference range.
 */
function buildActionButton(name: string): PresetShapeGeometryDefinition {
	return {
		name,
		avLst: { adj: 6250 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('x1', '*/ ss a 100000'),
			gd('x2', '+- r 0 x1'),
			gd('y2', '+- b 0 x1'),
		],
		rect: { l: 'x1', t: 'x1', r: 'x2', b: 'y2' },
		pathLst: [
			// Outer rectangle (the button face).
			{
				fill: 'norm',
				extrusionOk: false,
				commands: [
					{ kind: 'moveTo', x: 'l', y: 't' },
					{ kind: 'lnTo', x: 'r', y: 't' },
					{ kind: 'lnTo', x: 'r', y: 'b' },
					{ kind: 'lnTo', x: 'l', y: 'b' },
					{ kind: 'close' },
				],
			},
			// Inner inset rectangle (the bevel "well") — drawn darkened so the
			// renderer can shade it like the spec's recessed face.
			{
				fill: 'darken',
				stroke: false,
				extrusionOk: false,
				commands: [
					{ kind: 'moveTo', x: 'x1', y: 'x1' },
					{ kind: 'lnTo', x: 'x2', y: 'x1' },
					{ kind: 'lnTo', x: 'x2', y: 'y2' },
					{ kind: 'lnTo', x: 'x1', y: 'y2' },
					{ kind: 'close' },
				],
			},
			// Diagonal bevel facets — stroked-only so a wireframe outline still
			// reads as a beveled rectangle without overpainting the fill.
			{
				stroke: true,
				fill: 'none',
				extrusionOk: false,
				commands: [
					{ kind: 'moveTo', x: 'l', y: 't' },
					{ kind: 'lnTo', x: 'x1', y: 'x1' },
					{ kind: 'moveTo', x: 'r', y: 't' },
					{ kind: 'lnTo', x: 'x2', y: 'x1' },
					{ kind: 'moveTo', x: 'r', y: 'b' },
					{ kind: 'lnTo', x: 'x2', y: 'y2' },
					{ kind: 'moveTo', x: 'l', y: 'b' },
					{ kind: 'lnTo', x: 'x1', y: 'y2' },
				],
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Action-button preset definitions exported for manual aggregation into
 * `PRESET_SHAPE_GEOMETRY_TABLE`. Keys are ECMA-376 ST_ShapeType names.
 *
 * NOTE: this constant name (`ACTION_BUTTON_PRESET_DEFINITIONS`) intentionally
 * differs from the React package's `ACTION_BUTTON_PRESETS` (editor-side icon
 * paths) so the two never collide.
 */
export const ACTION_BUTTON_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	actionButtonBlank: buildActionButton('actionButtonBlank'),
	actionButtonHome: buildActionButton('actionButtonHome'),
	actionButtonHelp: buildActionButton('actionButtonHelp'),
	actionButtonInformation: buildActionButton('actionButtonInformation'),
	actionButtonForwardNext: buildActionButton('actionButtonForwardNext'),
	actionButtonBackPrevious: buildActionButton('actionButtonBackPrevious'),
	actionButtonEnd: buildActionButton('actionButtonEnd'),
	actionButtonBeginning: buildActionButton('actionButtonBeginning'),
	actionButtonReturn: buildActionButton('actionButtonReturn'),
	actionButtonDocument: buildActionButton('actionButtonDocument'),
	actionButtonSound: buildActionButton('actionButtonSound'),
	actionButtonMovie: buildActionButton('actionButtonMovie'),
};
