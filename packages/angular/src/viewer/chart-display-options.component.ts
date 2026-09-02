/**
 * chart-display-options.component.ts: Chart-level display toggles.
 *
 * Selector: `pptx-chart-display-options`
 *
 * Mirrors React's `ChartDisplayOptions.tsx`: show/hide title, legend (with
 * position), gridlines, and the data-labels master toggle. Emits a complete new
 * `ChartPptxElement` via `elementChange` after each edit; holds no mutable state.
 *
 * @module angular-viewer/chart-display-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartLegendPosition } from 'pptx-viewer-core';

import {
	chartGridlinesPatch,
	chartGridlinesState,
	LEGEND_POSITION_OPTIONS,
} from '../internal/shared';
import { setDataLabels, setLegend } from './chart-advanced-helpers';
import { patchChartData, patchChartStyle } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { boolFromEvent, selectValue } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-display-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.display' | translate">
			<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.display' | translate }}</h4>
			<div class="pptx-chart-card__group">
				<label class="pptx-chart-card__check">
					<input
						type="checkbox"
						[disabled]="!canEdit()"
						[checked]="style().hasTitle ?? false"
						(change)="onToggleTitle($event)"
					/>
					<span>{{ 'pptx.chart.showTitle' | translate }}</span>
				</label>

				<label class="pptx-chart-card__check">
					<input
						type="checkbox"
						[disabled]="!canEdit()"
						[checked]="style().hasLegend ?? false"
						(change)="onToggleLegend($event)"
					/>
					<span>{{ 'pptx.chart.showLegend' | translate }}</span>
				</label>

				@if (style().hasLegend) {
					<label class="pptx-chart-card__row pptx-chart-card__group--indent">
						<span class="pptx-chart-card__label">{{
							'pptx.chart.legendPosition' | translate
						}}</span>
						<select
							[attr.aria-label]="'pptx.chart.legendPosition' | translate"
							class="pptx-chart-card__input"
							[disabled]="!canEdit()"
							[value]="style().legendPosition ?? 'b'"
							(change)="onLegendPosition($event)"
						>
							@for (opt of legendPositions; track opt.value) {
								<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
							}
						</select>
					</label>
				}

				<label class="pptx-chart-card__check">
					<input
						type="checkbox"
						[disabled]="!canEdit()"
						[checked]="gridlinesShown()"
						(change)="onToggleGridlines($event)"
					/>
					<span>{{ 'pptx.chart.showGridlines' | translate }}</span>
				</label>

				<label class="pptx-chart-card__check">
					<input
						type="checkbox"
						[disabled]="!canEdit()"
						[checked]="style().hasDataLabels ?? false"
						(change)="onToggleDataLabels($event)"
					/>
					<span>{{ 'pptx.chart.showDataLabels' | translate }}</span>
				</label>
			</div>
		</section>
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartDisplayOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly legendPositions = LEGEND_POSITION_OPTIONS;
	protected readonly style = computed(() => this.element().chartData?.style ?? {});
	/**
	 * Read from the primary value axis's `majorGridlines`, matching what the
	 * cartesian renderer actually draws; `style.hasGridlines` alone is a legacy
	 * field the renderer never reads, so wiring the checkbox straight to it
	 * silently did nothing (see `chart-gridlines-toggle.ts` in shared).
	 */
	protected readonly gridlinesShown = computed(() => {
		const chartData = this.element().chartData;
		return chartData ? chartGridlinesState(chartData) : false;
	});

	protected onToggleTitle(event: Event): void {
		this.elementChange.emit(patchChartStyle(this.element(), { hasTitle: boolFromEvent(event) }));
	}

	protected onToggleLegend(event: Event): void {
		this.elementChange.emit(setLegend(this.element(), { show: boolFromEvent(event) }));
	}

	protected onLegendPosition(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setLegend(this.element(), { position: value as PptxChartLegendPosition }),
		);
	}

	protected onToggleGridlines(event: Event): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), chartGridlinesPatch(chartData, boolFromEvent(event))),
		);
	}

	protected onToggleDataLabels(event: Event): void {
		// Route through the dedicated op so content keys initialise consistently.
		this.elementChange.emit(setDataLabels(this.element(), { show: boolFromEvent(event) }));
	}
}
