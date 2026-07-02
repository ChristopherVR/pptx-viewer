/**
 * table-resize-overlay.component.ts: draggable column / row resize handles.
 *
 * Selector: `pptx-table-resize-overlay`
 *
 * Angular port of the React `TableResizeOverlay`
 * (packages/react/src/viewer/utils/table-render-resize.tsx). It projects the
 * rendered `<table>` via `<ng-content>` and overlays thin draggable handles on
 * the internal column boundaries and row boundaries. Drag geometry is delegated
 * to `pptx-viewer-shared` (`computeColumnBoundaries` / `computeResizedColumnWidths`
 * / `computeResizedRowHeight`); this component only wires pointer events.
 *
 * On drop it emits the new column-width array (`resizeColumns`) or the resized
 * row's index + height (`resizeRow`); the parent commits them through the editor
 * history path.
 */
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	Injector,
	inject,
	input,
	output,
	signal,
} from '@angular/core';

import {
	computeColumnBoundaries,
	computeResizedColumnWidths,
	computeResizedRowHeight,
	DEFAULT_ROW_HEIGHT,
} from '../internal/shared';

interface DragState {
	type: 'col' | 'row';
	index: number;
	startPos: number;
	handle: HTMLElement;
	initialWidths?: number[];
	initialRowHeight?: number;
}

