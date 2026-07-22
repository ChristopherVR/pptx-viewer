import { describe, expect, it } from 'vitest';

import { toolCanvasTarget } from './tool-target';

describe('toolCanvasTarget', () => {
	it('maps a single-element read tool to slide + element', () => {
		expect(toolCanvasTarget('get_element', { slideIndex: 4, elementId: 'shape-1' })).toStrictEqual({
			slideIndex: 4,
			elementIds: ['shape-1'],
		});
	});

	it('collects both table ids for merge_tables', () => {
		expect(
			toolCanvasTarget('merge_tables', {
				slideIndex: 2,
				elementIdA: 'tbl-a',
				elementIdB: 'tbl-b',
			}),
		).toStrictEqual({ slideIndex: 2, elementIds: ['tbl-a', 'tbl-b'] });
	});

	it('reads an elementIds array', () => {
		expect(
			toolCanvasTarget('delete_elements', { slideIndex: 1, elementIds: ['a', 'b', 'c'] }),
		).toStrictEqual({ slideIndex: 1, elementIds: ['a', 'b', 'c'] });
	});

	it('maps a staged create_chart to just its target slide (no element yet)', () => {
		expect(
			toolCanvasTarget('create_chart', { slideIndex: 1, chartType: 'bar', title: 'Q3' }),
		).toStrictEqual({ slideIndex: 1, elementIds: [] });
	});

	it('maps a staged add_smartart to just its target slide', () => {
		expect(
			toolCanvasTarget('add_smartart', { slideIndex: 3, layout: 'basicBlockList' }),
		).toStrictEqual({ slideIndex: 3, elementIds: [] });
	});

	it('maps an edit tool to its slide + element', () => {
		expect(
			toolCanvasTarget('set_shape_style', { slideIndex: 2, elementId: 'sh-9', fillColor: '#fff' }),
		).toStrictEqual({ slideIndex: 2, elementIds: ['sh-9'] });
		expect(
			toolCanvasTarget('update_text', { slideIndex: 0, elementId: 'tx-1', text: 'hi' }),
		).toStrictEqual({ slideIndex: 0, elementIds: ['tx-1'] });
	});

	it('maps a navigation tool to just the slide', () => {
		expect(toolCanvasTarget('go_to_slide', { slideIndex: 6 })).toStrictEqual({
			slideIndex: 6,
			elementIds: [],
		});
	});

	it('uses the first slide of a multi-slide tool', () => {
		expect(toolCanvasTarget('delete_slides', { slideIndexes: [3, 4] })).toStrictEqual({
			slideIndex: 3,
			elementIds: [],
		});
		expect(toolCanvasTarget('reorder_slides', { newOrder: [2, 0, 1] })).toStrictEqual({
			slideIndex: 2,
			elementIds: [],
		});
	});

	it('returns null for deck-wide tools with no single target', () => {
		expect(toolCanvasTarget('get_deck_overview', {})).toBeNull();
		expect(toolCanvasTarget('get_theme', {})).toBeNull();
		expect(toolCanvasTarget('find_text', { query: 'hi' })).toBeNull();
		expect(toolCanvasTarget('update_theme_colors', { accent1: '#fff' })).toBeNull();
		expect(toolCanvasTarget('replace_all', { query: 'a', replacement: 'b' })).toBeNull();
	});

	it('ignores non-string ids and non-number indexes', () => {
		expect(toolCanvasTarget('get_element', { slideIndex: 'x', elementId: 42 })).toBeNull();
	});
});
