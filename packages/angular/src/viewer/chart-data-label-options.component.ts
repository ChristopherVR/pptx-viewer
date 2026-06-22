/**
 * chart-data-label-options.component.ts: Chart-level data-label content +
 * position controls.
 *
 * Selector: `pptx-chart-data-label-options`
 *
 * Mirrors React's `ChartDataLabelOptions.tsx`: only renders when data labels are
 * switched on (the master toggle lives in `pptx-chart-display-options`). Lets the
 * user pick which content appears (value/category/series name/percent/legend key)
 * and the label position. Emits a complete new `ChartPptxElement`.
 *
 * @module angular-viewer/chart-data-label-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ChartPptxElement, PptxChartDataLabelOptions } from 'pptx-viewer-core';

import type { ChartDataLabelContentKey } from '../internal/shared';
import { DATA_LABEL_CONTENT_OPTIONS, DATA_LABEL_POSITION_OPTIONS } from '../internal/shared';
import { setDataLabels } from './chart-advanced-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { boolFromEvent, selectValue } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-data-label-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (style().hasDataLabels) {
			<section class="pptx-chart-card" aria-label="Data label options">
				<h4 class="pptx-chart-card__heading">Data Labels</h4>
				<div class="pptx-chart-card__group">
					@for (opt of contentOptions; track opt.key) {
						<label class="pptx-chart-card__check">
							<input
								type="checkbox"
								[disabled]="!canEdit()"
								[checked]="labels()[opt.key] ?? false"
								(change)="onToggleContent(opt.key, $event)"
							/>
							<span>{{ opt.label }}</span>
						</label>
					}

					<label class="pptx-chart-card__row">
						<span class="pptx-chart-card__label">Position</span>
						<select
							class="pptx-chart-card__input"
							[disabled]="!canEdit()"
							[value]="labels().position ?? ''"
							(change)="onPosition($event)"
						>
							@for (opt of positionOptions; track opt.value) {
								<option [value]="opt.value">{{ opt.label }}</option>
							}
						</select>
					</label>
				</div>
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartDataLabelOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly contentOptions = DATA_LABEL_CONTENT_OPTIONS;
	protected readonly positionOptions = DATA_LABEL_POSITION_OPTIONS;

	protected readonly style = computed(() => this.element().chartData?.style ?? {});
	protected readonly labels = computed<PptxChartDataLabelOptions>(
		() => this.style().dataLabels ?? {},
	);

	protected onToggleContent(key: ChartDataLabelContentKey, event: Event): void {
		this.elementChange.emit(setDataLabels(this.element(), { [key]: boolFromEvent(event) }));
	}

	protected onPosition(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setDataLabels(this.element(), {
				position: (value || undefined) as PptxChartDataLabelOptions['position'],
			}),
		);
	}
}
