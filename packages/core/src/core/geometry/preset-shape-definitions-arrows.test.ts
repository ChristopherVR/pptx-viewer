/**
 * Structural tests for the arrow + 3-D primitive preset definitions batch.
 *
 * These tests validate the *shape* of every entry in
 * `ARROW_PRESET_DEFINITIONS` (name, non-empty pathLst, args mirror formula
 * tokens, formula operators are drawn from the canonical OOXML set) without
 * exercising the evaluator itself — that path is covered by
 * `preset-shape-evaluator.test.ts` once these entries are merged into the
 * master table.
 */

import { describe, expect, it } from 'vitest';

import { ARROW_PRESET_DEFINITIONS } from './preset-shape-definitions-arrows';

const REQUIRED_SHAPES = [
	// Containers / 3-D primitives
	'bevel',
	'can',
	'cube',
	'cylinder',
	'frame',
	'halfFrame',
	'plaque',
	'plaqueTabs',
	// Arrow variants
	'leftRightArrow',
	'upDownArrow',
	'leftRightUpArrow',
	'quadArrow',
	'bentArrow',
	'bentUpArrow',
	'uturnArrow',
	'stripedRightArrow',
	'notchedRightArrow',
	'homePlate',
	'chevron',
	'pentArrow',
	'circularArrow',
	'leftCircularArrow',
	'leftRightCircularArrow',
	'swooshArrow',
	'curvedRightArrow',
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

describe('preset shape arrow definitions', () => {
	it('contains every required shape (25 entries)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(ARROW_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(REQUIRED_SHAPES).toHaveLength(25);
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(ARROW_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('every shape has a non-empty pathLst with non-empty command arrays', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = ARROW_PRESET_DEFINITIONS[name];
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
		for (const def of Object.values(ARROW_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('every formula uses a known operator (numeric-literal first token also accepted)', () => {
		for (const def of Object.values(ARROW_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const op = g.formula.trim().split(/\s+/)[0] ?? '';
				const isNumericLiteral = Number.isFinite(Number(op));
				const isKnown = KNOWN_OPS.has(op) || isNumericLiteral;
				expect(isKnown, `${def.name}/${g.name}: unknown operator "${op}"`).toBeTruthy();
			}
		}
	});

	it('homePlate default adj is 50000 (canonical 5-sided arrow)', () => {
		expect(ARROW_PRESET_DEFINITIONS.homePlate?.avLst?.adj).toBe(50000);
	});

	it('chevron default adj is 50000', () => {
		expect(ARROW_PRESET_DEFINITIONS.chevron?.avLst?.adj).toBe(50000);
	});

	it('leftRightArrow / upDownArrow defaults are 50% body / 50% head per spec', () => {
		for (const name of ['leftRightArrow', 'upDownArrow'] as const) {
			expect(ARROW_PRESET_DEFINITIONS[name]?.avLst?.adj1).toBe(50000);
			expect(ARROW_PRESET_DEFINITIONS[name]?.avLst?.adj2).toBe(50000);
		}
	});

	it('quadArrow defaults to 22500 / 22500 / 22500', () => {
		expect(ARROW_PRESET_DEFINITIONS.quadArrow?.avLst?.adj1).toBe(22500);
		expect(ARROW_PRESET_DEFINITIONS.quadArrow?.avLst?.adj2).toBe(22500);
		expect(ARROW_PRESET_DEFINITIONS.quadArrow?.avLst?.adj3).toBe(22500);
	});

	it('bevel inset default is 12500 (1/8 of ss/2)', () => {
		expect(ARROW_PRESET_DEFINITIONS.bevel?.avLst?.adj).toBe(12500);
	});

	it('plaque default corner radius is 16667 (matches roundRect)', () => {
		expect(ARROW_PRESET_DEFINITIONS.plaque?.avLst?.adj).toBe(16667);
	});

	it('every shape exposes a rect (text bounds)', () => {
		for (const def of Object.values(ARROW_PRESET_DEFINITIONS)) {
			expect(def.rect, `${def.name} missing rect`).toBeDefined();
		}
	});
});
