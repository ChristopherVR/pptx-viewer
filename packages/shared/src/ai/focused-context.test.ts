import type { PptxSlide, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { PptxAiBridge, PptxAiFocusedTarget } from './bridge';
import { buildDeckContext, buildFocusedTargetsContext } from './focused-context';
import { makeMockBridge, makeSlide, textElement } from './mock-bridge';

/** Build a table element with the given cell text grid. */
function tableElement(id: string, grid: string[][]): TablePptxElement {
	return {
		id,
		type: 'table',
		x: 50,
		y: 200,
		width: 800,
		height: 300,
		tableData: {
			rows: grid.map((cells) => ({ cells: cells.map((text) => ({ text })) })),
			columnWidths: grid[0].map(() => 1 / grid[0].length),
		},
	} as unknown as TablePptxElement;
}

/** A bridge over one slide with two tables plus a title, with focused targets. */
function bridgeWithTables(targets: PptxAiFocusedTarget[]): PptxAiBridge {
	const tableA = tableElement('tbl-a', [
		['Region', 'Q1'],
		['North', '100'],
	]);
	const tableB = tableElement('tbl-b', [
		['Region', 'Q2'],
		['South', '200'],
	]);
	const slide: PptxSlide = makeSlide(0, [
		textElement('title', 'Sales'),
		tableA,
		tableB,
	] as unknown as PptxSlide['elements']);
	const bridge = makeMockBridge({ slides: [slide] });
	return { ...bridge, getFocusedTargets: () => targets };
}

describe('focused-target context', () => {
	it('returns undefined when the bridge has no focused targets', () => {
		expect(buildFocusedTargetsContext(makeMockBridge())).toBeUndefined();
	});

	it('describes a slide target with its title and element inventory', () => {
		const bridge = bridgeWithTables([{ kind: 'slide', slideIndex: 0 }]);
		const block = buildFocusedTargetsContext(bridge);
		expect(block).toBeDefined();
		expect(block).toContain('focus on');
		expect(block).toContain('Slide 1: Sales');
		expect(block).toContain('table#tbl-a');
		expect(block).toContain('table#tbl-b');
	});

	it('describes two table element targets including cell text', () => {
		const bridge = bridgeWithTables([
			{ kind: 'element', slideIndex: 0, elementId: 'tbl-a' },
			{ kind: 'element', slideIndex: 0, elementId: 'tbl-b' },
		]);
		const block = buildFocusedTargetsContext(bridge);
		expect(block).toBeDefined();
		expect(block).toContain('Element table#tbl-a on slide 1');
		expect(block).toContain('2x2 table cells');
		// Cell text from both tables is present.
		expect(block).toContain('North | 100');
		expect(block).toContain('South | 200');
		expect(block).toContain('Element table#tbl-b on slide 1');
	});

	it('caps a large table to the maxTableCells budget', () => {
		const grid = Array.from({ length: 20 }, (_, r) => [`r${r}c0`, `r${r}c1`]);
		const slide: PptxSlide = makeSlide(0, [
			tableElement('big', grid),
		] as unknown as PptxSlide['elements']);
		const bridge = {
			...makeMockBridge({ slides: [slide] }),
			getFocusedTargets: (): PptxAiFocusedTarget[] => [
				{ kind: 'element', slideIndex: 0, elementId: 'big' },
			],
		};
		const block = buildFocusedTargetsContext(bridge, { maxTableCells: 6 });
		expect(block).toContain('truncated to fit context budget');
	});

	it('assembles outline strategy output plus the focus block', async () => {
		const bridge = bridgeWithTables([{ kind: 'element', slideIndex: 0, elementId: 'tbl-a' }]);
		const context = await buildDeckContext(bridge, { strategy: 'outline' });
		// Deck outline header from buildDeckOutline.
		expect(context).toContain('Deck:');
		// Focus block appended.
		expect(context).toContain('Element table#tbl-a on slide 1');
	});

	it('emits only the focus block when strategy is none', async () => {
		const bridge = bridgeWithTables([{ kind: 'slide', slideIndex: 0 }]);
		const context = await buildDeckContext(bridge, { strategy: 'none' });
		expect(context).not.toContain('Deck:');
		expect(context).toContain('Slide 1: Sales');
	});
});
