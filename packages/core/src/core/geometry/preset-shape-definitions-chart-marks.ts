/**
 * ECMA-376 ST_ShapeType preset geometry definitions - chart marker glyphs.
 *
 * `chartX`, `chartStar` and `chartPlus` are the three data-marker presets
 * PowerPoint and Excel use for scatter / line series markers. They are real
 * `ST_ShapeType` members (ISO/IEC 29500-1 section 20.1.10.55) but were the
 * last three preset names still missing from `PRESET_SHAPE_GEOMETRY_TABLE`,
 * so they degraded to the static polygon approximations in
 * `preset-shape-clip-paths.ts`.
 *
 * Each is transcribed verbatim from Microsoft's `presetShapeDefinitions.xml`:
 * a `fill="none"` stroke path carrying the actual glyph strokes, followed by
 * a `stroke="false"` square that supplies the fill/hit region. None of the
 * three declares an `avLst`, a `gdLst` or a `rect`, so the geometry depends
 * only on the 10x10 path coordinate space each sub-path declares.
 *
 * Aggregated into `PRESET_SHAPE_GEOMETRY_TABLE` by
 * `preset-shape-definitions-table.ts`.
 */

import type { PresetPath, PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

/**
 * The `stroke="false"` backing square every chart marker shares: it carries
 * the fill (and therefore the hit region) while the glyph strokes live on the
 * sibling `fill="none"` path. Returned from a factory so each preset owns its
 * own command array rather than aliasing a shared one.
 */
function markerFillSquare(): PresetPath {
	return {
		w: 10,
		h: 10,
		stroke: false,
		commands: [
			{ kind: 'moveTo', x: '0', y: '0' },
			{ kind: 'lnTo', x: '0', y: '10' },
			{ kind: 'lnTo', x: '10', y: '10' },
			{ kind: 'lnTo', x: '10', y: '0' },
			{ kind: 'close' },
		],
	};
}

// chartX - the two full diagonals of the marker box.
const chartX: PresetShapeGeometryDefinition = {
	name: 'chartX',
	pathLst: [
		{
			w: 10,
			h: 10,
			fill: 'none',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: '0', y: '0' },
				{ kind: 'lnTo', x: '10', y: '10' },
				{ kind: 'moveTo', x: '0', y: '10' },
				{ kind: 'lnTo', x: '10', y: '0' },
			],
		},
		markerFillSquare(),
	],
};

// chartStar - both diagonals plus the vertical centre line (a six-armed
// asterisk once the box is square).
const chartStar: PresetShapeGeometryDefinition = {
	name: 'chartStar',
	pathLst: [
		{
			w: 10,
			h: 10,
			fill: 'none',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: '0', y: '0' },
				{ kind: 'lnTo', x: '10', y: '10' },
				{ kind: 'moveTo', x: '0', y: '10' },
				{ kind: 'lnTo', x: '10', y: '0' },
				{ kind: 'moveTo', x: '5', y: '0' },
				{ kind: 'lnTo', x: '5', y: '10' },
			],
		},
		markerFillSquare(),
	],
};

// chartPlus - the vertical and horizontal centre lines.
const chartPlus: PresetShapeGeometryDefinition = {
	name: 'chartPlus',
	pathLst: [
		{
			w: 10,
			h: 10,
			fill: 'none',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: '5', y: '0' },
				{ kind: 'lnTo', x: '5', y: '10' },
				{ kind: 'moveTo', x: '0', y: '5' },
				{ kind: 'lnTo', x: '10', y: '5' },
			],
		},
		markerFillSquare(),
	],
};

/** Chart-marker preset definitions, keyed by ECMA-376 ST_ShapeType name. */
export const CHART_MARK_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	chartX,
	chartStar,
	chartPlus,
};
