import type { TablePptxElement } from 'pptx-viewer-core';
import {
	computeColumnBoundaries,
	computeResizedColumnWidths,
	computeResizedRowHeight,
	DEFAULT_ROW_HEIGHT,
} from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderContext } from '../types';

/** Pixel tolerance for a mousedown to count as "on" a column/row boundary. */
const HANDLE_ZONE = 3;

interface DragState {
	type: 'col' | 'row';
	index: number;
	startPos: number;
	handleEl: HTMLElement;
	initialWidths?: number[];
	initialRowHeight?: number;
}

/** Live row-boundary offsets (px from the table top), read fresh at drag time. */
function measureRowBoundaries(table: HTMLTableElement): number[] {
	const trs = [...table.querySelectorAll<HTMLElement>('tbody > tr')];
	const bounds: number[] = [];
	let cumulative = 0;
	trs.forEach((tr, i) => {
		cumulative += tr.offsetHeight;
		if (i < trs.length - 1) {
			bounds.push(cumulative);
		}
	});
	return bounds;
}

/**
 * Add React/Vue-parity column and row drag-resize handles to a rendered
 * table. Ported from Vue's `TableResizeOverlay.vue`: the boundary lines drawn
 * here are purely visual (`pointer-events: none`, so a touch tap always
 * reaches the cell underneath for double-tap-to-edit); the container's
 * `mousedown` proximity-hit-tests against the live boundary positions to
 * start a drag, exactly mirroring the Vue container-delegation approach
 * rather than Angular's per-handle pointer targets (which would block that
 * touch passthrough). The pure redistribution/clamp math lives in
 * `pptx-viewer-shared` (`render/table-resize.ts`), shared with every binding.
 */
export function enableTableResize(
	container: HTMLElement,
	table: HTMLTableElement,
	element: TablePptxElement,
	context: ElementRenderContext,
): void {
	const tableData = element.tableData;
	if (!tableData || (!context.onTableResizeColumns && !context.onTableResizeRow)) {
		return;
	}
	const doc = container.ownerDocument;
	const win = doc.defaultView;
	if (!win) {
		return;
	}

	let colHandles: HTMLElement[] = [];
	let rowHandles: HTMLElement[] = [];

	function drawHandles(): void {
		for (const handle of [...colHandles, ...rowHandles]) {
			handle.remove();
		}
		colHandles = computeColumnBoundaries(tableData!.columnWidths).map((leftPct) => {
			const handle = createEl(doc, 'div', 'pptxv-table-resize-col', {
				position: 'absolute',
				top: '0',
				bottom: '0',
				left: `calc(${leftPct}% - 3px)`,
				width: '6px',
				zIndex: '10',
				cursor: 'col-resize',
				pointerEvents: 'none',
			});
			container.appendChild(handle);
			return handle;
		});
		rowHandles = measureRowBoundaries(table).map((topPx) => {
			const handle = createEl(doc, 'div', 'pptxv-table-resize-row', {
				position: 'absolute',
				left: '0',
				right: '0',
				top: `${topPx - 3}px`,
				height: '6px',
				zIndex: '10',
				cursor: 'row-resize',
				pointerEvents: 'none',
			});
			container.appendChild(handle);
			return handle;
		});
	}
	drawHandles();
	// Row heights are 0 until the container is laid out in the document; redraw
	// once attachment has happened (the caller attaches it synchronously right
	// after this render call returns, well before the next frame).
	win.requestAnimationFrame(drawHandles);

	let drag: DragState | null = null;

	function onMouseMove(event: MouseEvent): void {
		if (!drag) {
			return;
		}
		event.preventDefault();
		const delta =
			drag.type === 'col' ? event.clientX - drag.startPos : event.clientY - drag.startPos;
		drag.handleEl.style.transform =
			drag.type === 'col' ? `translateX(${delta}px)` : `translateY(${delta}px)`;
	}

	function onMouseUp(event: MouseEvent): void {
		const active = drag;
		drag = null;
		doc.body.style.cursor = '';
		doc.body.style.userSelect = '';
		win?.removeEventListener('mousemove', onMouseMove);
		win?.removeEventListener('mouseup', onMouseUp);
		if (!active) {
			return;
		}
		active.handleEl.style.transform = '';
		if (active.type === 'col' && active.initialWidths) {
			const rect = container.getBoundingClientRect();
			const deltaProp = (event.clientX - active.startPos) / (rect.width || 1);
			context.onTableResizeColumns?.(
				element,
				computeResizedColumnWidths(active.initialWidths, active.index, deltaProp),
			);
		} else if (active.type === 'row') {
			const deltaY = event.clientY - active.startPos;
			context.onTableResizeRow?.(
				element,
				active.index,
				computeResizedRowHeight(active.initialRowHeight ?? DEFAULT_ROW_HEIGHT, deltaY),
			);
		}
		drawHandles();
	}

	container.addEventListener('mousedown', (event) => {
		const rect = container.getBoundingClientRect();
		const localX = event.clientX - rect.left;
		const localY = event.clientY - rect.top;

		const colBoundaries = computeColumnBoundaries(tableData!.columnWidths);
		for (let i = 0; i < colBoundaries.length; i++) {
			const boundaryX = (colBoundaries[i] / 100) * rect.width;
			if (Math.abs(localX - boundaryX) <= HANDLE_ZONE) {
				event.preventDefault();
				event.stopPropagation();
				doc.body.style.cursor = 'col-resize';
				doc.body.style.userSelect = 'none';
				drag = {
					type: 'col',
					index: i,
					startPos: event.clientX,
					handleEl: colHandles[i] ?? container,
					initialWidths: [...tableData!.columnWidths],
				};
				win.addEventListener('mousemove', onMouseMove);
				win.addEventListener('mouseup', onMouseUp);
				return;
			}
		}

		const rowBounds = measureRowBoundaries(table);
		for (let i = 0; i < rowBounds.length; i++) {
			if (Math.abs(localY - rowBounds[i]) <= HANDLE_ZONE) {
				event.preventDefault();
				event.stopPropagation();
				const tr = table.querySelectorAll<HTMLElement>('tbody > tr')[i];
				doc.body.style.cursor = 'row-resize';
				doc.body.style.userSelect = 'none';
				drag = {
					type: 'row',
					index: i,
					startPos: event.clientY,
					handleEl: rowHandles[i] ?? container,
					initialRowHeight: tr?.offsetHeight ?? DEFAULT_ROW_HEIGHT,
				};
				win.addEventListener('mousemove', onMouseMove);
				win.addEventListener('mouseup', onMouseUp);
				return;
			}
		}
	});
}
