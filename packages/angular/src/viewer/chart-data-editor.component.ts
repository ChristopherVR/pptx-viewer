/**
 * chart-data-editor.component.ts: Presentational chart data editor panel.
 *
 * Selector: `pptx-chart-data-editor`
 *
 * Renders a spreadsheet-like grid for editing chart series names, category
 * labels, and the value matrix.  Also provides buttons to add/remove series
 * and categories.  All mutations use the pure helpers in
 * `chart-data-helpers.ts` and are emitted via the `elementChange` output as
 * a complete new `ChartPptxElement`; the component holds no mutable state.
 *
 * The parent (typically `InspectorPanelComponent`) receives the emitted
 * element and commits it to `EditorStateService.updateElement()` as a single
 * history entry.
 *
 * Ported from the React inspector:
 *   packages/react/src/viewer/components/inspector/ChartDataGrid.tsx
 *   packages/react/src/viewer/components/inspector/ChartDataPanel.tsx
 *
 * Usage:
 * ```html
 * <pptx-chart-data-editor
 *   [element]="selectedElement"
 *   [canEdit]="canEdit"
 *   (elementChange)="onChartChange($event)"
 * />
 * ```
 *
 * @module angular-viewer/chart-data-editor
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ChartPptxElement } from 'pptx-viewer-core';

import {
	addCategory,
	addSeries,
	removeCategory,
	removeSeries,
	setCategoryLabel,
	setSeriesName,
	setSeriesValue,
} from './chart-data-helpers';

@Component({
	selector: 'pptx-chart-data-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="pptx-chart-editor" aria-label="Chart data editor">
			<header class="pptx-chart-editor__header">
				<h3 class="pptx-chart-editor__heading">Chart Data</h3>

				@if (canEdit()) {
					<div class="pptx-chart-editor__actions">
						<button
							type="button"
							class="pptx-chart-editor__btn"
							title="Add category"
							(click)="onAddCategory()"
						>
							+ Cat
						</button>
						<button
							type="button"
							class="pptx-chart-editor__btn pptx-chart-editor__btn--danger"
							[disabled]="catCount() <= 1"
							title="Remove last category"
							(click)="onRemoveLastCategory()"
						>
							- Cat
						</button>
						<button
							type="button"
							class="pptx-chart-editor__btn"
							title="Add series"
							(click)="onAddSeries()"
						>
							+ Series
						</button>
						<button
							type="button"
							class="pptx-chart-editor__btn pptx-chart-editor__btn--danger"
							[disabled]="seriesCount() <= 1"
							title="Remove last series"
							(click)="onRemoveLastSeries()"
						>
							- Series
						</button>
					</div>
				}
			</header>

			@if (hasData()) {
				<div class="pptx-chart-editor__scroll">
					<table class="pptx-chart-editor__table">
						<thead>
							<tr>
								<!-- Category gutter header -->
								<th class="pptx-chart-editor__corner"></th>
								@for (s of series(); track $index; let si = $index) {
									<th class="pptx-chart-editor__series-header">
										<!-- Editable series name -->
										<input
											type="text"
											class="pptx-chart-editor__name-input"
											[disabled]="!canEdit()"
											[value]="s.name"
											(change)="onSeriesNameChange($event, si)"
										/>
										@if (canEdit() && seriesCount() > 1) {
											<button
												type="button"
												class="pptx-chart-editor__remove-btn"
												title="Remove series {{ si + 1 }}"
												(click)="onRemoveSeries(si)"
											>
												×
											</button>
										}
									</th>
								}
							</tr>
						</thead>
						<tbody>
							@for (cat of categories(); track $index; let ci = $index) {
								<tr>
									<!-- Editable category label -->
									<td class="pptx-chart-editor__cat-cell">
										<div class="pptx-chart-editor__cat-wrap">
											<input
												type="text"
												class="pptx-chart-editor__cat-input"
												[disabled]="!canEdit()"
												[value]="cat"
												(change)="onCategoryLabelChange($event, ci)"
											/>
											@if (canEdit() && catCount() > 1) {
												<button
													type="button"
													class="pptx-chart-editor__remove-btn"
													title="Remove category {{ ci + 1 }}"
													(click)="onRemoveCategory(ci)"
												>
													×
												</button>
											}
										</div>
									</td>
									<!-- One value cell per series -->
									@for (s of series(); track $index; let si = $index) {
										<td class="pptx-chart-editor__value-cell">
											<input
												type="number"
												class="pptx-chart-editor__value-input"
												[disabled]="!canEdit()"
												[value]="s.values[ci] ?? 0"
												(change)="onValueChange($event, si, ci)"
											/>
										</td>
									}
								</tr>
							}
						</tbody>
					</table>
				</div>
			} @else {
				<p class="pptx-chart-editor__empty">No chart data available.</p>
			}
		</section>
	`,
	styles: `
		.pptx-chart-editor {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			padding: 0.5rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-chart-editor__header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.35rem;
			flex-wrap: wrap;
		}

		.pptx-chart-editor__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0;
		}

		.pptx-chart-editor__actions {
			display: flex;
			gap: 0.2rem;
			flex-wrap: wrap;
		}

		.pptx-chart-editor__btn {
			padding: 2px 5px;
			font-size: 10px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			white-space: nowrap;
		}

		.pptx-chart-editor__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-chart-editor__btn--danger {
			color: var(--pptx-inspector-danger, #f47c7c);
			border-color: var(--pptx-inspector-danger-border, #6b2a2a);
		}

		.pptx-chart-editor__scroll {
			overflow-x: auto;
		}

		.pptx-chart-editor__table {
			border-collapse: collapse;
			font-size: 11px;
			min-width: 100%;
		}

		.pptx-chart-editor__corner {
			min-width: 64px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-chart-editor__series-header {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #333);
			padding: 2px 3px;
			white-space: nowrap;
			min-width: 80px;
		}

		.pptx-chart-editor__name-input {
			width: 72px;
			box-sizing: border-box;
			padding: 2px 3px;
			font-size: 11px;
			background: transparent;
			border: 1px solid transparent;
			color: inherit;
			outline: none;
		}

		.pptx-chart-editor__name-input:focus {
			border-color: var(--pptx-inspector-active, #0078d4);
			background: var(--pptx-inspector-active-bg, #1a3a5c);
		}

		.pptx-chart-editor__name-input:disabled {
			opacity: 0.6;
		}

		.pptx-chart-editor__remove-btn {
			padding: 0 2px;
			font-size: 11px;
			line-height: 1;
			background: none;
			border: none;
			color: var(--pptx-inspector-danger, #f47c7c);
			cursor: pointer;
			vertical-align: middle;
		}

		.pptx-chart-editor__cat-cell {
			border: 1px solid var(--pptx-inspector-border, #333);
			padding: 1px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
		}

		.pptx-chart-editor__cat-wrap {
			display: flex;
			align-items: center;
			gap: 1px;
		}

		.pptx-chart-editor__cat-input {
			width: 60px;
			box-sizing: border-box;
			padding: 2px 3px;
			font-size: 11px;
			background: transparent;
			border: none;
			color: var(--pptx-inspector-muted, #aaa);
			outline: none;
		}

		.pptx-chart-editor__cat-input:focus {
			color: inherit;
			background: var(--pptx-inspector-active-bg, #1a3a5c);
		}

		.pptx-chart-editor__cat-input:disabled {
			opacity: 0.6;
		}

		.pptx-chart-editor__value-cell {
			border: 1px solid var(--pptx-inspector-border, #333);
			padding: 1px;
		}

		.pptx-chart-editor__value-input {
			width: 72px;
			box-sizing: border-box;
			padding: 2px 3px;
			font-size: 11px;
			text-align: right;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: none;
			color: inherit;
			outline: none;
		}

		.pptx-chart-editor__value-input:focus {
			background: var(--pptx-inspector-active-bg, #1a3a5c);
		}

		.pptx-chart-editor__value-input:disabled {
			opacity: 0.6;
		}

		/* Remove browser spin buttons on number inputs */
		.pptx-chart-editor__value-input::-webkit-outer-spin-button,
		.pptx-chart-editor__value-input::-webkit-inner-spin-button {
			-webkit-appearance: none;
			margin: 0;
		}

		.pptx-chart-editor__empty {
			font-size: 11px;
			color: var(--pptx-inspector-muted, #888);
			margin: 0.25rem 0;
		}
	`,
})
export class ChartDataEditorComponent {
	/** The chart element being edited. */
	readonly element = input.required<ChartPptxElement>();
	/** Whether editing is enabled (read-only mode when false). */
	readonly canEdit = input<boolean>(true);

	/** Emits the updated element after any edit operation. */
	readonly elementChange = output<ChartPptxElement>();

	// ── Computed helpers ────────────────────────────────────────────────────

	protected readonly hasData = computed(() => {
		const data = this.element().chartData;
		return data !== undefined && data.series.length > 0 && data.categories.length > 0;
	});

	protected readonly series = computed(() => this.element().chartData?.series ?? []);
	protected readonly categories = computed(() => this.element().chartData?.categories ?? []);
	protected readonly seriesCount = computed(() => this.series().length);
	protected readonly catCount = computed(() => this.categories().length);

	// ── Event handlers ──────────────────────────────────────────────────────

	protected onSeriesNameChange(event: Event, seriesIndex: number): void {
		const name = stringFromEvent(event);
		if (name === null) {
			return;
		}
		this.elementChange.emit(setSeriesName(this.element(), seriesIndex, name));
	}

	protected onCategoryLabelChange(event: Event, catIndex: number): void {
		const label = stringFromEvent(event);
		if (label === null) {
			return;
		}
		this.elementChange.emit(setCategoryLabel(this.element(), catIndex, label));
	}

	protected onValueChange(event: Event, seriesIndex: number, catIndex: number): void {
		const raw = stringFromEvent(event);
		if (raw === null) {
			return;
		}
		this.elementChange.emit(setSeriesValue(this.element(), seriesIndex, catIndex, raw));
	}

	protected onAddSeries(): void {
		this.elementChange.emit(addSeries(this.element()));
	}

	protected onRemoveLastSeries(): void {
		const last = this.seriesCount() - 1;
		if (last < 0) {
			return;
		}
		this.elementChange.emit(removeSeries(this.element(), last));
	}

	protected onRemoveSeries(seriesIndex: number): void {
		this.elementChange.emit(removeSeries(this.element(), seriesIndex));
	}

	protected onAddCategory(): void {
		this.elementChange.emit(addCategory(this.element()));
	}

	protected onRemoveLastCategory(): void {
		const last = this.catCount() - 1;
		if (last < 0) {
			return;
		}
		this.elementChange.emit(removeCategory(this.element(), last));
	}

	protected onRemoveCategory(catIndex: number): void {
		this.elementChange.emit(removeCategory(this.element(), catIndex));
	}
}

// ── Module-private helpers ───────────────────────────────────────────────────

/** Read the current string value from an `<input>` change event. */
function stringFromEvent(event: Event): string | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	return target.value;
}
