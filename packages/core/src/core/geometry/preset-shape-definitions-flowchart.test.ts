import { describe, expect, it } from 'vitest';

import { evaluateGuides } from './guide-formula-api';
import { evaluateFormula, parseFormula } from './guide-formula-eval';
import { FLOWCHART_PRESET_DEFINITIONS } from './preset-shape-definitions-flowchart';
import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

const REQUIRED_FLOWCHART_SHAPES = [
	'flowChartProcess',
	'flowChartDecision',
	'flowChartAlternateProcess',
	'flowChartPredefinedProcess',
	'flowChartInternalStorage',
	'flowChartDocument',
	'flowChartMultidocument',
	'flowChartTerminator',
	'flowChartPreparation',
	'flowChartManualInput',
	'flowChartManualOperation',
	'flowChartConnector',
	'flowChartOffpageConnector',
	'flowChartPunchedCard',
	'flowChartPunchedTape',
	'flowChartSummingJunction',
	'flowChartOr',
	'flowChartCollate',
	'flowChartSort',
	'flowChartExtract',
	'flowChartMerge',
	'flowChartOnlineStorage',
	'flowChartMagneticDisk',
	'flowChartMagneticDrum',
	'flowChartMagneticTape',
	'flowChartDisplay',
	'flowChartDelay',
	'flowChartStoredData',
] as const;

