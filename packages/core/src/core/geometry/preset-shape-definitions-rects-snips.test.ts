import { describe, expect, it } from 'vitest';

import { RECTS_SNIPS_PRESET_DEFINITIONS } from './preset-shape-definitions-rects-snips';

const REQUIRED_SHAPES = [
	'round1Rect',
	'round2SameRect',
	'round2DiagRect',
	'snipRoundRect',
	'snip1Rect',
	'snip2SameRect',
	'snip2DiagRect',
	'foldedCorner',
	'teardrop',
	'corner',
] as const;

describe('preset shape geometry — rects/snips/foldedCorner/teardrop/corner', () => {
	it('contains every required preset (10 shapes)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(RECTS_SNIPS_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(Object.keys(RECTS_SNIPS_PRESET_DEFINITIONS)).toHaveLength(REQUIRED_SHAPES.length);
	});

	it('every shape has at least one path with at least one command', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = RECTS_SNIPS_PRESET_DEFINITIONS[name];
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
		for (const [key, def] of Object.entries(RECTS_SNIPS_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('gd args length mirrors formula tokens minus the operator', () => {
		for (const def of Object.values(RECTS_SNIPS_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('single-adj rects expose adj default 16667 (canonical)', () => {
		for (const name of ['round1Rect', 'snip1Rect', 'foldedCorner'] as const) {
			expect(RECTS_SNIPS_PRESET_DEFINITIONS[name]?.avLst?.adj).toBe(16667);
		}
	});

	it('two-adj rects declare both adj1 and adj2', () => {
		for (const name of [
			'round2SameRect',
			'round2DiagRect',
			'snipRoundRect',
			'snip2SameRect',
			'snip2DiagRect',
			'corner',
		] as const) {
			const av = RECTS_SNIPS_PRESET_DEFINITIONS[name]?.avLst;
			expect(av).toBeDefined();
			expect(av?.adj1).toBeGreaterThanOrEqual(0);
			expect(av?.adj2).toBeGreaterThanOrEqual(0);
		}
	});

	it('teardrop default adj is 100000 (nominal point)', () => {
		expect(RECTS_SNIPS_PRESET_DEFINITIONS.teardrop?.avLst?.adj).toBe(100000);
	});

	it('foldedCorner emits 3 paths (body, flap, stroke)', () => {
		const def = RECTS_SNIPS_PRESET_DEFINITIONS.foldedCorner;
		expect(def?.pathLst).toHaveLength(3);
	});

	it('every path command uses a known kind', () => {
		const known = new Set(['moveTo', 'lnTo', 'arcTo', 'quadBezTo', 'cubicBezTo', 'close']);
		for (const def of Object.values(RECTS_SNIPS_PRESET_DEFINITIONS)) {
			for (const path of def.pathLst) {
				for (const cmd of path.commands) {
					expect(known.has(cmd.kind), `${def.name}: unknown kind ${cmd.kind}`).toBeTruthy();
				}
			}
		}
	});

	it('every path closes (last cmd is close, where applicable)', () => {
		// All shapes here are filled silhouettes — every path should end with close.
		for (const def of Object.values(RECTS_SNIPS_PRESET_DEFINITIONS)) {
			for (const path of def.pathLst) {
				if (path.fill === 'none' && path.stroke) {
					// stroke-only paths may end without close — skip
					continue;
				}
				const last = path.commands[path.commands.length - 1];
				expect(last?.kind, `${def.name} path does not close`).toBe('close');
			}
		}
	});
});
