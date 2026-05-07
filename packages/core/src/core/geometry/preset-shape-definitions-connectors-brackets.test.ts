import { describe, expect, it } from 'vitest';

import { CONNECTORS_BRACKETS_PRESET_DEFINITIONS } from './preset-shape-definitions-connectors-brackets';

const REQUIRED_SHAPES = [
	'curvedConnector2',
	'curvedConnector3',
	'curvedConnector4',
	'curvedConnector5',
	'leftBracket',
	'rightBracket',
	'leftBrace',
	'rightBrace',
	'bracketPair',
	'bracePair',
] as const;

const CONNECTOR_SHAPES = [
	'curvedConnector2',
	'curvedConnector3',
	'curvedConnector4',
	'curvedConnector5',
] as const;

const BRACKET_SHAPES = [
	'leftBracket',
	'rightBracket',
	'leftBrace',
	'rightBrace',
	'bracketPair',
	'bracePair',
] as const;

describe('preset shape geometry — curved connectors + brackets/braces', () => {
	it('contains every required preset (10 shapes)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(Object.keys(CONNECTORS_BRACKETS_PRESET_DEFINITIONS)).toHaveLength(10);
	});

	it('every shape has at least one path with at least one command', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
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

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(CONNECTORS_BRACKETS_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('gd args length mirrors formula tokens minus the operator', () => {
		for (const def of Object.values(CONNECTORS_BRACKETS_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('connectors are stroke-only (no fill)', () => {
		for (const name of CONNECTOR_SHAPES) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			if (!def) {
				continue;
			}
			for (const path of def.pathLst) {
				expect(path.fill, `${name} should be unfilled`).toBe('none');
				expect(path.stroke, `${name} should be stroked`).toBeTruthy();
			}
		}
	});

	it('connectors begin with a moveTo from the top-left corner', () => {
		for (const name of CONNECTOR_SHAPES) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			const first = def?.pathLst[0]?.commands[0];
			expect(first?.kind).toBe('moveTo');
			if (first?.kind === 'moveTo') {
				expect(first.x).toBe('l');
				expect(first.y).toBe('t');
			}
		}
	});

	it('connectors expose the documented adjustment count', () => {
		const expectedAdjustments: Record<string, number> = {
			curvedConnector2: 0,
			curvedConnector3: 1,
			curvedConnector4: 2,
			curvedConnector5: 3,
		};
		for (const [name, count] of Object.entries(expectedAdjustments)) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			const av = def?.avLst ?? {};
			expect(Object.keys(av), `${name} avLst size`).toHaveLength(count);
		}
	});

	it('curvedConnectorN uses N cubic bezier segments', () => {
		const expected: Record<string, number> = {
			curvedConnector2: 1,
			curvedConnector3: 2,
			curvedConnector4: 3,
			curvedConnector5: 4,
		};
		for (const [name, n] of Object.entries(expected)) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			const beziers = def?.pathLst[0]?.commands.filter((c) => c.kind === 'cubicBezTo').length ?? 0;
			expect(beziers, `${name} bezier count`).toBe(n);
		}
	});

	it('brackets and braces are closed/stroked outlines (not connectors)', () => {
		for (const name of BRACKET_SHAPES) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			// Stroke must be true on at least one path.
			const anyStroked = def?.pathLst.some((p) => p.stroke === true) ?? false;
			expect(anyStroked, `${name} should be strokeable`).toBeTruthy();
			// Fill must NOT be 'none' on any sub-path (these are filled outlines).
			for (const path of def?.pathLst ?? []) {
				expect(path.fill, `${name} should not be unfilled`).not.toBe('none');
			}
		}
	});

	it('leftBracket/rightBracket expose a single corner-radius adjustment', () => {
		for (const name of ['leftBracket', 'rightBracket'] as const) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			expect(def?.avLst).toBeDefined();
			expect(Object.keys(def?.avLst ?? {})).toHaveLength(1);
		}
	});

	it('leftBrace/rightBrace expose two adjustments (radius + middle position)', () => {
		for (const name of ['leftBrace', 'rightBrace'] as const) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			expect(def?.avLst).toBeDefined();
			expect(Object.keys(def?.avLst ?? {})).toHaveLength(2);
		}
	});

	it('bracketPair / bracePair expose a single shared corner-radius adjustment', () => {
		for (const name of ['bracketPair', 'bracePair'] as const) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			expect(def?.avLst).toBeDefined();
			expect(Object.keys(def?.avLst ?? {})).toHaveLength(1);
		}
	});

	it('bracketPair / bracePair contain at least two moveTo commands (one per half)', () => {
		for (const name of ['bracketPair', 'bracePair'] as const) {
			const def = CONNECTORS_BRACKETS_PRESET_DEFINITIONS[name];
			const moves = def?.pathLst[0]?.commands.filter((c) => c.kind === 'moveTo').length ?? 0;
			expect(moves, `${name} should have two halves`).toBeGreaterThanOrEqual(2);
		}
	});
});
