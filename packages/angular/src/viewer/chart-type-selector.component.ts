/**
 * chart-type-selector.component.ts: chart type / title / grouping inspector.
 *
 * Selector: `pptx-chart-type-selector`
 *
 * Angular port of the React `ChartTypeSelector`. Lets the user rename the
 * chart, change its type (routed through the shared `patchChartData`, which
 * clears grouping the new type doesn't support and adapts the category/series
 * shape via core's `chartDataChangeType`), and, for bar/line/area charts,
 * pick clustered/stacked/percent-stacked grouping. Every edit emits a
 * fully-updated element through `elementChange`, committed by the inspector
 * as one undoable history entry.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';

import type { ChartTypeSelectValue } from '../internal/shared';
import {
	CHART_TYPE_OPTIONS,
	collapseChartTitleRunsForEdit,
	GROUPING_OPTIONS,
	GROUPING_SUPPORTED_TYPES,
	patchChartData,
	resolveDisplayedChartType,
} from '../internal/shared';

/**
 * Apply an inspector patch (title/type/grouping) to a chart element, routing
 * it through the shared `patchChartData`. Exported standalone (rather than
 * kept private on the component) so it is directly testable without an
 * Angular TestBed, matching `action-settings-panel.component.ts`'s pattern.
 */
export function applyChartTypeSelectorPatch(
	element: ChartPptxElement,
	patch: Partial<PptxChartData>,
): ChartPptxElement | null {
	if (!element.chartData) {
		return null;
	}
	return { ...element, chartData: patchChartData(element.chartData, patch) };
}

@Component({
	selector: 'pptx-chart-type-selector',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (data(); as chartData) {
			<div class="pptx-cts">
				<label class="pptx-cts__field">
					<span class="pptx-cts__lbl">{{ 'pptx.chart.title' | translate }}</span>
					<input
						type="text"
						class="pptx-cts__input"
						[disabled]="!canEdit()"
						[value]="chartData.title ?? ''"
						(change)="onTitle($event)"
					/>
				</label>

				<label class="pptx-cts__field">
					<span class="pptx-cts__lbl">{{ 'pptx.chart.type' | translate }}</span>
					<select
						class="pptx-cts__input"
						[attr.aria-label]="'pptx.chart.type' | translate"
						[disabled]="!canEdit()"
						[value]="displayedType()"
						(change)="onType($event)"
					>
						@for (opt of typeOptions; track opt.value) {
							<option [value]="opt.value" [selected]="opt.value === displayedType()">
								{{ opt.labelKey | translate }}
							</option>
						}
					</select>
				</label>

				@if (supportsGrouping()) {
					<label class="pptx-cts__field">
						<span class="pptx-cts__lbl">{{ 'pptx.chart.grouping' | translate }}</span>
						<select
							class="pptx-cts__input"
							[attr.aria-label]="'pptx.chart.grouping' | translate"
							[disabled]="!canEdit()"
							[value]="chartData.grouping ?? 'clustered'"
							(change)="onGrouping($event)"
						>
							@for (opt of groupingOptions; track opt.value) {
								<option
									[value]="opt.value"
									[selected]="opt.value === (chartData.grouping ?? 'clustered')"
								>
									{{ opt.labelKey | translate }}
								</option>
							}
						</select>
					</label>
				}
			</div>
		}
	`,
	styles: `
		.pptx-cts {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
		}
		.pptx-cts__field {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			font-size: 11px;
		}
		.pptx-cts__lbl {
			flex: 0 0 auto;
			min-width: 2.5rem;
			color: var(--pptx-inspector-muted, #888);
		}
		.pptx-cts__input {
			flex: 1 1 auto;
			min-width: 0;
		}
	`,
})
export class ChartTypeSelectorComponent {
	/** The chart element being edited. */
	readonly element = input.required<ChartPptxElement>();
	/** Whether editing is enabled. */
	readonly canEdit = input<boolean>(true);
	/** Emits the fully-updated element after any edit. */
	readonly elementChange = output<ChartPptxElement>();

	protected readonly typeOptions = CHART_TYPE_OPTIONS;
	protected readonly groupingOptions = GROUPING_OPTIONS;

	protected readonly data = computed(() => this.element().chartData);
	protected readonly supportsGrouping = computed(() => {
		const chartType = this.data()?.chartType;
		return chartType !== undefined && GROUPING_SUPPORTED_TYPES.has(chartType);
	});
	/**
	 * The type shown as selected. "Pareto" has no `PptxChartType` of its own
	 * (docs/guide/limitations.md's ChartEx row): it is `chartType: 'histogram'`
	 * plus a `paretoLine`-layout series, so reading `chartType` raw would show
	 * "Histogram" for a chart the user picked "Pareto" for.
	 */
	protected readonly displayedType = computed<ChartTypeSelectValue | undefined>(() => {
		const data = this.data();
		return data ? resolveDisplayedChartType(data) : undefined;
	});

	protected onTitle(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLInputElement) {
			// A multi-run title collapses to one run in its dominant style so an
			// edit does not leave another, now-stale run's text trailing the new
			// title; see `collapseChartTitleRunsForEdit`'s doc.
			this.emit(collapseChartTitleRunsForEdit(this.data(), target.value));
		}
	}

	protected onType(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			this.emit({ chartType: target.value as PptxChartData['chartType'] });
		}
	}

	protected onGrouping(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			this.emit({ grouping: target.value as PptxChartData['grouping'] });
		}
	}

	private emit(patch: Partial<PptxChartData>): void {
		const next = applyChartTypeSelectorPatch(this.element(), patch);
		if (next) {
			this.elementChange.emit(next);
		}
	}
}
