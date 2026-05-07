import { describe, expect, it } from 'vitest';

import { MISC_PRESET_DEFINITIONS } from './preset-shape-definitions-misc';

const REQUIRED_SHAPES = [
	// Stars
	'star6',
	'star7',
	'star8',
	'star10',
	'star12',
	'star16',
	'star24',
	'star32',
	// Ribbons
	'ribbon',
	'ribbon2',
	'ellipseRibbon',
	'ellipseRibbon2',
	'leftRightRibbon',
	// Callouts
	'callout1',
	'callout2',
	'callout3',
	'borderCallout1',
	'borderCallout2',
	'borderCallout3',
	// Decorations
	'cloud',
	'smileyFace',
	'lightningBolt',
	'sun',
	'moon',
	// Math
	'mathPlus',
	'mathMinus',
	'mathMultiply',
	'mathDivide',
	'mathEqual',
	'mathNotEqual',
	// Heart + seals
	'heart',
	'irregularSeal1',
	'irregularSeal2',
] as const;

describe('preset shape geometry — misc shapes', () => {
	it('contains every required misc preset (33 shapes)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(MISC_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(REQUIRED_SHAPES.length).toBeGreaterThanOrEqual(30);
	});

	it('every shape has at least one path with at least one command', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = MISC_PRESET_DEFINITIONS[name];
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
		for (const [key, def] of Object.entries(MISC_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('gd args length mirrors formula tokens minus the operator', () => {
		for (const def of Object.values(MISC_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('star definitions place 2N vertices (outer tips + inner valleys)', () => {
		const counts: Record<string, number> = {
			star6: 12,
			star7: 14,
			star8: 16,
			star10: 20,
			star12: 24,
			star16: 32,
			star24: 48,
			star32: 64,
		};
		for (const [name, expected] of Object.entries(counts)) {
			const def = MISC_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			if (!def) {
				continue;
			}
			const path = def.pathLst[0];
			expect(path).toBeDefined();
			if (!path) {
				continue;
			}
			// commands: 1 moveTo + (2N - 1) lnTo + 1 close = 2N + 1 entries.
			expect(path.commands).toHaveLength(expected + 1);
		}
	});

	it('callouts include a leader-line stroke path with no fill', () => {
		for (const name of [
			'callout1',
			'callout2',
			'callout3',
			'borderCallout1',
			'borderCallout2',
			'borderCallout3',
		] as const) {
			const def = MISC_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			if (!def) {
				continue;
			}
			// Last path is the leader line.
			const leader = def.pathLst[def.pathLst.length - 1];
			expect(leader).toBeDefined();
			if (!leader) {
				continue;
			}
			expect(leader?.stroke).toBeTruthy();
			expect(leader?.fill).toBe('none');
		}
	});

	it('ribbon defaults match ECMA-376 (adj1=16667, adj2=50000)', () => {
		for (const name of ['ribbon', 'ribbon2'] as const) {
			const def = MISC_PRESET_DEFINITIONS[name];
			expect(def?.avLst?.adj1).toBe(16667);
			expect(def?.avLst?.adj2).toBe(50000);
		}
	});

	it('math symbols default adj1 to 23520 (canonical thickness)', () => {
		for (const name of [
			'mathPlus',
			'mathMinus',
			'mathMultiply',
			'mathDivide',
			'mathEqual',
			'mathNotEqual',
		] as const) {
			const def = MISC_PRESET_DEFINITIONS[name];
			expect(def?.avLst?.adj1).toBe(23520);
		}
	});

	it('irregularSeal polygons have the spec-mandated vertex counts', () => {
		const seal1 = MISC_PRESET_DEFINITIONS.irregularSeal1;
		const seal2 = MISC_PRESET_DEFINITIONS.irregularSeal2;
		expect(seal1).toBeDefined();
		expect(seal2).toBeDefined();
		// 24 / 28 vertices + close
		expect(seal1?.pathLst[0]?.commands.length).toBe(24 + 1);
		expect(seal2?.pathLst[0]?.commands.length).toBe(28 + 1);
	});
});
