/**
 * Structural tests for the curved-arrows + bent-connectors preset definitions
 * batch.
 *
 * These tests validate the *shape* of every entry in
 * `CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS` (name, non-empty pathLst,
 * args mirror formula tokens, formula operators are drawn from the canonical
 * OOXML set, connectors are stroke-only) without exercising the evaluator
 * itself — that path is covered by `preset-shape-evaluator.test.ts` once
 * these entries are merged into the master table.
 */

import { describe, expect, it } from 'vitest';

import { CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS } from './preset-shape-definitions-curved-arrows-connectors';

const REQUIRED_SHAPES = [
	// Lines
	'line',
	'lineInv',
	// Connectors
	'straightConnector1',
	'bentConnector2',
	'bentConnector3',
	'bentConnector4',
	'bentConnector5',
] as const;

const CONNECTOR_AND_LINE_SHAPES = [
	'line',
	'lineInv',
	'straightConnector1',
	'bentConnector2',
	'bentConnector3',
	'bentConnector4',
	'bentConnector5',
] as const;

/**
 * Operators recognised by `evaluateFormula` in `guide-formula-eval.ts`. Any
 * formula whose first token isn't on this list (and isn't a numeric literal)
 * would silently degrade to `0` at runtime, so we fail loud here.
 */
const KNOWN_OPS = new Set([
	'val',
	'abs',
	'sqrt',
	'+-',
	'*/',
	'+/',
	'?:',
	'if',
	'min',
	'max',
	'mod',
	'pin',
	'sin',
	'cos',
	'tan',
	'atan',
	'at2',
	'atan2',
	'cat2',
	'sat2',
]);

describe('preset shape line + connector definitions', () => {
	it('contains every required shape (7 entries)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(
				CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS[name],
				`missing preset ${name}`,
			).toBeDefined();
		}
		expect(REQUIRED_SHAPES).toHaveLength(7);
		expect(Object.keys(CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS)).toHaveLength(7);
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('every shape has a non-empty pathLst with non-empty command arrays', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			if (!def) {
				continue;
			}
			expect(def.pathLst.length, `${name} pathLst empty`).toBeGreaterThan(0);
			for (const path of def.pathLst) {
				expect(path.commands.length, `${name} command list empty`).toBeGreaterThan(0);
			}
		}
	});

	it('gd args mirror formula tokens minus the operator', () => {
		for (const def of Object.values(CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('every formula uses a known operator (numeric-literal first token also accepted)', () => {
		for (const def of Object.values(CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const op = g.formula.trim().split(/\s+/)[0] ?? '';
				const isNumericLiteral = Number.isFinite(Number(op));
				const isKnown = KNOWN_OPS.has(op) || isNumericLiteral;
				expect(isKnown, `${def.name}/${g.name}: unknown operator "${op}"`).toBeTruthy();
			}
		}
	});

	it('every shape exposes a rect (text bounds)', () => {
		for (const def of Object.values(CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS)) {
			expect(def.rect, `${def.name} missing rect`).toBeDefined();
		}
	});

	// -------------------------------------------------------------------------
	// Connector / line invariants
	// -------------------------------------------------------------------------

	it('connectors and lines are stroke-only (fill: none, stroke: true)', () => {
		for (const name of CONNECTOR_AND_LINE_SHAPES) {
			const def = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			for (const path of def?.pathLst ?? []) {
				expect(path.fill, `${name}: fill should be 'none'`).toBe('none');
				expect(path.stroke, `${name}: stroke should be true`).toBeTruthy();
			}
		}
	});

	it('connectors and lines have no closed sub-paths (open polylines only)', () => {
		for (const name of CONNECTOR_AND_LINE_SHAPES) {
			const def = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			for (const path of def?.pathLst ?? []) {
				const hasClose = path.commands.some((c) => c.kind === 'close');
				expect(hasClose, `${name}: connector polyline must not be closed`).toBeFalsy();
			}
		}
	});

	// -------------------------------------------------------------------------
	// Connector adjustment counts (per spec §20.1.9.11–14)
	// -------------------------------------------------------------------------

	it('bentConnector2 has no adjustments', () => {
		expect(CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector2?.avLst).toBeUndefined();
	});

	it('bentConnector3 has 1 adjustment defaulting to 50000', () => {
		const av = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector3?.avLst;
		expect(av).toBeDefined();
		expect(Object.keys(av ?? {})).toStrictEqual(['adj1']);
		expect(av?.adj1).toBe(50000);
	});

	it('bentConnector4 has 2 adjustments defaulting to 50000 / 50000', () => {
		const av = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector4?.avLst;
		expect(av).toBeDefined();
		expect(Object.keys(av ?? {}).sort()).toStrictEqual(['adj1', 'adj2']);
		expect(av?.adj1).toBe(50000);
		expect(av?.adj2).toBe(50000);
	});

	it('bentConnector5 has 3 adjustments defaulting to 50000 / 50000 / 50000', () => {
		const av = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector5?.avLst;
		expect(av).toBeDefined();
		expect(Object.keys(av ?? {}).sort()).toStrictEqual(['adj1', 'adj2', 'adj3']);
		expect(av?.adj1).toBe(50000);
		expect(av?.adj2).toBe(50000);
		expect(av?.adj3).toBe(50000);
	});

	// -------------------------------------------------------------------------
	// Connector segment counts (moveTo + lnTo total)
	// -------------------------------------------------------------------------

	it('connector segment counts match their preset names', () => {
		// straightConnector1 / line / lineInv: 1 moveTo + 1 lnTo = 2 commands.
		for (const name of ['straightConnector1', 'line', 'lineInv'] as const) {
			const def = CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS[name];
			expect(def?.pathLst[0]?.commands).toHaveLength(2);
		}
		// bentConnector2: 2 segments → 1 moveTo + 2 lnTo = 3 commands.
		expect(
			CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector2?.pathLst[0]?.commands,
		).toHaveLength(3);
		// bentConnector3: 3 segments → 1 moveTo + 3 lnTo = 4 commands.
		expect(
			CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector3?.pathLst[0]?.commands,
		).toHaveLength(4);
		// bentConnector4: 4 segments → 1 moveTo + 4 lnTo = 5 commands.
		expect(
			CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector4?.pathLst[0]?.commands,
		).toHaveLength(5);
		// bentConnector5: 5 segments → 1 moveTo + 5 lnTo = 6 commands.
		expect(
			CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS.bentConnector5?.pathLst[0]?.commands,
		).toHaveLength(6);
	});
});
