import { describe, expect, it } from 'vitest';

import { ACTION_BUTTON_PRESET_DEFINITIONS } from './preset-shape-definitions-action-buttons';

// Tests for the 12 ECMA-376 actionButton* preset geometries. All twelve
// share an identical beveled-rectangle shape; the differentiating glyph is
// rendered separately by the React layer (`ActionButtonGlyphOverlay`).

const REQUIRED_SHAPES = [
	'actionButtonBlank',
	'actionButtonHome',
	'actionButtonHelp',
	'actionButtonInformation',
	'actionButtonForwardNext',
	'actionButtonBackPrevious',
	'actionButtonEnd',
	'actionButtonBeginning',
	'actionButtonReturn',
	'actionButtonDocument',
	'actionButtonSound',
	'actionButtonMovie',
] as const;

describe('preset shape geometry — action buttons', () => {
	it('contains every required actionButton preset (12 shapes)', () => {
		for (const name of REQUIRED_SHAPES) {
			expect(ACTION_BUTTON_PRESET_DEFINITIONS[name], `missing preset ${name}`).toBeDefined();
		}
		expect(Object.keys(ACTION_BUTTON_PRESET_DEFINITIONS)).toHaveLength(12);
	});

	it('every shape has at least one path with at least one command', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = ACTION_BUTTON_PRESET_DEFINITIONS[name];
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
		for (const [key, def] of Object.entries(ACTION_BUTTON_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
		}
	});

	it('gd args length mirrors formula tokens minus the operator', () => {
		for (const def of Object.values(ACTION_BUTTON_PRESET_DEFINITIONS)) {
			for (const g of def.gdLst ?? []) {
				const expected = g.formula.trim().split(/\s+/).length - 1;
				expect(g.args, `${def.name}/${g.name}`).toHaveLength(expected);
			}
		}
	});

	it('every action button shares the same beveled-rectangle geometry', () => {
		// All 12 are identical aside from the `name` field, so JSON-equality
		// after removing `name` should hold pairwise.
		const stripped = REQUIRED_SHAPES.map((n) => {
			const { name: _name, ...rest } = ACTION_BUTTON_PRESET_DEFINITIONS[n] ?? { name: '' };
			return JSON.stringify(rest);
		});
		const first = stripped[0];
		for (const s of stripped) {
			expect(s).toBe(first);
		}
	});

	it('default adj is 6250 (1/16 of ss)', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = ACTION_BUTTON_PRESET_DEFINITIONS[name];
			expect(def?.avLst?.adj).toBe(6250);
		}
	});

	it('exposes outer rectangle, inner inset, and bevel diagonals (3 paths)', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = ACTION_BUTTON_PRESET_DEFINITIONS[name];
			expect(def?.pathLst).toHaveLength(3);
			// Outer face is filled.
			expect(def?.pathLst[0]?.fill).toBe('norm');
			// Inner inset is darkened, no stroke.
			expect(def?.pathLst[1]?.fill).toBe('darken');
			expect(def?.pathLst[1]?.stroke).toBeFalsy();
			// Diagonal bevel facets are stroke-only.
			expect(def?.pathLst[2]?.fill).toBe('none');
			expect(def?.pathLst[2]?.stroke).toBeTruthy();
		}
	});

	it('inner-rect text bounds use the bevel inset (x1, y2)', () => {
		for (const name of REQUIRED_SHAPES) {
			const def = ACTION_BUTTON_PRESET_DEFINITIONS[name];
			expect(def?.rect).toStrictEqual({ l: 'x1', t: 'x1', r: 'x2', b: 'y2' });
		}
	});
});
