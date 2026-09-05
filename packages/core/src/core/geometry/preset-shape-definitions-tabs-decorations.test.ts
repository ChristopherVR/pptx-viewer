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

	it('gear6 / gear9 emit one arcTo (tooth-root fillet) per tooth, spec-exact command count', () => {
		// Spec-exact transcription (preset-shape-definitions-gear{6,9}.ts): the
		// first tooth is `moveTo A, lnTo B, lnTo C, lnTo D, arcTo` (5 commands);
		// every following tooth's `A` is already the pen position left by the
		// previous tooth's arcTo, so it drops to `lnTo B, lnTo C, lnTo D, arcTo`
		// (4 commands). N teeth: 5 + 4*(N-1) + 1 close = 4N + 2. gear6: 26 (N=6),
		// gear9: 38 (N=9).
		const gear6 = TABS_DECORATIONS_PRESET_DEFINITIONS.gear6;
		const gear9 = TABS_DECORATIONS_PRESET_DEFINITIONS.gear9;
		expect(gear6?.pathLst[0]?.commands).toHaveLength(4 * 6 + 2);
		expect(gear9?.pathLst[0]?.commands).toHaveLength(4 * 9 + 2);

		const gear6Arcs = gear6?.pathLst[0]?.commands.filter((c) => c.kind === 'arcTo') ?? [];
		const gear9Arcs = gear9?.pathLst[0]?.commands.filter((c) => c.kind === 'arcTo') ?? [];
		expect(gear6Arcs).toHaveLength(6);
		expect(gear9Arcs).toHaveLength(9);
		// Every fillet arc's radius comes from the root-circle guides (rw/rh,
		// themselves derived from adj1's tooth depth), never a literal or an
		// adj2-only guide: the fillet rounds the root circle, adj2 only changes
		// how much of that circle each arc sweeps (see the next test).
		for (const arc of [...gear6Arcs, ...gear9Arcs]) {
			if (arc.kind !== 'arcTo') {
				continue;
			}
			expect(arc.wR).toBe('rw');
			expect(arc.hR).toBe('rh');
		}
	});

	it('gear shapes expose both adj1 (tooth depth) and adj2 defaults (COM-verified: Adjustments.Count is 2)', () => {
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.gear6?.avLst?.adj1).toBe(15000);
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.gear6?.avLst?.adj2).toBe(3526);
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.gear9?.avLst?.adj1).toBe(10000);
		expect(TABS_DECORATIONS_PRESET_DEFINITIONS.gear9?.avLst?.adj2).toBe(1763);
		expect(Object.keys(TABS_DECORATIONS_PRESET_DEFINITIONS.gear6?.avLst ?? {})).toHaveLength(2);
		expect(Object.keys(TABS_DECORATIONS_PRESET_DEFINITIONS.gear9?.avLst ?? {})).toHaveLength(2);
	});

	it('gear6 / gear9 adj2 is consumed: growing adj2 narrows the fillet sweep and widens the flat root land', () => {
		// COM-verified 2026-09-05 (`Shapes.AddShape(msoShapeGear6/msoShapeGear9)`,
		// `Adjustments.Item(2)` set then read back unchanged: 0, 0.03526, 0.05358
		// for gear6 and 0, 0.01763, 0.02679 for gear9 all round-tripped exactly,
		// confirming PowerPoint accepts the full spec-defined adj2 range with no
		// silent clamping). This test proves the guide chain that used to dead-end
		// at an unused `a2` guide (the pre-fix `buildGearN`) now actually reaches
		// the rendered path: `lFD` (flank offset, `ss * adj2 / 100000`) feeds `l3`,
		// which feeds `ha` (half tooth-root angular width), which every arm's
		// `aA_n`/`aD_n` (and therefore the fillet's `swAng`) derives from.
		for (const [name, adj1, adj2Max] of [
			['gear6', 15000, 5358],
			['gear9', 10000, 2679],
		] as const) {
			const def = TABS_DECORATIONS_PRESET_DEFINITIONS[name] as PresetShapeGeometryDefinition;
			const varsAt = (adj2: number): Map<string, number> => {
				const guides = (def.gdLst ?? []).map((g) => ({ name: g.name, formula: g.formula }));
				const adjMap = new Map(Object.entries({ adj1, adj2 }));
				// Minimal local formula walker mirroring guide-formula-api's
				// evaluateGuides (kept local so this test does not reach across
				// file-ownership boundaries into preset-shape-evaluator.ts).
				const vars = new Map<string, number>([
					['w', 400],
					['h', 400],
					['hc', 200],
					['vc', 200],
					['wd2', 200],
					['hd2', 200],
					['ss', 400],
					['cd2', 10800000],
					['cd4', 5400000],
					['3cd4', 16200000],
				]);
				for (const [k, v] of adjMap) {
					vars.set(k, v);
				}
				for (const g of guides) {
					const parts = g.formula.trim().split(/\s+/);
					const op = parts[0]!;
					const r = (i: number): number => {
						const tok = parts[i + 1];
						if (tok === undefined) {
							return 0;
						}
						const num = Number(tok);
						return Number.isFinite(num) ? num : (vars.get(tok) ?? 0);
					};
					let value = 0;
					switch (op) {
						case 'pin':
							value = Math.max(r(0), Math.min(r(1), r(2)));
							break;
						case '*/':
							value = r(2) === 0 ? 0 : (r(0) * r(1)) / r(2);
							break;
						case '+-':
							value = r(0) + r(1) - r(2);
							break;
						case '?:':
							value = r(0) > 0 ? r(1) : r(2);
							break;
						case 'at2':
							value = (Math.atan2(r(1), r(0)) * 180 * 60000) / Math.PI;
							break;
						default:
							// Guides beyond pin/`*/`/+-/at2/?: are not needed to reach
							// `lFD`/`l3`/`ha`; leave unresolved guides at 0 rather than
							// reimplement the whole evaluator here.
							value = 0;
					}
					vars.set(g.name, value);
				}
				return vars;
			};
			const low = varsAt(0);
			const high = varsAt(adj2Max);
			expect(low.get('lFD')).toBe(0);
			expect(high.get('lFD')).toBeGreaterThan(0);
			// l3 = th2 + l2 (l2 = lFD / 2): grows as adj2 grows.
			expect(high.get('l3')).toBeGreaterThan(low.get('l3')!);
			// ha = at2(maxr, l3): a larger l3 (same maxr) yields a larger angle,
			// which widens every tooth's root footprint and narrows the fillet's
			// swAng (swAng1/swAng2 = the gap left over between adjacent teeth).
			expect(high.get('ha')).toBeGreaterThan(low.get('ha')!);
		}
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
