import { describe, expect, it } from 'vitest';

import { SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS } from './preset-shape-definitions-scrolls-accent-callouts';

const REQUIRED_SHAPES = [
	'verticalScroll',
	'horizontalScroll',
	'wave',
	'doubleWave',
	'accentCallout1',
	'accentCallout2',
	'accentCallout3',
	'accentBorderCallout1',
	'accentBorderCallout2',
	'accentBorderCallout3',
] as const;

describe('preset shape geometry — scrolls / waves + accent callouts', () => {
	it('contains every required shape (10)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(
				SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name],
				`missing preset ${name}`,
			).toBeDefined();
		}
		expect(Object.keys(SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS)).toHaveLength(10);
	});

	it('every shape has at least one path with at least one command', () => {
		for (const def of Object.values(SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS)) {
			expect(def.pathLst.length, `${def.name} pathLst empty`).toBeGreaterThan(0);
			for (const path of def.pathLst) {
				expect(path.commands.length, `${def.name} command list empty`).toBeGreaterThan(0);
			}
		}
	});

	it('shape names match their dictionary keys', () => {
		for (const [key, def] of Object.entries(SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('gd args length mirrors formula tokens minus the operator', () => {
		for (const def of Object.values(SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('scrolls expose a single `adj` defaulting to 12500', () => {
		for (const name of ['verticalScroll', 'horizontalScroll'] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			expect(def?.avLst?.adj).toBe(12500);
			// Single-adjust shapes only declare `adj`.
			expect(Object.keys(def?.avLst ?? {})).toStrictEqual(['adj']);
		}
	});

	it('waves expose two adjusts (adj1 = amplitude, adj2 = phase)', () => {
		const wave = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS.wave;
		expect(wave?.avLst?.adj1).toBe(12500);
		expect(wave?.avLst?.adj2).toBe(0);
		const doubleWave = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS.doubleWave;
		expect(doubleWave?.avLst?.adj1).toBe(6250);
		expect(doubleWave?.avLst?.adj2).toBe(0);
	});

	it('wave outlines use cubic beziers for the curved edges', () => {
		for (const name of ['wave', 'doubleWave'] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			const path = def?.pathLst[0];
			expect(path).toBeDefined();
			if (!path) {
				continue;
			}
			const beziers = path.commands.filter((c) => c.kind === 'cubicBezTo');
			// wave: 2 (top + bottom); doubleWave: 4 (two halves on top + bottom).
			expect(beziers).toHaveLength(name === 'wave' ? 2 : 4);
		}
	});

	it('accent callouts emit a stroke-only accent bar AND a leader-line path', () => {
		for (const name of [
			'accentCallout1',
			'accentCallout2',
			'accentCallout3',
			'accentBorderCallout1',
			'accentBorderCallout2',
			'accentBorderCallout3',
		] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			expect(def, `missing ${name}`).toBeDefined();
			if (!def) {
				continue;
			}
			// Body + accent bar + leader line = 3 sub-paths exactly.
			expect(def.pathLst, `${name} should have body+accent+leader`).toHaveLength(3);
			const accentBar = def.pathLst[1];
			const leader = def.pathLst[2];
			expect(accentBar?.stroke).toBeTruthy();
			expect(accentBar?.fill).toBe('none');
			expect(leader?.stroke).toBeTruthy();
			expect(leader?.fill).toBe('none');
		}
	});

	it('accentBorderCallout bodies are stroked (border variant marker)', () => {
		for (const name of [
			'accentBorderCallout1',
			'accentBorderCallout2',
			'accentBorderCallout3',
		] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			expect(def?.pathLst[0]?.stroke).toBeTruthy();
		}
	});

	it('accentCallout (non-border) bodies are NOT stroked', () => {
		for (const name of ['accentCallout1', 'accentCallout2', 'accentCallout3'] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			expect(def?.pathLst[0]?.stroke).toBeFalsy();
		}
	});

	it('accent callouts share canonical avLst defaults with their plain-callout siblings', () => {
		// adj1=18750, adj2=-8333 are the shared first-pair defaults across every
		// callout flavour in ECMA-376.
		for (const name of [
			'accentCallout1',
			'accentCallout2',
			'accentCallout3',
			'accentBorderCallout1',
			'accentBorderCallout2',
			'accentBorderCallout3',
		] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			expect(def?.avLst?.adj1).toBe(18750);
			expect(def?.avLst?.adj2).toBe(-8333);
		}
	});

	it('scroll outlines include arcTo commands for the rolled corners', () => {
		for (const name of ['verticalScroll', 'horizontalScroll'] as const) {
			const def = SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS[name];
			const arcs = def?.pathLst[0]?.commands.filter((c) => c.kind === 'arcTo') ?? [];
			expect(arcs.length, `${name} should have rolled-corner arcs`).toBeGreaterThan(0);
		}
	});
});
