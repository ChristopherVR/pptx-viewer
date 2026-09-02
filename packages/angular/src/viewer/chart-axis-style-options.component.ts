/**
 * chart-axis-style-options.component.ts: Per-axis log scaling, title font, and
 * gridline line styling. Selector: `pptx-chart-axis-style-options`.
 *
 * Mirrors React's `ChartAxisStyleOptions.tsx`: log scale (value/date axes)
 * with a base, axis-title font family/size/bold/colour, and major/minor
 * gridline colour/width/dash (shown only when enabled). Routes through
 * `setAxisLogScale` / `setAxisTitleStyle` / `setGridlineStyle`.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	ChartPptxElement,
	PptxChartAxisFormatting,
	PptxChartAxisType,
} from 'pptx-viewer-core';

import { GRIDLINE_DASH_OPTIONS } from '../internal/shared';
import { setAxisLogScale, setAxisTitleStyle, setGridlineStyle } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { boolFromEvent, numFromEvent, selectValue, stringFromEvent } from './chart-event-helpers';

interface AxisRow {
	type: PptxChartAxisType;
	labelKey: string;
	hasScale: boolean;
	axis: PptxChartAxisFormatting;
}

const AXIS_DEFS: ReadonlyArray<{ type: PptxChartAxisType; labelKey: string; hasScale: boolean }> = [
	{ type: 'valAx', labelKey: 'pptx.chart.valueAxis', hasScale: true },
	{ type: 'dateAx', labelKey: 'pptx.chart.dateAxis', hasScale: true },
	{ type: 'catAx', labelKey: 'pptx.chart.categoryAxis', hasScale: false },
];

@Component({
	selector: 'pptx-chart-axis-style-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (rows().length > 0) {
			<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.axisStyling' | translate">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.axisStyling' | translate }}</h4>
				@for (row of rows(); track row.type) {
					<div class="pptx-chart-card__group">
						<div class="pptx-chart-card__subhead">{{ row.labelKey | translate }}</div>
						<div class="pptx-chart-card__group pptx-chart-card__group--indent">
							@if (row.hasScale) {
								<div class="pptx-chart-card__row">
									<label class="pptx-chart-card__check">
										<input
											type="checkbox"
											[disabled]="!canEdit()"
											[checked]="row.axis.logScale ?? false"
											(change)="onLogScale(row.type, row.axis, $event)"
										/>
										<span>{{ 'pptx.chart.logScale' | translate }}</span>
									</label>
									@if (row.axis.logScale) {
										<input
											type="number"
											min="2"
											class="pptx-chart-card__input pptx-chart-card__input--num"
											[title]="'pptx.chart.logBase' | translate"
											[disabled]="!canEdit()"
											[value]="row.axis.logBase ?? 10"
											(change)="onLogBase(row.type, $event)"
										/>
									}
								</div>
							}

							<div class="pptx-chart-card__row">
								<span class="pptx-chart-card__label">{{ 'pptx.chart.titleFont' | translate }}</span>
								<input
									type="text"
									class="pptx-chart-card__input"
									[placeholder]="'pptx.chart.auto' | translate"
									[disabled]="!canEdit()"
									[value]="row.axis.fontFamily ?? ''"
									(change)="onTitleFont(row.type, $event)"
								/>
								<input
									type="number"
									min="4"
									max="96"
									class="pptx-chart-card__input pptx-chart-card__input--num"
									[title]="'pptx.chart.fontSize' | translate"
									[placeholder]="'pptx.chart.auto' | translate"
									[disabled]="!canEdit()"
									[value]="row.axis.fontSize ?? ''"
									(change)="onTitleSize(row.type, $event)"
								/>
							</div>
							<div class="pptx-chart-card__row">
								<label class="pptx-chart-card__check">
									<input
										type="checkbox"
										[disabled]="!canEdit()"
										[checked]="row.axis.fontBold ?? false"
										(change)="onTitleBold(row.type, $event)"
									/>
									<span>{{ 'pptx.chart.bold' | translate }}</span>
								</label>
								<span class="pptx-chart-card__label">{{
									'pptx.chart.titleColor' | translate
								}}</span>
								<input
									type="color"
									class="pptx-chart-card__color"
									[disabled]="!canEdit()"
									[value]="row.axis.fontColor ?? '#000000'"
									(input)="onTitleColor(row.type, $event)"
								/>
							</div>

							@for (which of gridlineKinds; track which) {
								@if (gridlineEnabled(row.axis, which)) {
									<div class="pptx-chart-card__row">
										<span class="pptx-chart-card__label">
											{{
												(which === 'major'
													? 'pptx.chart.majorGridlines'
													: 'pptx.chart.minorGridlines'
												) | translate
											}}
										</span>
										<input
											type="color"
											class="pptx-chart-card__color"
											[title]="'pptx.chart.gridlineColor' | translate"
											[disabled]="!canEdit()"
											[value]="gridlineSpPr(row.axis, which)?.strokeColor ?? '#d9d9d9'"
											(input)="onGridlineColor(row.type, which, $event)"
										/>
										<input
											type="number"
											min="0.25"
											step="0.25"
											class="pptx-chart-card__input pptx-chart-card__input--num"
											[title]="'pptx.chart.gridlineWidth' | translate"
											[placeholder]="'pptx.chart.auto' | translate"
											[disabled]="!canEdit()"
											[value]="gridlineSpPr(row.axis, which)?.strokeWidth ?? ''"
											(change)="onGridlineWidth(row.type, which, $event)"
										/>
										<select
											class="pptx-chart-card__input"
											[title]="'pptx.chart.gridlineDash' | translate"
											[disabled]="!canEdit()"
											[value]="gridDash(row.axis, which)"
											(change)="onGridlineDash(row.type, which, $event)"
										>
											@for (opt of dashOptions; track opt.value) {
												<option
													[value]="opt.value"
													[selected]="opt.value === gridDash(row.axis, which)"
												>
													{{ opt.labelKey | translate }}
												</option>
											}
										</select>
									</div>
								}
							}
						</div>
					</div>
				}
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartAxisStyleOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly dashOptions = GRIDLINE_DASH_OPTIONS;
	protected readonly gridlineKinds = ['major', 'minor'] as const;

	protected readonly rows = computed<AxisRow[]>(() => {
		const axes = this.element().chartData?.axes ?? [];
		const result: AxisRow[] = [];
		for (const def of AXIS_DEFS) {
			const axis = axes.find((a) => a.axisType === def.type);
			if (axis) {
				result.push({ ...def, axis });
			}
		}
		return result;
	});

	protected gridlineEnabled(axis: PptxChartAxisFormatting, which: 'major' | 'minor'): boolean {
		return which === 'major' ? (axis.majorGridlines ?? false) : (axis.minorGridlines ?? false);
	}

	protected gridlineSpPr(axis: PptxChartAxisFormatting, which: 'major' | 'minor') {
		return which === 'major' ? axis.majorGridlinesSpPr : axis.minorGridlinesSpPr;
	}

	protected gridDash(axis: PptxChartAxisFormatting, which: 'major' | 'minor'): string {
		return this.gridlineSpPr(axis, which)?.strokeDashStyle ?? '';
	}
	protected onLogScale(
		axisType: PptxChartAxisType,
		axis: PptxChartAxisFormatting,
		event: Event,
	): void {
		this.elementChange.emit(
			setAxisLogScale(this.element(), axisType, {
				enabled: boolFromEvent(event),
				base: axis.logBase,
			}),
		);
	}

	protected onLogBase(axisType: PptxChartAxisType, event: Event): void {
		const num = numFromEvent(event);
		if (typeof num !== 'number' || num <= 1) {
			return;
		}
		this.elementChange.emit(
			setAxisLogScale(this.element(), axisType, { enabled: true, base: num }),
		);
	}

	protected onTitleFont(axisType: PptxChartAxisType, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setAxisTitleStyle(this.element(), axisType, { fontFamily: value || null }),
		);
	}

	protected onTitleSize(axisType: PptxChartAxisType, event: Event): void {
		const num = numFromEvent(event);
		if (num === undefined) {
			return;
		}
		this.elementChange.emit(setAxisTitleStyle(this.element(), axisType, { fontSize: num }));
	}

	protected onTitleBold(axisType: PptxChartAxisType, event: Event): void {
		this.elementChange.emit(
			setAxisTitleStyle(this.element(), axisType, { fontBold: boolFromEvent(event) }),
		);
	}

	protected onTitleColor(axisType: PptxChartAxisType, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(setAxisTitleStyle(this.element(), axisType, { fontColor: value }));
	}

	protected onGridlineColor(
		axisType: PptxChartAxisType,
		which: 'major' | 'minor',
		event: Event,
	): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(setGridlineStyle(this.element(), axisType, which, { color: value }));
	}

	protected onGridlineWidth(
		axisType: PptxChartAxisType,
		which: 'major' | 'minor',
		event: Event,
	): void {
		const num = numFromEvent(event);
		if (num === undefined) {
			return;
		}
		this.elementChange.emit(setGridlineStyle(this.element(), axisType, which, { width: num }));
	}

	protected onGridlineDash(
		axisType: PptxChartAxisType,
		which: 'major' | 'minor',
		event: Event,
	): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setGridlineStyle(this.element(), axisType, which, { dashStyle: value || null }),
		);
	}
}
