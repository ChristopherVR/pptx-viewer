/**
 * chart-datapoint-options.component.ts: Per-data-point fill + slice explosion.
 *
 * Selector: `pptx-chart-datapoint-options`
 *
 * Mirrors React's `ChartDataPointOptions.tsx`: a series picker (per-point edits
 * target one series at a time) and, per category, a fill-colour override (with a
 * clear button) plus a pie/doughnut slice-explosion amount for the chart types
 * that support it. Routes through `setDataPointFill` / `setDataPointExplosion`
 * and emits a new `ChartPptxElement`.
 *
 * @module angular-viewer/chart-datapoint-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	ChartPptxElement,
	PptxChartDataPoint,
	PptxChartSeries,
	PptxChartType,
} from 'pptx-viewer-core';

import { EXPLOSION_SUPPORTED_TYPES } from '../internal/shared';
import { setDataPointExplosion, setDataPointFill } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { numFromEvent, selectValue, stringFromEvent } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-datapoint-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (categories().length > 0 && series().length > 0) {
			<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.dataPoints' | translate">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.dataPoints' | translate }}</h4>

				@if (series().length > 1) {
					<label class="pptx-chart-card__row">
						<span class="pptx-chart-card__label">{{ 'pptx.chart.series' | translate }}</span>
						<select
							[attr.aria-label]="'pptx.chart.series' | translate"
							class="pptx-chart-card__input"
							[disabled]="!canEdit()"
							[value]="activeIndex()"
							(change)="onSeries($event)"
						>
							@for (s of series(); track $index; let i = $index) {
								<option [value]="i">{{ s.name }}</option>
							}
						</select>
					</label>
				}

				<div class="pptx-chart-card__group">
					@for (cat of categories(); track $index; let ci = $index) {
						<div class="pptx-chart-card__row">
							<span class="pptx-chart-card__name" [title]="cat">{{ cat }}</span>
							<input
								type="color"
								class="pptx-chart-card__color"
								[title]="'pptx.chart.pointFill' | translate"
								[disabled]="!canEdit()"
								[value]="pointFill(ci)"
								(input)="onFill(ci, $event)"
							/>
							@if (pointAt(ci)?.spPr?.fillColor) {
								<button
									type="button"
									class="pptx-chart-card__clear"
									[title]="'pptx.chart.pointFillClear' | translate"
									[disabled]="!canEdit()"
									(click)="onClearFill(ci)"
								>
									&times;
								</button>
							}
							@if (showExplosion()) {
								<input
									type="number"
									min="0"
									max="100"
									class="pptx-chart-card__input pptx-chart-card__input--num"
									[title]="'pptx.chart.pointExplosion' | translate"
									placeholder="0"
									[disabled]="!canEdit()"
									[value]="pointAt(ci)?.explosion ?? ''"
									(change)="onExplosion(ci, $event)"
								/>
							}
						</div>
					}
				</div>
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartDatapointOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	private readonly seriesIndex = signal(0);

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);
	protected readonly categories = computed<string[]>(
		() => this.element().chartData?.categories ?? [],
	);

	/** Clamp the chosen series index to the current series count. */
	protected readonly activeIndex = computed(() =>
		Math.min(this.seriesIndex(), Math.max(0, this.series().length - 1)),
	);

	protected readonly showExplosion = computed(() => {
		const type = this.element().chartData?.chartType as PptxChartType | undefined;
		return type !== undefined && EXPLOSION_SUPPORTED_TYPES.has(type);
	});

	protected pointAt(pointIndex: number): PptxChartDataPoint | undefined {
		return this.series()[this.activeIndex()]?.dataPoints?.find((p) => p.idx === pointIndex);
	}

	protected pointFill(pointIndex: number): string {
		const active = this.series()[this.activeIndex()];
		return this.pointAt(pointIndex)?.spPr?.fillColor ?? active?.color ?? '#4472c4';
	}

	protected onSeries(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		const num = Number.parseInt(value, 10);
		if (Number.isFinite(num)) {
			this.seriesIndex.set(num);
		}
	}

	protected onFill(pointIndex: number, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setDataPointFill(this.element(), this.activeIndex(), pointIndex, value),
		);
	}

	protected onClearFill(pointIndex: number): void {
		this.elementChange.emit(setDataPointFill(this.element(), this.activeIndex(), pointIndex, null));
	}

	protected onExplosion(pointIndex: number, event: Event): void {
		const num = numFromEvent(event);
		if (num === undefined) {
			return;
		}
		this.elementChange.emit(
			setDataPointExplosion(this.element(), this.activeIndex(), pointIndex, num),
		);
	}
}
