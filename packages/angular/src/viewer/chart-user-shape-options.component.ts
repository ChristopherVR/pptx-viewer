/**
 * chart-user-shape-options.component.ts: "Chart overlay shapes" section
 * (`c:userShapes` drawing overlay, C2-G10 edit/serialize follow-up; W2-F
 * grouped-child tree editing).
 *
 * Selector: `pptx-chart-user-shape-options`
 *
 * Mirrors React's `ChartUserShapeOptions.tsx`: list a chart's overlay shapes
 * (including everything grouped inside a `cdr:grpSp`, arbitrarily nested,
 * flattened into an indented row list) as one flat loop, add a default text
 * box, delete any row, and edit a `sp`/`cxnSp` row's text/fill/line, a
 * `pic` row's alt text, and any non-group row's position/size. Pure view
 * over `pptx-viewer-shared`'s `chart-user-shape-edit`/`chart-user-shape-
 * tree` helpers; emits a complete new `ChartPptxElement` via
 * `elementChange` after each edit, holds no mutable state.
 *
 * Template lives in `chart-user-shape-options.component.html` to keep this
 * file under this repo's file-size limit.
 *
 * @module angular-viewer/chart-user-shape-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartPptxElement } from 'pptx-viewer-core';

import type { ChartUserShapeRow, ChartUserShapeRowPatch } from '../internal/shared';
import {
	createDefaultChartUserShape,
	createDefaultChartUserShapeGroupChild,
	getChartUserShapeGroupTransform,
	listChartUserShapeRows,
	withChartUserShapeAdded,
	withChartUserShapeGroupChildAdded,
	withChartUserShapeRowChartBoxUpdated,
	withChartUserShapeRowFlipUpdated,
	withChartUserShapeRowRemoved,
	withChartUserShapeRowRotationUpdated,
	withChartUserShapeRowTextUpdated,
	withChartUserShapeRowUpdated,
} from '../internal/shared';
import { patchChartData } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';
import type {
	ChartUserShapePositionBoxPatch,
	ChartUserShapePositionFlipPatch,
	ChartUserShapePositionPatch,
	ChartUserShapePositionRotationPatch,
} from './chart-user-shape-position.component';
import { ChartUserShapePositionComponent } from './chart-user-shape-position.component';

const pathKey = (path: readonly number[]): string => path.join(',');

@Component({
	selector: 'pptx-chart-user-shape-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, ChartUserShapePositionComponent],
	templateUrl: './chart-user-shape-options.component.html',
	styles: CHART_EDITOR_STYLES,
})
export class ChartUserShapeOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly pathKey = pathKey;

	protected readonly rows = computed<ChartUserShapeRow[]>(() =>
		listChartUserShapeRows(this.element().chartData?.userShapes),
	);

	protected kindLabel(kind: string): string {
		return `pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
	}

	protected onAddTextBox(): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeAdded(chartData.userShapes, createDefaultChartUserShape()),
			}),
		);
	}

	protected onRemove(path: readonly number[]): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRowRemoved(chartData.userShapes, path),
			}),
		);
	}

	private update(path: readonly number[], patch: ChartUserShapeRowPatch): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRowUpdated(chartData.userShapes, path, patch),
			}),
		);
	}

	protected onAddIntoGroup(path: readonly number[]): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		const transform = getChartUserShapeGroupTransform(chartData.userShapes, path);
		if (!transform) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeGroupChildAdded(
					chartData.userShapes,
					path,
					createDefaultChartUserShapeGroupChild(transform),
				),
			}),
		);
	}

	protected onPositionBoxPatch({ path, box }: ChartUserShapePositionBoxPatch): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRowChartBoxUpdated(chartData.userShapes, path, box),
			}),
		);
	}

	protected onPositionRotationPatch({ path, rotation }: ChartUserShapePositionRotationPatch): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRowRotationUpdated(chartData.userShapes, path, rotation),
			}),
		);
	}

	protected onPositionFlipPatch({ path, flip }: ChartUserShapePositionFlipPatch): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRowFlipUpdated(chartData.userShapes, path, flip),
			}),
		);
	}

	protected onText(path: readonly number[], event: Event): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		const value = (event.target as HTMLInputElement).value;
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRowTextUpdated(chartData.userShapes, path, value),
			}),
		);
	}

	protected onFill(path: readonly number[], event: Event): void {
		this.update(path, { fill: (event.target as HTMLInputElement).value });
	}
	protected onStroke(path: readonly number[], event: Event): void {
		this.update(path, { stroke: (event.target as HTMLInputElement).value });
	}
	protected onAltText(path: readonly number[], event: Event): void {
		this.update(path, { altText: (event.target as HTMLInputElement).value });
	}
	protected onPositionPatch({ path, patch }: ChartUserShapePositionPatch): void {
		this.update(path, patch);
	}
}