describe('flowchart preset shape definitions', () => {
	it('contains all 28 required flowchart shapes', () => {
		for (const name of REQUIRED_FLOWCHART_SHAPES) {
			expect(FLOWCHART_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(REQUIRED_FLOWCHART_SHAPES).toHaveLength(28);
		expect(Object.keys(FLOWCHART_PRESET_DEFINITIONS)).toHaveLength(28);
	});

	it('every shape exposes at least one path with at least one command', () => {
		for (const name of REQUIRED_FLOWCHART_SHAPES) {
			const def = FLOWCHART_PRESET_DEFINITIONS[name] as PresetShapeGeometryDefinition;
			expect(def.pathLst.length, `${name} pathLst empty`).toBeGreaterThan(0);
			for (const path of def.pathLst) {
				expect(path.commands.length, `${name} command list empty`).toBeGreaterThan(0);
			}
		}
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(FLOWCHART_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('flowchart shapes have no avLst (no user adjustments per ECMA)', () => {
		// Per ECMA-376 §20.1.10.55 every flowChart* preset has an empty avLst.
		for (const name of REQUIRED_FLOWCHART_SHAPES) {
			const def = FLOWCHART_PRESET_DEFINITIONS[name] as PresetShapeGeometryDefinition;
			expect(def.avLst, `${name} should have no avLst`).toBeUndefined();
		}
	});

	it('gd args list mirrors the formula tokens minus the operator', () => {
		for (const def of Object.values(FLOWCHART_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('all gdLst formulas evaluate to finite numbers for typical dimensions', () => {
		// 200x100 is an arbitrary but representative slide-element size; every
		// guide formula must produce a finite number for the evaluator to
		// generate valid SVG path output.
		for (const def of Object.values(FLOWCHART_PRESET_DEFINITIONS)) {
			const guides = (def.gdLst ?? []).map((g) => ({ name: g.name, formula: g.formula }));
			const vars = evaluateGuides(guides, { w: 200, h: 100 });
			for (const g of guides) {
				const value = vars.get(g.name);
				expect(Number.isFinite(value), `${def.name}/${g.name} evaluated to ${value}`).toBeTruthy();
			}
		}
	});

	it('all path coordinate tokens resolve cleanly against the guide context', () => {
		for (const def of Object.values(FLOWCHART_PRESET_DEFINITIONS)) {
			const guides = (def.gdLst ?? []).map((g) => ({ name: g.name, formula: g.formula }));
			const vars = evaluateGuides(guides, { w: 200, h: 100 });

			const resolve = (token: string): number => {
				const num = Number(token);
				if (Number.isFinite(num)) {
					return num;
				}
				if (token.includes(' ')) {
					return evaluateFormula(parseFormula(token), vars);
				}
				const v = vars.get(token);
				return v ?? Number.NaN;
			};

			for (const path of def.pathLst) {
				for (const cmd of path.commands) {
					switch (cmd.kind) {
						case 'moveTo':
						case 'lnTo': {
							expect(
								Number.isFinite(resolve(cmd.x)),
								`${def.name} ${cmd.kind}.x="${cmd.x}"`,
							).toBeTruthy();
							expect(
								Number.isFinite(resolve(cmd.y)),
								`${def.name} ${cmd.kind}.y="${cmd.y}"`,
							).toBeTruthy();
							break;
						}
						case 'arcTo': {
							expect(
								Number.isFinite(resolve(cmd.wR)),
								`${def.name} arcTo.wR="${cmd.wR}"`,
							).toBeTruthy();
							expect(
								Number.isFinite(resolve(cmd.hR)),
								`${def.name} arcTo.hR="${cmd.hR}"`,
							).toBeTruthy();
							expect(
								Number.isFinite(resolve(cmd.stAng)),
								`${def.name} arcTo.stAng="${cmd.stAng}"`,
							).toBeTruthy();
							expect(
								Number.isFinite(resolve(cmd.swAng)),
								`${def.name} arcTo.swAng="${cmd.swAng}"`,
							).toBeTruthy();
							break;
						}
						case 'cubicBezTo': {
							for (const t of [cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x3, cmd.y3]) {
								expect(
									Number.isFinite(resolve(t)),
									`${def.name} cubicBezTo token "${t}"`,
								).toBeTruthy();
							}
							break;
						}
						case 'quadBezTo': {
							for (const t of [cmd.x1, cmd.y1, cmd.x2, cmd.y2]) {
								expect(
									Number.isFinite(resolve(t)),
									`${def.name} quadBezTo token "${t}"`,
								).toBeTruthy();
							}
							break;
						}
						case 'close': {
							break;
						}
					}
				}
			}
		}
	});

	it('rect tokens (when present) all resolve to finite numbers', () => {
		for (const def of Object.values(FLOWCHART_PRESET_DEFINITIONS)) {
			if (!def.rect) {
				continue;
			}
			const guides = (def.gdLst ?? []).map((g) => ({ name: g.name, formula: g.formula }));
			const vars = evaluateGuides(guides, { w: 200, h: 100 });
			for (const key of ['l', 't', 'r', 'b'] as const) {
				const token = def.rect[key];
				const numLit = Number(token);
				const resolved = Number.isFinite(numLit)
					? numLit
					: token.includes(' ')
						? evaluateFormula(parseFormula(token), vars)
						: (vars.get(token) ?? Number.NaN);
				expect(Number.isFinite(resolved), `${def.name}.rect.${key}="${token}"`).toBeTruthy();
			}
		}
	});

	// Regression: explicit checks for a few representative shapes
	it('flowChartProcess is a plain rectangle path', () => {
		const def = FLOWCHART_PRESET_DEFINITIONS.flowChartProcess as PresetShapeGeometryDefinition;
		expect(def.gdLst).toBeUndefined();
		expect(def.pathLst).toHaveLength(1);
		expect(def.pathLst[0]?.commands).toHaveLength(5);
	});

	it('flowChartDocument has a wavy bottom built from a cubic Bezier', () => {
		const def = FLOWCHART_PRESET_DEFINITIONS.flowChartDocument as PresetShapeGeometryDefinition;
		const hasCubic = def.pathLst[0]?.commands.some((c) => c.kind === 'cubicBezTo');
		expect(hasCubic).toBeTruthy();
	});

	it('flowChartMultidocument has three sub-paths (three stacked documents)', () => {
		const def =
			FLOWCHART_PRESET_DEFINITIONS.flowChartMultidocument as PresetShapeGeometryDefinition;
		expect(def.pathLst).toHaveLength(3);
	});

	it('flowChartConnector is a circle (uses 4 arcTo commands)', () => {
		const def = FLOWCHART_PRESET_DEFINITIONS.flowChartConnector as PresetShapeGeometryDefinition;
		const arcs = def.pathLst[0]?.commands.filter((c) => c.kind === 'arcTo') ?? [];
		expect(arcs).toHaveLength(4);
	});

	it('flowChartOr has a circle plus a crosshair (2 extra moveTo segments)', () => {
		const def = FLOWCHART_PRESET_DEFINITIONS.flowChartOr as PresetShapeGeometryDefinition;
		const moves = def.pathLst[0]?.commands.filter((c) => c.kind === 'moveTo') ?? [];
		expect(moves.length).toBeGreaterThanOrEqual(3);
	});

	it('flowChartSummingJunction has a circle plus diagonal X overlay', () => {
		const def =
			FLOWCHART_PRESET_DEFINITIONS.flowChartSummingJunction as PresetShapeGeometryDefinition;
		const moves = def.pathLst[0]?.commands.filter((c) => c.kind === 'moveTo') ?? [];
		expect(moves.length).toBeGreaterThanOrEqual(3);
	});
});
