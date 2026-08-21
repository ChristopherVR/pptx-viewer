import type { PptxTableData } from 'pptx-viewer-core';
import {
	computeColumnBoundaries,
	computeResizedColumnWidths,
	computeResizedRowHeight,
	DEFAULT_ROW_HEIGHT,
} from 'pptx-viewer-shared';

/**
 * table-resize (Svelte): column/row drag-resize handles for the canvas table,
 * the Svelte port of Vue's `TableResizeOverlay.vue`. The pure redistribution/
 * clamp math lives in `pptx-viewer-shared` (`render/table-resize.ts`), shared
 * with every binding; this class only owns the DOM interaction, mirroring the
 * `ChartDragController` runes-class pattern (`chart-drag.svelte.ts`).
 *
 * Boundary lines rendered from `colBoundaries` / `rowBounds` are meant to stay
 * `pointer-events: none` in the template, so a touch tap always reaches the
 * cell underneath for double-tap-to-edit; `onpointerdown` proximity-hit-tests
 * against the live boundary positions to start a drag instead, exactly
 * mirroring Vue's container-delegation approach (not Angular's real-handle
 * one, which would block that touch passthrough).
 */

const HANDLE_ZONE = 3;

interface DragState {
	type: 'col' | 'row';
	index: number;
	startPos: number;
	initialWidths?: number[];
	initialRowHeight?: number;
}

function measureRowBoundaries(table: Element): number[] {
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

export class TableResizeController {
	/** Cumulative left-edge percentages (0-100) of the internal column boundaries. */
	colBoundaries = $state<number[]>([]);
	/** Cumulative top-edge pixel offsets of the internal row boundaries. */
	rowBounds = $state<number[]>([]);
	/** Live drag translation (px) for the boundary line currently dragged, or null when idle. */
	dragOffset = $state<number | null>(null);
	dragType = $state<'col' | 'row' | null>(null);
	dragIndex = $state<number | null>(null);

	#tableData: () => PptxTableData | undefined;
	#root: () => HTMLElement | null;
	#commitColumns: (widths: number[]) => void;
	#commitRow: (rowIndex: number, height: number) => void;
	#active: DragState | null = null;

	constructor(input: {
		tableData: () => PptxTableData | undefined;
		root: () => HTMLElement | null;
		commitColumns: (widths: number[]) => void;
		commitRow: (rowIndex: number, height: number) => void;
	}) {
		this.#tableData = input.tableData;
		this.#root = input.root;
		this.#commitColumns = input.commitColumns;
		this.#commitRow = input.commitRow;
	}

	/** Recompute both boundary arrays: columns from proportions, rows from the mounted `<tr>` heights. */
	measure(): void {
		const data = this.#tableData();
		this.colBoundaries = data ? computeColumnBoundaries(data.columnWidths) : [];
		const table = this.#root()?.querySelector('table');
		this.rowBounds = table ? measureRowBoundaries(table) : [];
	}

	/** Proximity-based drag initiation: hit-test a press against the measured boundaries. */
	onpointerdown = (event: PointerEvent): void => {
		const root = this.#root();
		const data = this.#tableData();
		if (!root || !data) {
			return;
		}
		const rect = root.getBoundingClientRect();
		const localX = event.clientX - rect.left;
		const localY = event.clientY - rect.top;

		for (let i = 0; i < this.colBoundaries.length; i++) {
			const boundaryX = (this.colBoundaries[i] / 100) * rect.width;
			if (Math.abs(localX - boundaryX) <= HANDLE_ZONE) {
				this.#begin(event, {
					type: 'col',
					index: i,
					startPos: event.clientX,
					initialWidths: [...data.columnWidths],
				});
				return;
			}
		}

		for (let i = 0; i < this.rowBounds.length; i++) {
			if (Math.abs(localY - this.rowBounds[i]) <= HANDLE_ZONE) {
				const tr = root.querySelectorAll<HTMLElement>('table tbody > tr')[i];
				this.#begin(event, {
					type: 'row',
					index: i,
					startPos: event.clientY,
					initialRowHeight: tr?.offsetHeight ?? DEFAULT_ROW_HEIGHT,
				});
				return;
			}
		}
	};

	#begin(event: PointerEvent, state: DragState): void {
		event.preventDefault();
		event.stopPropagation();
		this.#active = state;
		this.dragType = state.type;
		this.dragIndex = state.index;
		this.dragOffset = 0;
		window.addEventListener('pointermove', this.#onpointermove);
		window.addEventListener('pointerup', this.#onpointerup);
	}

	#onpointermove = (event: PointerEvent): void => {
		const active = this.#active;
		if (!active) {
			return;
		}
		event.preventDefault();
		this.dragOffset =
			active.type === 'col' ? event.clientX - active.startPos : event.clientY - active.startPos;
	};

	#onpointerup = (event: PointerEvent): void => {
		const active = this.#active;
		this.#active = null;
		this.dragType = null;
		this.dragIndex = null;
		this.dragOffset = null;
		this.#detach();
		if (!active) {
			return;
		}
		if (active.type === 'col' && active.initialWidths) {
			const rect = this.#root()?.getBoundingClientRect();
			const deltaProp = (event.clientX - active.startPos) / (rect?.width || 1);
			this.#commitColumns(
				computeResizedColumnWidths(active.initialWidths, active.index, deltaProp),
			);
		} else if (active.type === 'row') {
			const deltaY = event.clientY - active.startPos;
			this.#commitRow(
				active.index,
				computeResizedRowHeight(active.initialRowHeight ?? DEFAULT_ROW_HEIGHT, deltaY),
			);
		}
		this.measure();
	};

	/** Release listeners when the table unmounts mid-drag. */
	destroy(): void {
		this.#active = null;
		this.#detach();
	}

	#detach(): void {
		window.removeEventListener('pointermove', this.#onpointermove);
		window.removeEventListener('pointerup', this.#onpointerup);
	}
}
