/**
 * chart-datapoint-marker-options.component.ts: Per-data-point marker overrides.
 *
 * Selector: `pptx-chart-datapoint-marker-options`
 *
 * Mirrors React's `ChartDataPointMarkerOptions.tsx`, the one advanced chart
 * control Angular had never been given: `pptx-chart-datapoint-options` covers a
 * point's fill and slice explosion, but a `c:dPt` can also carry its own
 * `c:marker`, which replaces the series marker for that point alone (the usual
 * use is calling out a single outlier on an otherwise uniform line).
 *
 * The checkbox is the presence of the override, not a value: ticking it seeds a
 * circle, clearing it removes the whole `c:dPt/c:marker`. Edits route through
 * `setDataPointMarker`, which wraps core's headless op, so the `c:dPt`
 * bookkeeping matches React, Vue, Svelte and Vanilla exactly.
 *
 * @module angular-viewer/chart-datapoint-marker-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	ChartPptxElement,
	PptxChartMarker,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartType,
} from 'pptx-viewer-core';

import { MARKER_SUPPORTED_TYPES, MARKER_SYMBOL_OPTIONS } from '../internal/shared';
import { setDataPointMarker } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { boolFromEvent, numFromEvent, selectValue, stringFromEvent } from './chart-event-helpers';

/** Concrete symbols only; '' is the "series default" sentinel, which the
 * presence checkbox already expresses. */
const SYMBOL_OPTIONS = MARKER_SYMBOL_OPTIONS.filter((option) => option.value !== '');

@Component({
	selector: 'pptx-chart-datapoint-marker-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (supported()) {
			<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.pointMarkers' | translate">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.pointMarkers' | translate }}</h4>

				@if (series().length > 1) {
					<label class="pptx-chart-card__row">
						<span class="pptx-chart-card__label">{{ 'pptx.chart.series' | translate }}</span>
						<select
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
							<label class="pptx-chart-card__check">
								<input
									type="checkbox"
									[disabled]="!canEdit()"
									[checked]="markerAt(ci) !== undefined"
									(change)="onToggle(ci, $event)"
								/>
								{{ 'pptx.chart.markerOverride' | translate }}
							</label>
						</div>

						@if (markerAt(ci); as marker) {
							<div class="pptx-chart-card__row pptx-chart-card__group--indent">
								<select
									class="pptx-chart-card__input"
									[disabled]="!canEdit()"
									[value]="marker.symbol"
									(change)="onSymbol(ci, $event)"
								>
									@for (opt of symbolOptions; track opt.value) {
										<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
									}
								</select>
								<input
									type="number"
									min="1"
									max="20"
									class="pptx-chart-card__input pptx-chart-card__input--num"
									[title]="'pptx.chart.markerSize' | translate"
									[placeholder]="'pptx.chart.auto' | translate"
									[disabled]="!canEdit()"
									[value]="marker.size ?? ''"
									(change)="onSize(ci, $event)"
								/>
								<input
									type="color"
									class="pptx-chart-card__color"
									[title]="'pptx.chart.markerFill' | translate"
									[disabled]="!canEdit()"
									[value]="marker.spPr?.fillColor ?? '#4472c4'"
									(input)="onFill(ci, $event)"
								/>
							</div>
						}
					}
				</div>
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartDatapointMarkerOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly symbolOptions = SYMBOL_OPTIONS;

	private readonly seriesIndex = signal(0);

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);
	protected readonly categories = computed<string[]>(
		() => this.element().chartData?.categories ?? [],
	);

	/** Clamp the picker: removing a series must not strand the index past the end. */
	protected readonly activeIndex = computed(() =>
		Math.min(this.seriesIndex(), Math.max(0, this.series().length - 1)),
	);

	protected readonly supported = computed(() => {
		const type = this.element().chartData?.chartType as PptxChartType | undefined;
		return (
			type !== undefined &&
			MARKER_SUPPORTED_TYPES.has(type) &&
			this.series().length > 0 &&
			this.categories().length > 0
		);
	});

	protected markerAt(pointIndex: number): PptxChartMarker | undefined {
		return this.series()[this.activeIndex()]?.dataPoints?.find((p) => p.idx === pointIndex)?.marker;
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

	protected onToggle(pointIndex: number, event: Event): void {
		this.emit(pointIndex, boolFromEvent(event) ? { symbol: 'circle' } : null);
	}

	protected onSymbol(pointIndex: number, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.emit(pointIndex, { symbol: value as PptxChartMarkerSymbol });
	}

	protected onSize(pointIndex: number, event: Event): void {
		const num = numFromEvent(event);
		this.emit(pointIndex, { size: typeof num === 'number' ? num : undefined });
	}

	protected onFill(pointIndex: number, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.emit(pointIndex, { fillColor: value });
	}

	private emit(
		pointIndex: number,
		marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
	): void {
		this.elementChange.emit(
			setDataPointMarker(this.element(), this.activeIndex(), pointIndex, marker),
		);
	}
}
