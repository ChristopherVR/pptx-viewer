/**
 * chart-user-shape-options.component.ts: "Chart overlay shapes" section
 * (`c:userShapes` drawing overlay, C2-G10 edit/serialize follow-up).
 *
 * Selector: `pptx-chart-user-shape-options`
 *
 * Mirrors React's `ChartUserShapeOptions.tsx`: list existing overlay shapes,
 * add a default text box, delete one, and nudge a `sp`/`cxnSp` shape's
 * anchor fractions. Pure view over `pptx-viewer-shared`'s
 * `chart-user-shape-edit` helpers; emits a complete new `ChartPptxElement`
 * via `elementChange` after each edit, holds no mutable state.
 *
 * @module angular-viewer/chart-user-shape-options
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartUserShape } from 'pptx-viewer-core';

import {
	createDefaultChartUserShape,
	listChartUserShapeDescriptors,
	withChartUserShapeAdded,
	withChartUserShapeRemoved,
	withChartUserShapeUpdated,
} from '../internal/shared';
import { patchChartData } from './chart-data-helpers';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';

@Component({
	selector: 'pptx-chart-user-shape-options',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="pptx-chart-card" [attr.aria-label]="'pptx.chart.userShapes' | translate">
			<div class="pptx-chart-card__row" style="justify-content: space-between;">
				<h4 class="pptx-chart-card__heading">{{ 'pptx.chart.userShapes' | translate }}</h4>
				<button
					type="button"
					data-testid="chart-user-shape-add"
					[disabled]="!canEdit()"
					(click)="onAddTextBox()"
				>
					{{ 'pptx.chart.userShapeAddTextBox' | translate }}
				</button>
			</div>

			@if (descriptors().length === 0) {
				<div class="pptx-chart-card__label">{{ 'pptx.chart.userShapesEmpty' | translate }}</div>
			} @else {
				@for (d of descriptors(); track d.index) {
					<div class="pptx-chart-card__group" data-testid="chart-user-shape-row">
						<div class="pptx-chart-card__row">
							<span class="pptx-chart-card__label"
								>{{ kindLabel(d.kind) }}{{ d.text ? ' - ' + d.text : '' }}</span
							>
							<button
								type="button"
								data-testid="chart-user-shape-delete"
								[attr.aria-label]="'pptx.chart.userShapeDelete' | translate"
								[disabled]="!canEdit()"
								(click)="onRemove(d.index)"
							>
								&#10005;
							</button>
						</div>
						@if (d.editable) {
							<div class="pptx-chart-card__row">
								<span class="pptx-chart-card__label">{{
									'pptx.chart.userShapeFrom' | translate
								}}</span>
								<input
									type="number"
									step="0.01"
									min="0"
									max="1"
									class="pptx-chart-card__input"
									[disabled]="!canEdit()"
									[value]="d.from.x"
									(change)="onFromX(d.index, d.from, $event)"
								/>
								<input
									type="number"
									step="0.01"
									min="0"
									max="1"
									class="pptx-chart-card__input"
									[disabled]="!canEdit()"
									[value]="d.from.y"
									(change)="onFromY(d.index, d.from, $event)"
								/>
								@if (d.anchor === 'rel' && d.to) {
									<span class="pptx-chart-card__label">{{
										'pptx.chart.userShapeTo' | translate
									}}</span>
									<input
										type="number"
										step="0.01"
										min="0"
										max="1"
										class="pptx-chart-card__input"
										[disabled]="!canEdit()"
										[value]="d.to.x"
										(change)="onToX(d.index, d.to, $event)"
									/>
									<input
										type="number"
										step="0.01"
										min="0"
										max="1"
										class="pptx-chart-card__input"
										[disabled]="!canEdit()"
										[value]="d.to.y"
										(change)="onToY(d.index, d.to, $event)"
									/>
								}
							</div>
						} @else {
							<div class="pptx-chart-card__label">
								{{ 'pptx.chart.userShapeNotEditable' | translate }}
							</div>
						}
					</div>
				}
			}
		</section>
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartUserShapeOptionsComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly elementChange = output<ChartPptxElement>();

	protected readonly descriptors = computed(() =>
		listChartUserShapeDescriptors(this.element().chartData?.userShapes),
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

	protected onRemove(index: number): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeRemoved(chartData.userShapes, index),
			}),
		);
	}

	private updateAnchor(index: number, patch: Partial<PptxChartUserShape>): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		this.elementChange.emit(
			patchChartData(this.element(), {
				userShapes: withChartUserShapeUpdated(chartData.userShapes, index, patch),
			}),
		);
	}

	protected onFromX(index: number, from: { x: number; y: number }, event: Event): void {
		this.updateAnchor(index, {
			from: { ...from, x: Number((event.target as HTMLInputElement).value) },
		});
	}
	protected onFromY(index: number, from: { x: number; y: number }, event: Event): void {
		this.updateAnchor(index, {
			from: { ...from, y: Number((event.target as HTMLInputElement).value) },
		});
	}
	protected onToX(index: number, to: { x: number; y: number }, event: Event): void {
		this.updateAnchor(index, {
			to: { ...to, x: Number((event.target as HTMLInputElement).value) },
		});
	}
	protected onToY(index: number, to: { x: number; y: number }, event: Event): void {
		this.updateAnchor(index, {
			to: { ...to, y: Number((event.target as HTMLInputElement).value) },
		});
	}
}
