/**
 * chart-combo-type-options.component.ts: Per-series combo chart-type controls.
 *
 * Selector: `pptx-chart-combo-type-options`
 *
 * Mirrors React's `ChartComboTypeOptions.tsx`: for cartesian charts (and existing
 * combos) with 2+ series, each series gets a chart-type selector so it can be
 * plotted with a different type (e.g. a line series inside a bar chart). Routes
 * through the `setSeriesChartType` immutable wrapper and emits a new
 * `ChartPptxElement`.
 *
 * @module angular-viewer/chart-combo-type-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';

import { COMBO_SERIES_TYPE_OPTIONS, COMBO_SUPPORTED_TYPES } from '../internal/shared';
import { setSeriesChartType } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { selectValue } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-combo-type-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (supported()) {
			<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.comboTypes' | translate">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.comboTypes' | translate }}</h4>
				<div class="pptx-chart-card__group">
					@for (s of series(); track $index; let i = $index) {
						<div class="pptx-chart-card__row">
							<span class="pptx-chart-card__name" [title]="s.name">{{ s.name }}</span>
							<select
								class="pptx-chart-card__input"
								[disabled]="!canEdit()"
								[value]="s.seriesChartType ?? ''"
								(change)="onType(i, $event)"
							>
								@for (opt of typeOptions; track opt.value) {
									<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
								}
							</select>
						</div>
					}
				</div>
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartComboTypeOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly typeOptions = COMBO_SERIES_TYPE_OPTIONS;

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);

	protected readonly supported = computed(() => {
		const type = this.element().chartData?.chartType as PptxChartType | undefined;
		return type !== undefined && COMBO_SUPPORTED_TYPES.has(type) && this.series().length >= 2;
	});

	protected onType(index: number, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setSeriesChartType(this.element(), index, value === '' ? null : (value as PptxChartType)),
		);
	}
}
