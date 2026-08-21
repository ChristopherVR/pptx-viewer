/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own locals; not intended as one statement */
import type { PptxTableData } from 'pptx-viewer-core';
import { computeResizedColumnWidths, computeResizedRowHeight } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TableResizeController } from './table-resize.svelte';

/**
 * Column/row drag-resize handles for the canvas table (Svelte).
 *
 * The pure redistribution/clamp math lives in `pptx-viewer-shared` and has
 * its own tests; these cover the Svelte wrapper's contract (boundary
 * measurement, proximity hit-testing, single commit on release, teardown),
 * mirroring `chart-drag.test.ts` for the analogous chart drag controller.
 */
function tableData(): PptxTableData {
	return {
		columnWidths: [0.5, 0.3, 0.2],
		rows: [
			{ cells: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] },
			{ cells: [{ text: 'D' }, { text: 'E' }, { text: 'F' }] },
			{ cells: [{ text: 'G' }, { text: 'H' }, { text: 'I' }] },
		],
	};
}

/** A root carrying a 3x3 table, stubbed to a 400x200 box with 40px-tall rows. */
function makeRoot(): HTMLElement {
	const root = document.createElement('div');
	root.innerHTML = '<table><tbody><tr></tr><tr></tr><tr></tr></tbody></table>';
	vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
		left: 0,
		top: 0,
		width: 400,
		height: 200,
		right: 400,
		bottom: 200,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	} as DOMRect);
	for (const tr of root.querySelectorAll<HTMLElement>('tbody > tr')) {
		Object.defineProperty(tr, 'offsetHeight', { value: 40, configurable: true });
	}
	document.body.appendChild(root);
	return root;
}

function press(controller: TableResizeController, clientX: number, clientY: number): void {
	controller.onpointerdown(
		new MouseEvent('pointerdown', {
			clientX,
			clientY,
			bubbles: true,
			cancelable: true,
		}) as unknown as PointerEvent,
	);
}

function move(clientX: number, clientY: number): void {
	window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY, bubbles: true }));
}

function release(clientX: number, clientY: number): void {
	window.dispatchEvent(new MouseEvent('pointerup', { clientX, clientY, bubbles: true }));
}

function makeController(overrides: { data?: PptxTableData } = {}): {
	controller: TableResizeController;
	root: HTMLElement;
	commitColumns: ReturnType<typeof vi.fn>;
	commitRow: ReturnType<typeof vi.fn>;
} {
	const root = makeRoot();
	const data = overrides.data ?? tableData();
	const commitColumns = vi.fn();
	const commitRow = vi.fn();
	const controller = new TableResizeController({
		tableData: () => data,
		root: () => root,
		commitColumns,
		commitRow,
	});
	controller.measure();
	return { controller, root, commitColumns, commitRow };
}

describe('svelte table drag-resize', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('measures column boundaries as percentages and row boundaries as pixel offsets', () => {
		const { controller } = makeController();
		expect(controller.colBoundaries).toStrictEqual([50, 80]);
		expect(controller.rowBounds).toStrictEqual([40, 80]);
	});

	it('dragging a column boundary commits the redistributed widths, once', () => {
		const { controller, commitColumns } = makeController();
		press(controller, 200, 10);
		move(220, 10);
		release(220, 10);
		expect(commitColumns).toHaveBeenCalledExactlyOnceWith(
			computeResizedColumnWidths([0.5, 0.3, 0.2], 0, 20 / 400),
		);
	});

	it('dragging a row boundary commits the clamped row height', () => {
		const { controller, commitRow } = makeController();
		press(controller, 10, 40);
		release(10, 60);
		expect(commitRow).toHaveBeenCalledExactlyOnceWith(0, computeResizedRowHeight(40, 20));
	});

	it('tracks a live drag offset for the boundary being dragged, cleared on release', () => {
		const { controller } = makeController();
		press(controller, 200, 10);
		expect(controller.dragType).toBe('col');
		expect(controller.dragIndex).toBe(0);
		move(230, 10);
		expect(controller.dragOffset).toBe(30);
		release(230, 10);
		expect(controller.dragType).toBeNull();
		expect(controller.dragOffset).toBeNull();
	});

	it('ignores a press away from any boundary', () => {
		const { controller, commitColumns, commitRow } = makeController();
		press(controller, 10, 10);
		release(30, 10);
		expect(commitColumns).not.toHaveBeenCalled();
		expect(commitRow).not.toHaveBeenCalled();
	});

	it('stops listening after destroy, so a subsequent release commits nothing', () => {
		const { controller, commitColumns } = makeController();
		press(controller, 200, 10);
		controller.destroy();
		release(220, 10);
		expect(commitColumns).not.toHaveBeenCalled();
	});
});
