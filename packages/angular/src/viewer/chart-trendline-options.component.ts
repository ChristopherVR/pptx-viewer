/**
 * chart-trendline-options.component.ts: Per-series trendline controls.
 *
 * Selector: `pptx-chart-trendline-options`
 *
 * Mirrors React's `ChartTrendlineOptions.tsx`: for bar/line/area/scatter/bubble
 * charts, each series gets a trendline-type selector plus (when a trendline is
 * set) display-equation and display-R-squared toggles. Routes through the
 * `setSeriesTrendline` immutable wrapper and emits a new `ChartPptxElement`.
 *
 * @module angular-viewer/chart-trendline-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	ChartPptxElement,
	PptxChartSeries,
	PptxChartTrendline,
	PptxChartType,
} from 'pptx-viewer-core';

import { TRENDLINE_SUPPORTED_TYPES, TRENDLINE_TYPE_OPTIONS } from '../internal/shared';
import { setSeriesTrendline } from './chart-advanced-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { boolFromEvent, selectValue } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-trendline-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (supported()) {
			<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.trendlines' | translate">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.trendlines' | translate }}</h4>
				@for (s of series(); track $index; let i = $index) {
					<div class="pptx-chart-card__group">
						<div class="pptx-chart-card__row">
							<span class="pptx-chart-card__name" [title]="s.name">{{ s.name }}</span>
							<select
								class="pptx-chart-card__input"
								[disabled]="!canEdit()"
								[value]="trendlineOf(s)?.trendlineType ?? ''"
								(change)="onType(i, s, $event)"
							>
								@for (opt of typeOptions; track opt.value) {
									<option [value]="opt.value">{{ opt.label }}</option>
								}
							</select>
						</div>

						@if (trendlineOf(s); as tl) {
							<div class="pptx-chart-card__row pptx-chart-card__group--indent">
								<label class="pptx-chart-card__check">
									<input
										type="checkbox"
										[disabled]="!canEdit()"
										[checked]="tl.displayEq ?? false"
										(change)="onToggleEq(i, tl, $event)"
									/>
									<span>{{ 'pptx.chart.trendlineEquation' | translate }}</span>
								</label>
								<label class="pptx-chart-card__check">
									<input
										type="checkbox"
										[disabled]="!canEdit()"
										[checked]="tl.displayRSq ?? false"
										(change)="onToggleRSq(i, tl, $event)"
									/>
									<span>{{ 'pptx.chart.trendlineRSquared' | translate }}</span>
								</label>
							</div>
						}
					</div>
				}
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartTrendlineOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly typeOptions = TRENDLINE_TYPE_OPTIONS;

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);

	protected readonly supported = computed(() => {
		const type = this.element().chartData?.chartType as PptxChartType | undefined;
		return type !== undefined && TRENDLINE_SUPPORTED_TYPES.has(type) && this.series().length > 0;
	});

	protected trendlineOf(s: PptxChartSeries): PptxChartTrendline | undefined {
		return s.trendlines?.[0];
	}

	protected onType(index: number, s: PptxChartSeries, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		if (value === '') {
			this.elementChange.emit(setSeriesTrendline(this.element(), index, null));
			return;
		}
		const existing = this.trendlineOf(s);
		this.elementChange.emit(
			setSeriesTrendline(this.element(), index, {
				...existing,
				trendlineType: value as PptxChartTrendline['trendlineType'],
			}),
		);
	}

	protected onToggleEq(index: number, tl: PptxChartTrendline, event: Event): void {
		this.elementChange.emit(
			setSeriesTrendline(this.element(), index, { ...tl, displayEq: boolFromEvent(event) }),
		);
	}

	protected onToggleRSq(index: number, tl: PptxChartTrendline, event: Event): void {
		this.elementChange.emit(
			setSeriesTrendline(this.element(), index, { ...tl, displayRSq: boolFromEvent(event) }),
		);
	}
}
