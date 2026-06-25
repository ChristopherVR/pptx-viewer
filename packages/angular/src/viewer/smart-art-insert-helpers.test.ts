/**
 * Tests for the Angular "Insert SmartArt" dialog logic.
 *
 * The Angular package's vitest setup has no Angular compiler (see PORTING.md),
 * so the dialog component itself is not exercised via TestBed. These tests
 * target the pure helper layer (`smart-art-insert-helpers.ts`), which carries
 * 100% of the dialog's non-presentational behaviour: category filtering, preset
 * lookup, node-payload building (incl. hierarchy parenting), the SmartArt
 * element factory, and textarea parsing. The component is a thin shell that only
 * forwards events to these helpers.
 */
import type { SmartArtPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { PRESETS } from '../internal/shared';
import {
	buildSmartArtInsertElement,
	buildSmartArtNodes,
	parseNodeTextarea,
	presetByLayout,
	presetsForCategory,
} from './smart-art-insert-helpers';

// ── Category filtering ────────────────────────────────────────────────────────

describe('presetsForCategory', () => {
	it('returns only presets in the requested category', () => {
		const list = presetsForCategory('process');
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((p) => p.category === 'process')).toBeTruthy();
	});

	it('covers every preset across the five categories', () => {
		const total =
			presetsForCategory('list').length +
			presetsForCategory('process').length +
			presetsForCategory('cycle').length +
			presetsForCategory('hierarchy').length +
			presetsForCategory('relationship').length;
		expect(total).toBe(PRESETS.length);
	});
});

// ── Preset lookup ─────────────────────────────────────────────────────────────

describe('presetByLayout', () => {
	it('resolves a known layout', () => {
		expect(presetByLayout('basicBlockList')?.label).toBe('Basic Block List');
	});

	it('returns undefined for an unknown layout', () => {
		// @ts-expect-error: deliberately passing a non-catalogued layout value.
		expect(presetByLayout('notALayout')).toBeUndefined();
	});
});

// ── Node payload building ─────────────────────────────────────────────────────

describe('buildSmartArtNodes', () => {
	it('builds flat top-level nodes for non-hierarchy layouts', () => {
		const nodes = buildSmartArtNodes('basicCycle', ['A', 'B', 'C'], 'seed');
		expect(nodes.map((n) => n.text)).toStrictEqual(['A', 'B', 'C']);
		expect(nodes.every((n) => n.parentId === undefined)).toBeTruthy();
	});

	it('parents every item after the first under the root for hierarchy', () => {
		const nodes = buildSmartArtNodes('hierarchy', ['Root', 'Child 1', 'Child 2'], 'seed');
		expect(nodes[0].parentId).toBeUndefined();
		expect(nodes[1].parentId).toBe(nodes[0].id);
		expect(nodes[2].parentId).toBe(nodes[0].id);
	});

	it('assigns unique, seed-derived ids', () => {
		const nodes = buildSmartArtNodes('basicBlockList', ['A', 'B'], 'xyz');
		expect(nodes[0].id).toBe('node-xyz-0');
		expect(nodes[1].id).toBe('node-xyz-1');
		expect(new Set(nodes.map((n) => n.id)).size).toBe(2);
	});

	it('handles a single hierarchy item with no children', () => {
		const nodes = buildSmartArtNodes('hierarchy', ['Solo'], 'seed');
		expect(nodes).toHaveLength(1);
		expect(nodes[0].parentId).toBeUndefined();
	});
});

// ── Element factory ───────────────────────────────────────────────────────────

describe('buildSmartArtInsertElement', () => {
	it('builds a smartArt element with empty id and the chosen layout', () => {
		const el = buildSmartArtInsertElement(
			'segmentedProcess',
			['Step 1', 'Step 2'],
			'seed',
		) as SmartArtPptxElement;
		expect(el.type).toBe('smartArt');
		expect(el.id).toBe('');
		expect(el.smartArtData.layout).toBe('segmentedProcess');
		expect(el.smartArtData.colorScheme).toBe('colorful1');
		expect(el.smartArtData.style).toBe('flat');
		expect(el.smartArtData.nodes.map((n) => n.text)).toStrictEqual(['Step 1', 'Step 2']);
	});

	it('produces hierarchy parenting through the element factory', () => {
		const el = buildSmartArtInsertElement(
			'hierarchy',
			['R', 'C1', 'C2'],
			'seed',
		) as SmartArtPptxElement;
		const nodes = el.smartArtData.nodes;
		expect(nodes[1].parentId).toBe(nodes[0].id);
		expect(nodes[2].parentId).toBe(nodes[0].id);
	});
});

// ── Textarea parsing ──────────────────────────────────────────────────────────

describe('parseNodeTextarea', () => {
	it('splits non-empty trimmed lines', () => {
		expect(parseNodeTextarea('A\n  B  \n\nC\n', ['x'])).toStrictEqual(['A', 'B', 'C']);
	});

	it('falls back to defaults when nothing usable remains', () => {
		expect(parseNodeTextarea('   \n\n', ['Item 1', 'Item 2'])).toStrictEqual(['Item 1', 'Item 2']);
	});

	it('returns a fresh array copy of the fallback (no shared reference)', () => {
		const fallback = ['a'];
		const out = parseNodeTextarea('', fallback);
		expect(out).toStrictEqual(fallback);
		expect(out).not.toBe(fallback);
	});
});
