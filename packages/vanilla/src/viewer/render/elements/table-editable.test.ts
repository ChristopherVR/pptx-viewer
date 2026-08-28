import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { computeResizedColumnWidths, computeResizedRowHeight } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { registerTableChartRenderers } from './register-table-chart';
import { renderTableElement } from './table';

function buildTableData(): PptxTableData {
	return {
		columnWidths: [0.5, 0.3, 0.2],
		rows: [
			{ cells: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] },
			{ cells: [{ text: 'D' }, { text: 'E' }, { text: 'F' }] },
			{ cells: [{ text: 'G' }, { text: 'H' }, { text: 'I' }] },
		],
	};
}

function buildTableElement(): PptxElement {
	return {
		type: 'table',
		id: 'el-table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: buildTableData(),
	};
}

/** Mount a table with resize handlers wired, container geometry stubbed to 400x200 at (0,0). */
function mountResizableTable() {
	const registry = createElementRendererRegistry();
	registerTableChartRenderers(registry);
	const onTableResizeColumns = vi.fn();
	const onTableResizeRow = vi.fn();
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		interactive: true,
		onTableResizeColumns,
		onTableResizeRow,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
	};
	const element = buildTableElement();
	const container = renderTableElement(element, 0, context) as HTMLElement;
	document.body.appendChild(container);
	vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
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
	const trs = [...container.querySelectorAll<HTMLElement>('tbody > tr')];
	for (const tr of trs) {
		Object.defineProperty(tr, 'offsetHeight', { value: 40, configurable: true });
	}
	return { container, onTableResizeColumns, onTableResizeRow };
}

function drag(container: HTMLElement, downAt: [number, number], upAt: [number, number]): void {
	container.dispatchEvent(
		new MouseEvent('mousedown', { clientX: downAt[0], clientY: downAt[1], bubbles: true }),
	);
	window.dispatchEvent(
		new MouseEvent('mouseup', { clientX: upAt[0], clientY: upAt[1], bubbles: true }),
	);
}

describe('enableTableResize', () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it('does not wire drag handlers when no resize callback is present', () => {
		const registry = createElementRendererRegistry();
		registerTableChartRenderers(registry);
		const context: ElementRenderContext = {
			document,
			slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
			canvasSize: { width: 1280, height: 720 },
			scale: 1,
			mediaDataUrls: new Map<string, string>(),
			t: createTranslator(),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			lineChart3D: false,
			areaChart3D: false,
			pieChart3D: false,
			presenting: false,
			registry,
			renderElement(element, zIndex) {
				return registry.resolve(element.type)(element, zIndex, context);
			},
		};
		const container = renderTableElement(buildTableElement(), 0, context) as HTMLElement;
		expect(container.querySelector('.pptxv-table-resize-col')).toBeNull();
	});

	it('draws a boundary handle per internal column boundary', () => {
		const { container } = mountResizableTable();
		// 3 columns -> 2 internal boundaries.
		expect(container.querySelectorAll('.pptxv-table-resize-col')).toHaveLength(2);
	});

	it('dragging a column boundary commits the redistributed widths', () => {
		const { container, onTableResizeColumns } = mountResizableTable();
		// columnWidths [0.5, 0.3, 0.2] -> boundaries at 50%/80% of 400px = 200px/320px.
		drag(container, [200, 10], [220, 10]);
		expect(onTableResizeColumns).toHaveBeenCalledOnce();
		const [element, widths] = onTableResizeColumns.mock.calls[0];
		expect(element.id).toBe('el-table');
		expect(widths).toStrictEqual(computeResizedColumnWidths([0.5, 0.3, 0.2], 0, 20 / 400));
	});

	it('ignores a mousedown away from any boundary', () => {
		const { container, onTableResizeColumns, onTableResizeRow } = mountResizableTable();
		drag(container, [10, 10], [30, 10]);
		expect(onTableResizeColumns).not.toHaveBeenCalled();
		expect(onTableResizeRow).not.toHaveBeenCalled();
	});

	it('dragging a row boundary commits the clamped row height', () => {
		const { container, onTableResizeRow } = mountResizableTable();
		// 3 rows of 40px each -> boundaries at 40px and 80px from the table top.
		drag(container, [10, 40], [10, 60]);
		expect(onTableResizeRow).toHaveBeenCalledOnce();
		const [element, rowIndex, height] = onTableResizeRow.mock.calls[0];
		expect(element.id).toBe('el-table');
		expect(rowIndex).toBe(0);
		expect(height).toBe(computeResizedRowHeight(40, 20));
	});
});
