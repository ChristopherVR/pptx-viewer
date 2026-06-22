/**
 * chart-error-bar-options.component.ts: Per-series error-bar controls.
 *
 * Selector: `pptx-chart-error-bar-options`
 *
 * Mirrors React's `ChartErrorBarOptions.tsx`: for bar/line/area/scatter/bubble
 * charts, each series gets an error-bar value-type selector, and (when set) a
 * direction-type selector plus a numeric amount for the value types that take
 * one. Routes through the `setSeriesErrorBars` immutable wrapper and emits a new
 * `ChartPptxElement`.
 *
 * @module angular-viewer/chart-error-bar-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type {
	ChartPptxElement,
	PptxChartErrBars,
	PptxChartSeries,
	PptxChartType,
} from 'pptx-viewer-core';

import {
	ERROR_BAR_SUPPORTED_TYPES,
	ERROR_BAR_TYPE_OPTIONS,
	ERROR_BAR_VALTYPE_OPTIONS,
	ERROR_BAR_VALUE_TYPES,
} from '../internal/shared';
import { setSeriesErrorBars } from './chart-advanced-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { numFromEvent, selectValue } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-error-bar-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (supported()) {
			<section class="pptx-chart-card" aria-label="Error bar options">
				<h4 class="pptx-chart-card__heading">Error Bars</h4>
				@for (s of series(); track $index; let i = $index) {
					<div class="pptx-chart-card__group">
						<div class="pptx-chart-card__row">
							<span class="pptx-chart-card__name" [title]="s.name">{{ s.name }}</span>
							<select
								class="pptx-chart-card__input"
								[disabled]="!canEdit()"
								[value]="barsOf(s)?.valType ?? ''"
								(change)="onValType(i, s, $event)"
							>
								@for (opt of valTypeOptions; track opt.value) {
									<option [value]="opt.value">{{ opt.label }}</option>
								}
							</select>
						</div>

						@if (barsOf(s); as bars) {
							<div class="pptx-chart-card__row pptx-chart-card__group--indent">
								<select
									class="pptx-chart-card__input"
									[disabled]="!canEdit()"
									[value]="bars.barType"
									(change)="onBarType(i, bars, $event)"
								>
									@for (opt of barTypeOptions; track opt.value) {
										<option [value]="opt.value">{{ opt.label }}</option>
									}
								</select>
								@if (showValue(bars)) {
									<input
										type="number"
										class="pptx-chart-card__input pptx-chart-card__input--num"
										placeholder="Amount"
										[disabled]="!canEdit()"
										[value]="bars.val ?? ''"
										(change)="onValue(i, bars, $event)"
									/>
								}
							</div>
						}
					</div>
				}
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartErrorBarOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly valTypeOptions = ERROR_BAR_VALTYPE_OPTIONS;
	protected readonly barTypeOptions = ERROR_BAR_TYPE_OPTIONS;

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);

	protected readonly supported = computed(() => {
		const type = this.element().chartData?.chartType as PptxChartType | undefined;
		return type !== undefined && ERROR_BAR_SUPPORTED_TYPES.has(type) && this.series().length > 0;
	});

	protected barsOf(s: PptxChartSeries): PptxChartErrBars | undefined {
		return s.errBars?.[0];
	}

	protected showValue(bars: PptxChartErrBars): boolean {
		return ERROR_BAR_VALUE_TYPES.has(bars.valType);
	}

	protected onValType(index: number, s: PptxChartSeries, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		if (value === '') {
			this.elementChange.emit(setSeriesErrorBars(this.element(), index, null));
			return;
		}
		const existing = this.barsOf(s);
		this.elementChange.emit(
			setSeriesErrorBars(this.element(), index, {
				direction: existing?.direction ?? 'y',
				barType: existing?.barType ?? 'both',
				valType: value as PptxChartErrBars['valType'],
				val: existing?.val,
			}),
		);
	}

	protected onBarType(index: number, bars: PptxChartErrBars, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setSeriesErrorBars(this.element(), index, {
				...bars,
				barType: value as PptxChartErrBars['barType'],
			}),
		);
	}

	protected onValue(index: number, bars: PptxChartErrBars, event: Event): void {
		const num = numFromEvent(event);
		if (num === undefined) {
			return;
		}
		this.elementChange.emit(
			setSeriesErrorBars(this.element(), index, { ...bars, val: num ?? undefined }),
		);
	}
}
