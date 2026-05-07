import { describe, expect, it } from 'vitest';

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';
import { PRESET_SHAPE_GEOMETRY_TABLE } from './preset-shape-definitions-table';

const REQUIRED_SHAPES = [
	'rect',
	'roundRect',
	'ellipse',
	'triangle',
	'rtTriangle',
	'parallelogram',
	'trapezoid',
	'diamond',
	'pentagon',
	'hexagon',
	'heptagon',
	'octagon',
	'decagon',
	'dodecagon',
	'pie',
	'pieWedge',
	'chord',
	'arc',
	'donut',
	'noSmoking',
	'blockArc',
	'rightArrow',
	'leftArrow',
	'upArrow',
	'downArrow',
	'wedgeRectCallout',
	'wedgeRoundRectCallout',
	'wedgeEllipseCallout',
	'star4',
	'star5',
] as const;

describe('preset shape geometry table', () => {
	it('contains every required first-cut preset (30 shapes)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(PRESET_SHAPE_GEOMETRY_TABLE[name], `missing preset ${name}`).toBeDefined();
		}
		expect(REQUIRED_SHAPES).toHaveLength(30);
	});

	it('every shape has at least one path with at least one command', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = PRESET_SHAPE_GEOMETRY_TABLE[name] as PresetShapeGeometryDefinition;
			expect(def.pathLst.length, `${name} pathLst empty`).toBeGreaterThan(0);
			for (const path of def.pathLst) {
				expect(path.commands.length, `${name} command list empty`).toBeGreaterThan(0);
			}
		}
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(PRESET_SHAPE_GEOMETRY_TABLE)) {
			expect(def.name).toBe(key);
		}
	});

	it('roundRect default adj is 16667 per ECMA-376', () => {
		// ECMA-376 §20.1.10.55 / presetShapeDefinitions.xml: roundRect's
		// canonical default adj1/adj is 16667 (≈1/3 of the half-side).
		expect(PRESET_SHAPE_GEOMETRY_TABLE.roundRect?.avLst?.adj).toBe(16667);
	});

	it('blockArc default adj1 is 10800000 (180 degrees in 60000ths)', () => {
		// ECMA preset: blockArc starts at 180° and sweeps to 0°, default
		// thickness 25%. 10800000 / 60000 = 180.
		expect(PRESET_SHAPE_GEOMETRY_TABLE.blockArc?.avLst?.adj1).toBe(10800000);
		expect(PRESET_SHAPE_GEOMETRY_TABLE.blockArc?.avLst?.adj2).toBe(0);
		expect(PRESET_SHAPE_GEOMETRY_TABLE.blockArc?.avLst?.adj3).toBe(25000);
	});

	it('arc default sweep is 16200000 → 0 (270° start, 0° end)', () => {
		// ECMA preset arc: starts at 270° (3/4 circle) and ends at 0° → quarter arc.
		expect(PRESET_SHAPE_GEOMETRY_TABLE.arc?.avLst?.adj1).toBe(16200000);
		expect(PRESET_SHAPE_GEOMETRY_TABLE.arc?.avLst?.adj2).toBe(0);
	});

	it('arrow defaults are 50% body / 50% head per spec', () => {
		for (const name of ['rightArrow', 'leftArrow', 'upArrow', 'downArrow'] as const) {
			expect(PRESET_SHAPE_GEOMETRY_TABLE[name]?.avLst?.adj1).toBe(50000);
			expect(PRESET_SHAPE_GEOMETRY_TABLE[name]?.avLst?.adj2).toBe(50000);
		}
	});

	it('gd args list mirrors the formula tokens minus the operator', () => {
		// Sanity check on the gd helper: every entry's args length matches
		// formula.split(/\s+/).length - 1.
		for (const def of Object.values(PRESET_SHAPE_GEOMETRY_TABLE)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});
});