@Component({
	selector: 'pptx-table-resize-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-tbl-resize" #container>
			<ng-content />
			@if (editable()) {
				@for (leftPct of colBoundaries(); track $index; let i = $index) {
					<div
						class="pptx-ng-tbl-resize__col"
						[style.left.%]="leftPct"
						(pointerdown)="onColDown($event, i)"
					>
						<div class="pptx-ng-tbl-resize__col-line"></div>
					</div>
				}
				@for (topPx of rowBounds(); track $index; let i = $index) {
					<div
						class="pptx-ng-tbl-resize__row"
						[style.top.px]="topPx"
						(pointerdown)="onRowDown($event, i)"
					>
						<div class="pptx-ng-tbl-resize__row-line"></div>
					</div>
				}
			}
		</div>
	`,
	styles: `
		.pptx-ng-tbl-resize {
			position: relative;
			width: 100%;
			height: 100%;
		}
		.pptx-ng-tbl-resize__col {
			position: absolute;
			top: 0;
			bottom: 0;
			width: 6px;
			margin-left: -3px;
			cursor: col-resize;
			z-index: 10;
		}
		.pptx-ng-tbl-resize__row {
			position: absolute;
			left: 0;
			right: 0;
			height: 6px;
			margin-top: -3px;
			cursor: row-resize;
			z-index: 10;
		}
		.pptx-ng-tbl-resize__col-line {
			width: 1px;
			height: 100%;
			margin: 0 auto;
			background: transparent;
			transition: background-color 0.12s;
		}
		.pptx-ng-tbl-resize__row-line {
			height: 1px;
			width: 100%;
			margin: auto 0;
			background: transparent;
			transition: background-color 0.12s;
		}
		.pptx-ng-tbl-resize__col:hover .pptx-ng-tbl-resize__col-line,
		.pptx-ng-tbl-resize__row:hover .pptx-ng-tbl-resize__row-line {
			background: rgba(96, 165, 250, 0.6);
		}
	`,
})
export class TableResizeOverlayComponent {
	/** Column widths as proportions summing to ~1. */
	readonly columnWidths = input.required<number[]>();
	/** Whether the resize handles are active. */
	readonly editable = input<boolean>(false);

	/** Emitted on column-boundary drop with the renormalised width array. */
	readonly resizeColumns = output<number[]>();
	/** Emitted on row-boundary drop with the resized row's index + new height. */
	readonly resizeRow = output<{ index: number; height: number }>();

	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
	private readonly injector = inject(Injector);

	/** Cumulative internal column-boundary positions as percentages (0-100). */
	readonly colBoundaries = computed<number[]>(() => computeColumnBoundaries(this.columnWidths()));

	/** Measured internal row-boundary offsets (px from the table top). */
	readonly rowBounds = signal<number[]>([]);

	private drag: DragState | null = null;
	private readonly onMove = (e: PointerEvent): void => this.handleMove(e);
	private readonly onUp = (e: PointerEvent): void => this.handleUp(e);

	constructor() {
		// Initial measure once the projected table has mounted, then keep the row
		// boundaries in sync: a ResizeObserver (when available) catches row-height
		// changes, and an effect re-measures when the column set changes.
		afterNextRender(
			() => {
				this.measureRows();
				this.observeResize();
			},
			{ injector: this.injector },
		);
		effect(() => {
			// Depend on the column widths so structural changes trigger a re-measure.
			this.columnWidths();
			afterNextRender(() => this.measureRows(), { injector: this.injector });
		});
	}

	/** Observe the container so row-height changes re-measure the boundaries. */
	private observeResize(): void {
		const container = this.container();
		if (!container || typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => this.measureRows());
		observer.observe(container);
	}

	private container(): HTMLElement | null {
		return this.host.nativeElement.querySelector('.pptx-ng-tbl-resize');
	}

	private measureRows(): void {
		const table = this.container()?.querySelector('table');
		if (!table) {
			return;
		}
		const trs = table.querySelectorAll('tbody > tr');
		const bounds: number[] = [];
		let cumulative = 0;
		trs.forEach((tr, i) => {
			cumulative += (tr as HTMLElement).offsetHeight;
			if (i < trs.length - 1) {
				bounds.push(cumulative);
			}
		});
		const prev = this.rowBounds();
		if (prev.length !== bounds.length || prev.some((v, i) => v !== bounds[i])) {
			this.rowBounds.set(bounds);
		}
	}

	onColDown(event: PointerEvent, index: number): void {
		event.preventDefault();
		event.stopPropagation();
		this.beginDrag({
			type: 'col',
			index,
			startPos: event.clientX,
			handle: event.currentTarget as HTMLElement,
			initialWidths: [...this.columnWidths()],
		});
	}

	onRowDown(event: PointerEvent, index: number): void {
		event.preventDefault();
		event.stopPropagation();
		const table = this.container()?.querySelector('table');
		const tr = table?.querySelectorAll('tbody > tr')[index] as HTMLElement | undefined;
		this.beginDrag({
			type: 'row',
			index,
			startPos: event.clientY,
			handle: event.currentTarget as HTMLElement,
			initialRowHeight: tr?.offsetHeight ?? DEFAULT_ROW_HEIGHT,
		});
	}

	private beginDrag(state: DragState): void {
		this.drag = state;
		document.addEventListener('pointermove', this.onMove);
		document.addEventListener('pointerup', this.onUp);
	}

	private handleMove(event: PointerEvent): void {
		const drag = this.drag;
		if (!drag) {
			return;
		}
		event.preventDefault();
		const delta =
			drag.type === 'col' ? event.clientX - drag.startPos : event.clientY - drag.startPos;
		drag.handle.style.transform =
			drag.type === 'col' ? `translateX(${delta}px)` : `translateY(${delta}px)`;
	}

	private handleUp(event: PointerEvent): void {
		const drag = this.drag;
		this.drag = null;
		document.removeEventListener('pointermove', this.onMove);
		document.removeEventListener('pointerup', this.onUp);
		if (!drag) {
			return;
		}
		drag.handle.style.transform = '';

		if (drag.type === 'col' && drag.initialWidths) {
			const rect = this.container()?.getBoundingClientRect();
			const width = rect?.width ?? 1;
			const deltaProp = (event.clientX - drag.startPos) / width;
			this.resizeColumns.emit(
				computeResizedColumnWidths(drag.initialWidths, drag.index, deltaProp),
			);
		} else if (drag.type === 'row') {
			const deltaY = event.clientY - drag.startPos;
			const height = computeResizedRowHeight(drag.initialRowHeight ?? DEFAULT_ROW_HEIGHT, deltaY);
			this.resizeRow.emit({ index: drag.index, height });
		}
	}
}
