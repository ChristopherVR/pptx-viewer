/**
 * chart-axis-options.component.ts: Per-axis scale + label formatting controls.
 *
 * Selector: `pptx-chart-axis-options`
 *
 * Mirrors React's `ChartAxisOptions.tsx`: for each axis present on the chart it
 * exposes min/max/major-unit/minor-unit (scaled axes only), display units, axis
 * title text, number format, tick-label position, and major/minor gridline
 * visibility. Edits route through the headless `setChartAxis` core op (via the
 * `setAxis` immutable wrapper) and emit a new `ChartPptxElement`.
 *
 * @module angular-viewer/chart-axis-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type {
	ChartAxisEdit,
	ChartPptxElement,
	PptxChartAxisFormatting,
	PptxChartAxisType,
} from 'pptx-viewer-core';

import type { ChartTickLabelPosition } from '../internal/shared';
import { DISPLAY_UNITS_OPTIONS, TICK_LABEL_POSITION_OPTIONS } from '../internal/shared';
import { setAxis } from './chart-advanced-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { boolFromEvent, numFromEvent, selectValue, stringFromEvent } from './chart-event-helpers';

/** Axis kinds the inspector exposes, with their label and whether they scale. */
interface AxisRow {
	type: PptxChartAxisType;
	label: string;
	hasScale: boolean;
	axis: PptxChartAxisFormatting;
}

const AXIS_DEFS: ReadonlyArray<{ type: PptxChartAxisType; label: string; hasScale: boolean }> = [
	{ type: 'valAx', label: 'Value axis', hasScale: true },
	{ type: 'dateAx', label: 'Date axis', hasScale: true },
	{ type: 'catAx', label: 'Category axis', hasScale: false },
];

/** Numeric scale fields, paired with their label, rendered for scaled axes. */
const SCALE_FIELDS: ReadonlyArray<{
	key: 'min' | 'max' | 'majorUnit' | 'minorUnit';
	label: string;
}> = [
	{ key: 'min', label: 'Minimum' },
	{ key: 'max', label: 'Maximum' },
	{ key: 'majorUnit', label: 'Major unit' },
	{ key: 'minorUnit', label: 'Minor unit' },
];

@Component({
	selector: 'pptx-chart-axis-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (rows().length > 0) {
			<section class="pptx-chart-card" aria-label="Axis options">
				<h4 class="pptx-chart-card__heading">Axes</h4>
				@for (row of rows(); track row.type) {
					<div class="pptx-chart-card__group">
						<div class="pptx-chart-card__subhead">{{ row.label }}</div>
						<div class="pptx-chart-card__group pptx-chart-card__group--indent">
							@if (row.hasScale) {
								@for (field of scaleFields; track field.key) {
									<label class="pptx-chart-card__row">
										<span class="pptx-chart-card__label">{{ field.label }}</span>
										<input
											type="number"
											class="pptx-chart-card__input"
											placeholder="Auto"
											[disabled]="!canEdit()"
											[value]="numValue(row.axis, field.key)"
											(change)="onScaleField(row.type, field.key, $event)"
										/>
									</label>
								}
								<label class="pptx-chart-card__row">
									<span class="pptx-chart-card__label">Display units</span>
									<select
										class="pptx-chart-card__input"
										[disabled]="!canEdit()"
										[value]="row.axis.displayUnits ?? ''"
										(change)="onDisplayUnits(row.type, $event)"
									>
										@for (opt of displayUnitOptions; track opt.value) {
											<option [value]="opt.value">{{ opt.label }}</option>
										}
									</select>
								</label>
							}

							<label class="pptx-chart-card__row">
								<span class="pptx-chart-card__label">Axis title</span>
								<input
									type="text"
									class="pptx-chart-card__input"
									placeholder="Axis title"
									[disabled]="!canEdit()"
									[value]="row.axis.titleText ?? ''"
									(change)="onTitleText(row.type, $event)"
								/>
							</label>

							<label class="pptx-chart-card__row">
								<span class="pptx-chart-card__label">Number format</span>
								<input
									type="text"
									class="pptx-chart-card__input"
									placeholder="General"
									[disabled]="!canEdit()"
									[value]="row.axis.numFmt?.formatCode ?? ''"
									(change)="onNumberFormat(row.type, $event)"
								/>
							</label>

							<label class="pptx-chart-card__row">
								<span class="pptx-chart-card__label">Tick labels</span>
								<select
									class="pptx-chart-card__input"
									[disabled]="!canEdit()"
									[value]="row.axis.tickLblPos ?? 'nextTo'"
									(change)="onTickPosition(row.type, $event)"
								>
									@for (opt of tickPositionOptions; track opt.value) {
										<option [value]="opt.value">{{ opt.label }}</option>
									}
								</select>
							</label>

							<label class="pptx-chart-card__check">
								<input
									type="checkbox"
									[disabled]="!canEdit()"
									[checked]="row.axis.majorGridlines ?? false"
									(change)="onGridlines(row.type, 'major', $event)"
								/>
								<span>Major gridlines</span>
							</label>
							<label class="pptx-chart-card__check">
								<input
									type="checkbox"
									[disabled]="!canEdit()"
									[checked]="row.axis.minorGridlines ?? false"
									(change)="onGridlines(row.type, 'minor', $event)"
								/>
								<span>Minor gridlines</span>
							</label>
						</div>
					</div>
				}
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartAxisOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly scaleFields = SCALE_FIELDS;
	protected readonly displayUnitOptions = DISPLAY_UNITS_OPTIONS;
	protected readonly tickPositionOptions = TICK_LABEL_POSITION_OPTIONS;

	/** Only the axes that actually exist on the chart (pie charts have none). */
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

	protected numValue(
		axis: PptxChartAxisFormatting,
		key: 'min' | 'max' | 'majorUnit' | 'minorUnit',
	): string {
		const value = axis[key];
		return value === undefined ? '' : String(value);
	}

	protected onScaleField(
		axisType: PptxChartAxisType,
		key: 'min' | 'max' | 'majorUnit' | 'minorUnit',
		event: Event,
	): void {
		const num = numFromEvent(event);
		if (num === undefined) {
			return;
		}
		this.emit(axisType, { [key]: num });
	}

	protected onDisplayUnits(axisType: PptxChartAxisType, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.emit(axisType, {
			displayUnits: (value || null) as ChartAxisEdit['displayUnits'],
		});
	}

	protected onTitleText(axisType: PptxChartAxisType, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.emit(axisType, { title: value });
	}

	protected onNumberFormat(axisType: PptxChartAxisType, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.emit(axisType, { numberFormat: value });
	}

	protected onTickPosition(axisType: PptxChartAxisType, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.emit(axisType, { tickLabelPosition: value as ChartTickLabelPosition });
	}

	protected onGridlines(axisType: PptxChartAxisType, which: 'major' | 'minor', event: Event): void {
		const checked = boolFromEvent(event);
		this.emit(
			axisType,
			which === 'major' ? { majorGridlines: checked } : { minorGridlines: checked },
		);
	}

	private emit(axisType: PptxChartAxisType, edit: ChartAxisEdit): void {
		this.elementChange.emit(setAxis(this.element(), axisType, edit));
	}
}
