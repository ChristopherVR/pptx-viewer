/**
 * advanced-chart-editor.component.ts: Full chart inspector for the Angular
 * binding, at parity with the React `ChartDataPanel`.
 *
 * Selector: `pptx-advanced-chart-editor`
 *
 * Composes the existing data grid (`pptx-chart-data-editor`) with the advanced
 * formatting controls: display toggles, data labels, axis scale/format, axis
 * styling, markers, combo per-series types, per-data-point overrides, trendlines,
 * and error bars. Every child emits a complete new `ChartPptxElement`, which this
 * component re-emits via its own `elementChange` output so the parent commits a
 * single history entry per edit. Holds no mutable state.
 *
 * @module angular-viewer/advanced-chart-editor
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ChartPptxElement } from 'pptx-viewer-core';

import { ChartAxisOptionsComponent } from './chart-axis-options.component';
import { ChartAxisStyleOptionsComponent } from './chart-axis-style-options.component';
import { ChartComboTypeOptionsComponent } from './chart-combo-type-options.component';
import { ChartDataLabelOptionsComponent } from './chart-data-label-options.component';
import { ChartDatapointOptionsComponent } from './chart-datapoint-options.component';
import { ChartDisplayOptionsComponent } from './chart-display-options.component';
import { ChartErrorBarOptionsComponent } from './chart-error-bar-options.component';
import { ChartMarkerOptionsComponent } from './chart-marker-options.component';
import { ChartTrendlineOptionsComponent } from './chart-trendline-options.component';

@Component({
	selector: 'pptx-advanced-chart-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ChartDisplayOptionsComponent,
		ChartDataLabelOptionsComponent,
		ChartAxisOptionsComponent,
		ChartAxisStyleOptionsComponent,
		ChartMarkerOptionsComponent,
		ChartComboTypeOptionsComponent,
		ChartDatapointOptionsComponent,
		ChartTrendlineOptionsComponent,
		ChartErrorBarOptionsComponent,
	],
	template: `
		<div class="pptx-advanced-chart">
			<pptx-chart-display-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-data-label-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-axis-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-axis-style-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-marker-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-combo-type-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-datapoint-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-trendline-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
			<pptx-chart-error-bar-options
				[element]="element()"
				[canEdit]="canEdit()"
				(elementChange)="elementChange.emit($event)"
			/>
		</div>
	`,
	styles: `
		.pptx-advanced-chart {
			display: flex;
			flex-direction: column;
		}
	`,
})
export class AdvancedChartEditorComponent {
	/** The chart element being edited. */
	readonly element = input.required<ChartPptxElement>();
	/** Whether editing is enabled (read-only mode when false). */
	readonly canEdit = input<boolean>(true);
	/** Emits the updated element after any edit operation in any child control. */
	readonly elementChange = output<ChartPptxElement>();
}
