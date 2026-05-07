import { describe, expect, it } from 'vitest';

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';
import { TABS_DECORATIONS_PRESET_DEFINITIONS } from './preset-shape-definitions-tabs-decorations';

const REQUIRED_SHAPES = [
	'cornerTabs',
	'squareTabs',
	'diamondTabs',
	'diagStripe',
	'plus',
	'gear6',
	'gear9',
	'funnel',
	'mathFunction',
	'nonIsoscelesTrapezoid',
] as const;

describe('preset shape geometry — tabs / gears / decorations', () => {
	it('contains every required preset (10 shapes)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(TABS_DECORATIONS_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(REQUIRED_SHAPES).toHaveLength(10);
		expect(Object.keys(TABS_DECORATIONS_PRESET_DEFINITIONS)).toHaveLength(10);
	});

	it('every shape exposes at least one path with at least one command', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = TABS_DECORATIONS_PRESET_DEFINITIONS[name] as PresetShapeGeometryDefinition;
			expect(def.pathLst.length, `${name} pathLst empty`).toBeGreaterThan(0);
			for (const path of def.pathLst) {
				expect(path.commands.length, `${name} command list empty`).toBeGreaterThan(0);
			}
		}
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(TABS_DECORATIONS_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('gd args length mirrors formula tokens minus the operator', () => {
		for (const def of Object.values(TABS_DECORATIONS_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('tab shapes (cornerTabs, squareTabs, diamondTabs) declare no avLst', () => {
		for (const name of ['cornerTabs', 'squareTabs', 'diamondTabs'] as const) {
			const def = TABS_DECORATIONS_PRESET_DEFINITIONS[name];
			expect(def?.avLst).toBeUndefined();
		}
	});

	it('cornerTabs has 5 sub-paths (frame + 4 corner tabs)', () => {
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.cornerTabs?.pathLst).toHaveLength(5);
	});

	it('squareTabs has 5 sub-paths (frame + 4 side tabs)', () => {
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.squareTabs?.pathLst).toHaveLength(5);
	});

	it('diamondTabs has 5 sub-paths (diamond body + 4 tip tabs)', () => {
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.diamondTabs?.pathLst).toHaveLength(5);
	});

	it('diagStripe exposes adj=50000 default', () => {
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.diagStripe?.avLst?.adj).toBe(50000);
	});

	it('plus exposes adj=25000 default and a 12-vertex polygon', () => {
		const def = TABS_DECORATIONS_PRESET_DEFINITIONS.plus;
		expect(def?.avLst?.adj).toBe(25000);
		// 12 vertices + close = 13 commands.
		expect(def?.pathLst[0]?.commands).toHaveLength(13);
	});

	it('gear6 / gear9 expose 4N + 2 vertices each (4 vertices per tooth)', () => {
		// commands: 1 moveTo + (4N - 1) lnTo + 1 close = 4N + 1
		const gear6 = TABS_DECORATIONS_PRESET_DEFINITIONS.gear6;
		const gear9 = TABS_DECORATIONS_PRESET_DEFINITIONS.gear9;
		expect(gear6?.pathLst[0]?.commands).toHaveLength(6 * 4 + 1);
		expect(gear9?.pathLst[0]?.commands).toHaveLength(9 * 4 + 1);
	});

	it('gear shapes expose tooth-depth adj defaults', () => {
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.gear6?.avLst?.adj).toBe(15000);
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.gear9?.avLst?.adj).toBe(10000);
	});

	it('funnel has no avLst and exposes a closed V silhouette', () => {
		const def = TABS_DECORATIONS_PRESET_DEFINITIONS.funnel;
		expect(def?.avLst).toBeUndefined();
		expect(def?.pathLst[0]?.commands.at(-1)?.kind).toBe('close');
	});

	it('mathFunction emits a default-only polygon (SIMPLIFIED — no avLst)', () => {
		const def = TABS_DECORATIONS_PRESET_DEFINITIONS.mathFunction;
		expect(def?.avLst).toBeUndefined();
		expect(def?.pathLst[0]?.commands.length).toBeGreaterThan(4);
	});

	it('nonIsoscelesTrapezoid exposes an adj1 (default 50000)', () => {
		const def = TABS_DECORATIONS_PRESET_DEFINITIONS.nonIsoscelesTrapezoid;
		expect(def?.avLst?.adj).toBe(50000);
		// 4 vertices + close.
		expect(def?.pathLst[0]?.commands).toHaveLength(5);
	});
});
