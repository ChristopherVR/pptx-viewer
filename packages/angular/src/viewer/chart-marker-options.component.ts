/**
 * chart-marker-options.component.ts: Per-series marker controls.
 *
 * Selector: `pptx-chart-marker-options`
 *
 * Mirrors React's `ChartMarkerOptions.tsx`: for line/scatter/bubble/radar charts,
 * each series gets a marker-symbol selector and (when a visible symbol is chosen)
 * size and fill-colour controls. Routes through `setSeriesMarker` and emits a new
 * `ChartPptxElement`.
 *
 * @module angular-viewer/chart-marker-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type {
	ChartPptxElement,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartType,
} from 'pptx-viewer-core';

import { MARKER_SUPPORTED_TYPES, MARKER_SYMBOL_OPTIONS } from '../internal/shared';
import { setSeriesMarker } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import { numFromEvent, selectValue, stringFromEvent } from './chart-event-helpers';

@Component({
	selector: 'pptx-chart-marker-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (supported()) {
			<section class="pptx-chart-card" aria-label="Marker options">
				<h4 class="pptx-chart-card__heading">Markers</h4>
				@for (s of series(); track $index; let i = $index) {
					<div class="pptx-chart-card__group">
						<div class="pptx-chart-card__row">
							<span class="pptx-chart-card__name" [title]="s.name">{{ s.name }}</span>
							<select
								class="pptx-chart-card__input"
								[disabled]="!canEdit()"
								[value]="s.marker?.symbol ?? ''"
								(change)="onSymbol(i, $event)"
							>
								@for (opt of symbolOptions; track opt.value) {
									<option [value]="opt.value">{{ opt.label }}</option>
								}
							</select>
						</div>

						@if (s.marker && s.marker.symbol !== 'none') {
							<div class="pptx-chart-card__row pptx-chart-card__group--indent">
								<span class="pptx-chart-card__label">Size</span>
								<input
									type="number"
									min="2"
									max="72"
									class="pptx-chart-card__input pptx-chart-card__input--num"
									placeholder="Auto"
									[disabled]="!canEdit()"
									[value]="s.marker.size ?? ''"
									(change)="onSize(i, $event)"
								/>
								<span class="pptx-chart-card__label">Fill</span>
								<input
									type="color"
									class="pptx-chart-card__color"
									[disabled]="!canEdit()"
									[value]="s.marker.spPr?.fillColor ?? '#4472c4'"
									(input)="onFill(i, $event)"
								/>
							</div>
						}
					</div>
				}
			</section>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartMarkerOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly symbolOptions = MARKER_SYMBOL_OPTIONS;

	protected readonly series = computed<PptxChartSeries[]>(
		() => this.element().chartData?.series ?? [],
	);

	protected readonly supported = computed(() => {
		const type = this.element().chartData?.chartType as PptxChartType | undefined;
		return type !== undefined && MARKER_SUPPORTED_TYPES.has(type) && this.series().length > 0;
	});

	protected onSymbol(index: number, event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(
			setSeriesMarker(
				this.element(),
				index,
				value === '' ? null : { symbol: value as PptxChartMarkerSymbol },
			),
		);
	}

	protected onSize(index: number, event: Event): void {
		const num = numFromEvent(event);
		this.elementChange.emit(
			setSeriesMarker(this.element(), index, { size: typeof num === 'number' ? num : undefined }),
		);
	}

	protected onFill(index: number, event: Event): void {
		const value = stringFromEvent(event);
		if (value === null) {
			return;
		}
		this.elementChange.emit(setSeriesMarker(this.element(), index, { fillColor: value }));
	}
}
