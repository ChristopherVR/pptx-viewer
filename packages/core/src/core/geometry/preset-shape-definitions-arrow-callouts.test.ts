/**
 * Structural tests for the arrow-callout family preset definitions batch.
 *
 * These tests validate the *shape* of every entry in
 * `ARROW_CALLOUT_PRESET_DEFINITIONS` (name, non-empty pathLst, args mirror
 * formula tokens, formula operators are drawn from the canonical OOXML set)
 * without exercising the evaluator itself — that path is covered by
 * `preset-shape-evaluator.test.ts` once these entries are merged into the
 * master table.
 */

import { describe, expect, it } from 'vitest';

import { ARROW_CALLOUT_PRESET_DEFINITIONS } from './preset-shape-definitions-arrow-callouts';

const REQUIRED_SHAPES = [
	'leftArrowCallout',
	'rightArrowCallout',
	'upArrowCallout',
	'downArrowCallout',
	'leftRightArrowCallout',
	'upDownArrowCallout',
	'quadArrowCallout',
	'bentArrowCallout',
	'bentUpArrowCallout',
	'leftUpArrow',
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

describe('preset shape arrow-callout definitions', () => {
	it('contains every required shape (10 entries)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(ARROW_CALLOUT_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(REQUIRED_SHAPES).toHaveLength(10);
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(ARROW_CALLOUT_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('every shape has a non-empty pathLst with non-empty command arrays', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = ARROW_CALLOUT_PRESET_DEFINITIONS[name];
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
		for (const def of Object.values(ARROW_CALLOUT_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('every formula uses a known operator (numeric-literal first token also accepted)', () => {
		for (const def of Object.values(ARROW_CALLOUT_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const op = g.formula.trim().split(/\s+/)[0] ?? '';
				const isNumericLiteral = Number.isFinite(Number(op));
				const isKnown = KNOWN_OPS.has(op) || isNumericLiteral;
				expect(isKnown, `${def.name}/${g.name}: unknown operator "${op}"`).toBeTruthy();
			}
		}
	});

	it('every shape exposes a rect (text bounds)', () => {
		for (const def of Object.values(ARROW_CALLOUT_PRESET_DEFINITIONS)) {
			expect(def.rect, `${def.name} missing rect`).toBeDefined();
		}
	});

	it('single-direction callouts default to 25000 / 25000 / 25000 / 64977', () => {
		for (const name of [
			'leftArrowCallout',
			'rightArrowCallout',
			'upArrowCallout',
			'downArrowCallout',
		] as const) {
			const av = ARROW_CALLOUT_PRESET_DEFINITIONS[name]?.avLst;
			expect(av?.adj1).toBe(25000);
			expect(av?.adj2).toBe(25000);
			expect(av?.adj3).toBe(25000);
			expect(av?.adj4).toBe(64977);
		}
	});

	it('bidirectional callouts (leftRight/upDown) default to 25000 / 25000 / 25000 / 48123', () => {
		for (const name of ['leftRightArrowCallout', 'upDownArrowCallout'] as const) {
			const av = ARROW_CALLOUT_PRESET_DEFINITIONS[name]?.avLst;
			expect(av?.adj1).toBe(25000);
			expect(av?.adj2).toBe(25000);
			expect(av?.adj3).toBe(25000);
			expect(av?.adj4).toBe(48123);
		}
	});

	it('quadArrowCallout defaults to 18515 across head/shaft/length and 48123 for callout body', () => {
		const av = ARROW_CALLOUT_PRESET_DEFINITIONS.quadArrowCallout?.avLst;
		expect(av?.adj1).toBe(18515);
		expect(av?.adj2).toBe(18515);
		expect(av?.adj3).toBe(18515);
		expect(av?.adj4).toBe(48123);
	});

	it('leftUpArrow has 3 adjustments defaulting to 25000', () => {
		const av = ARROW_CALLOUT_PRESET_DEFINITIONS.leftUpArrow?.avLst;
		expect(av?.adj1).toBe(25000);
		expect(av?.adj2).toBe(25000);
		expect(av?.adj3).toBe(25000);
		// adj4 should be undefined for the 3-adjust shape.
		expect(av?.adj4).toBeUndefined();
	});
});
