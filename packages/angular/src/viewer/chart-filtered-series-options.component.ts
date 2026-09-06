/**
 * chart-filtered-series-options.component.ts: PowerPoint "Chart Filters"
 * series show/hide, plus a per-series editor for the cached label strings
 * behind "Value From Cells" (`c15:datalabelsRange`).
 *
 * Selector: `pptx-chart-filtered-series-options`
 *
 * Mirrors React's `ChartFilteredSeriesOptions.tsx`: for each currently
 * VISIBLE series (only shown when there is more than one), a row with its
 * name and a "hide" button; for each FILTERED series, a row with its name
 * (falling back to `chartData.filteredSeriesTitle`, then a generic label)
 * and a "show" button; for each series carrying a `dataLabelsRange`, one
 * text input per cached label string, labelled by the chart's category at
 * that point index.
 *
 * Both extensions were previously passthrough-only in core; see
 * `pptx-viewer-shared`'s `chart-ext-editor-actions.ts` for the pure
 * transforms (`hideChartSeries`, `restoreFilteredSeries`,
 * `setDataLabelsRangeCache`) this component wraps. Emits a complete new
 * `ChartPptxElement` via `elementChange`, holds no mutable state.
 *
 * @module angular-viewer/chart-filtered-series-options
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartFilteredSeries, PptxChartSeries } from 'pptx-viewer-core';

import {
	hideChartSeries,
	restoreFilteredSeries,
	setDataLabelsRangeCache,
} from '../internal/shared';
import { patchChartData } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { stringFromEvent } from './chart-event-helpers';

/** A visible series paired with its index in `chartData.series`. */
interface SeriesWithRangeRow {
	series: PptxChartSeries;
	index: number;
}

@Component({
	selector: 'pptx-chart-filtered-series-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideEye, LucideEyeOff],
	template: `
		@if (showSection()) {
			<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.chartFilters' | translate">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.chartFilters' | translate }}</h4>

				@if (series().length > 1) {
					<div class="pptx-chart-card__group">
						@for (s of series(); track $index; let i = $index) {
							<div class="pptx-chart-card__row">
								<span class="pptx-chart-card__name" [title]="s.name">{{ s.name }}</span>
								<button
									type="button"
									class="pptx-chart-card__clear"
									[disabled]="!canEdit()"
									[attr.aria-label]="'pptx.chart.hideSeries' | translate: { name: s.name }"
									[attr.title]="'pptx.chart.hideSeries' | translate: { name: s.name }"
									[attr.data-testid]="'chart-series-hide-' + i"
									(click)="onHideSeries(i)"
								>
									<svg lucideEyeOff class="h-3.5 w-3.5" aria-hidden="true"></svg>
								</button>
							</div>
						}
					</div>
				}

				@if (filteredSeries().length > 0) {
					<div class="pptx-chart-card__group">
						@for (f of filteredSeries(); track $index; let i = $index) {
							<div class="pptx-chart-card__row pptx-chart-filtered-row--dim">
								<span class="pptx-chart-card__name" [title]="filteredName(f)">{{
									filteredName(f)
								}}</span>
								<button
									type="button"
									class="pptx-chart-card__clear"
									[disabled]="!canEdit()"
									[attr.aria-label]="'pptx.chart.showSeries' | translate: { name: filteredName(f) }"
									[attr.title]="'pptx.chart.showSeries' | translate: { name: filteredName(f) }"
									[attr.data-testid]="'chart-series-show-' + i"
									(click)="onRestoreSeries(i)"
								>
									<svg lucideEye class="h-3.5 w-3.5" aria-hidden="true"></svg>
								</button>
							</div>
						}
					</div>
				}

				@for (row of seriesWithRange(); track row.index) {
					<div class="pptx-chart-card__group">
						<div class="pptx-chart-card__subhead" [title]="row.series.name">
							{{ 'pptx.chart.valueFromCells' | translate: { name: row.series.name } }}
						</div>
						@for (
							text of row.series.dataLabelOptions!.dataLabelsRange!.cache;
							track $index;
							let pi = $index
						) {
							<label class="pptx-chart-card__row">
								<span class="pptx-chart-card__label">{{ categoryLabel(pi) }}</span>
								<input
									type="text"
									class="pptx-chart-card__input"
									[disabled]="!canEdit()"
									[value]="text"
									[attr.data-testid]="'chart-dlbl-range-' + row.index + '-' + pi"
									(change)="onSetDataLabelsRangeCache(row.index, pi, $event)"
								/>
							</label>
						}
					</div>
				}
			</section>
		}
	`,
	styles: `
		${CHART_EDITOR_STYLES}

		.pptx-chart-filtered-row--dim {
			opacity: 0.6;
		}
	`,
})
export class ChartFilteredSeriesOptionsComponent {
	private readonly translate = inject(TranslateService);

	/** The chart element being edited. */
	readonly element = input.required<ChartPptxElement>();
	/** Whether editing is enabled (read-only mode when false). */
	readonly canEdit = input<boolean>(true);
	/** Emits the updated element after a hide/restore/label-cache edit. */
	readonly elementChange = output<ChartPptxElement>();

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);

	protected readonly filteredSeries = computed<PptxChartFilteredSeries[]>(
		() => this.element().chartData?.filteredSeries ?? [],
	);

	protected readonly categories = computed<string[]>(
		() => this.element().chartData?.categories ?? [],
	);

	protected readonly seriesWithRange = computed<SeriesWithRangeRow[]>(() =>
		this.series()
			.map((series, index): SeriesWithRangeRow => ({ series, index }))
			.filter((row) => row.series.dataLabelOptions?.dataLabelsRange),
	);

	protected readonly showSection = computed(
		() =>
			this.filteredSeries().length > 0 ||
			this.seriesWithRange().length > 0 ||
			this.series().length > 1,
	);

	/** Filtered-series display name: cached name, then the chart-wide fallback title, then a generic label. */
	protected filteredName(filtered: PptxChartFilteredSeries): string {
		return (
			filtered.name ??
			this.element().chartData?.filteredSeriesTitle ??
			this.translate.instant('pptx.chart.seriesShort')
		);
	}

	/** The category label for a cached data-label-range point, falling back to its raw index. */
	protected categoryLabel(pointIndex: number): string {
		return this.categories()[pointIndex] ?? String(pointIndex);
	}

	protected onHideSeries(seriesIndex: number): void {
		const chartData = this.element().chartData;
		const next = chartData && hideChartSeries(chartData, seriesIndex);
		if (next) {
			this.elementChange.emit(patchChartData(this.element(), next));
		}
	}

	protected onRestoreSeries(filteredIndex: number): void {
		const chartData = this.element().chartData;
		const next = chartData && restoreFilteredSeries(chartData, filteredIndex);
		if (next) {
			this.elementChange.emit(patchChartData(this.element(), next));
		}
	}

	protected onSetDataLabelsRangeCache(seriesIndex: number, pointIndex: number, event: Event): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		const text = stringFromEvent(event);
		if (text === null) {
			return;
		}
		const series = chartData.series.map((s, i) =>
			i === seriesIndex ? setDataLabelsRangeCache(s, pointIndex, text) : s,
		);
		this.elementChange.emit(patchChartData(this.element(), { series }));
	}
}
