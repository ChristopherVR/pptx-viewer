/**
 * Unit tests for the SmartArt insert-gallery catalogue (smart-art-presets.ts)
 * and its reconciliation with the layout-family resolver
 * (smartart-layout-helpers.ts).
 *
 * Two concerns are covered:
 * 1. Catalogue integrity: unique layouts, well-formed entries, valid categories.
 * 2. Insertability: every preset resolves to a known LayoutFamily, and every
 *    layout mapped in LAYOUT_FAMILY_MAP is reachable from the gallery (so a
 *    mapped layout is never left un-insertable).
 */

import { describe, expect, it } from 'vitest';

import { CATEGORIES, PRESETS } from './smart-art-presets';
import type { SmartArtCategory } from './smart-art-presets';
import { LAYOUT_FAMILY_MAP, resolveLayoutFamily } from './smartart-layout-helpers';
import type { LayoutFamily } from './smartart-layout-types';

const KNOWN_FAMILIES: LayoutFamily[] = [
	'list',
	'process',
	'cycle',
	'hierarchy',
	'matrix',
	'radial',
	'pyramid',
	'venn',
	'funnel',
	'target',
];

const CATEGORY_IDS = new Set<SmartArtCategory>(CATEGORIES.map((c) => c.id));

// ── Catalogue integrity ────────────────────────────────────────────────────────

describe('pRESETS catalogue integrity', () => {
	it('is non-empty', () => {
		expect(PRESETS.length).toBeGreaterThan(0);
	});

	it('has a unique layout per preset (no duplicate gallery entries)', () => {
		const layouts = PRESETS.map((p) => p.layout);
		expect(new Set(layouts).size).toBe(layouts.length);
	});

	it('gives every preset a non-empty label', () => {
		for (const p of PRESETS) {
			expect(p.label).toBeTypeOf('string');
			expect(p.label.trim().length).toBeGreaterThan(0);
		}
	});

	it('seeds every preset with at least two default node texts', () => {
		for (const p of PRESETS) {
			expect(Array.isArray(p.defaultItems)).toBeTruthy();
			expect(p.defaultItems.length).toBeGreaterThanOrEqual(2);
			for (const item of p.defaultItems) {
				expect(item).toBeTypeOf('string');
				expect(item.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it('places every preset in a category declared in CATEGORIES', () => {
		for (const p of PRESETS) {
			expect(CATEGORY_IDS.has(p.category)).toBeTruthy();
		}
	});

	it('declares unique category ids in CATEGORIES', () => {
		const ids = CATEGORIES.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

// ── Reconciliation: presets <-> layout families ────────────────────────────────

describe('pRESETS <-> LAYOUT_FAMILY_MAP reconciliation', () => {
	it('resolves every preset layout to a known LayoutFamily', () => {
		for (const p of PRESETS) {
			const family = resolveLayoutFamily([], undefined, p.layout);
			expect(KNOWN_FAMILIES).toContain(family);
		}
	});

	it('maps every preset layout in LAYOUT_FAMILY_MAP (no heuristic fallthrough)', () => {
		for (const p of PRESETS) {
			expect(LAYOUT_FAMILY_MAP[p.layout]).toBeDefined();
		}
	});

	it('makes every layout mapped in LAYOUT_FAMILY_MAP reachable from the gallery', () => {
		const presetLayouts = new Set(PRESETS.map((p) => p.layout));
		const unreachable = (
			Object.keys(LAYOUT_FAMILY_MAP) as Array<keyof typeof LAYOUT_FAMILY_MAP>
		).filter((layout) => !presetLayouts.has(layout));
		expect(unreachable).toStrictEqual([]);
	});

	it('points every LAYOUT_FAMILY_MAP entry at a known LayoutFamily', () => {
		for (const family of Object.values(LAYOUT_FAMILY_MAP)) {
			expect(KNOWN_FAMILIES).toContain(family);
		}
	});

	it('resolves the previously-unmapped catalogue layouts to their families', () => {
		expect(resolveLayoutFamily([], undefined, 'basicTimeline')).toBe('process');
		expect(resolveLayoutFamily([], undefined, 'bendingProcess')).toBe('process');
		expect(resolveLayoutFamily([], undefined, 'basicTarget')).toBe('radial');
		expect(resolveLayoutFamily([], undefined, 'interlockingGears')).toBe('radial');
		expect(resolveLayoutFamily([], undefined, 'basicMatrix')).toBe('matrix');
		expect(resolveLayoutFamily([], undefined, 'basicPyramid')).toBe('pyramid');
		expect(resolveLayoutFamily([], undefined, 'invertedPyramid')).toBe('pyramid');
		expect(resolveLayoutFamily([], undefined, 'basicFunnel')).toBe('funnel');
	});
});
