/**
 * chart-user-shape-position.component.ts: position/size editor for one chart
 * overlay row (W2-F), split out of `chart-user-shape-options.component.ts`.
 *
 * Selector: `pptx-chart-user-shape-position`
 *
 * A top-level row edits its anchor markers directly (rel `from`/`to`
 * fractions, or abs `from` + `ext` EMU: a top-level `grpSp` row's anchor
 * already moves/resizes the whole group with children following, see shared
 * `chart-user-shape-tree.ts`'s `editablePosition` doc). A nested row,
 * INCLUDING a nested `grpSp` group header, edits a `from`/`to`
 * chart-relative fraction pair instead of raw EMU (shared
 * `chart-user-shape-row-frame.ts`), matching how a top-level `relSizeAnchor`
 * row already edits. Emits `{ path, patch }` / `{ path, box }` and holds no
 * state of its own.
 *
 * @module angular-viewer/chart-user-shape-position
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxChartUserShape } from 'pptx-viewer-core';

import type { ChartUserShapeRow, ChartUserShapeRowPatch } from '../internal/shared';
import { getChartUserShapeRowChartBox } from '../internal/shared';
import { CHART_EDITOR_STYLES } from './chart-editor-styles';

export interface ChartUserShapePositionPatch {
	path: readonly number[];
	patch: ChartUserShapeRowPatch;
}

export interface ChartUserShapePositionBoxPatch {
	path: readonly number[];
	box: { from: Point; to: Point };
}

export interface ChartUserShapePositionRotationPatch {
	path: readonly number[];
	rotation: number | undefined;
}

export interface ChartUserShapePositionFlipPatch {
	path: readonly number[];
	flip: { flipH?: boolean; flipV?: boolean };
}

type Point = { x: number; y: number };
type Size = { cx: number; cy: number };

const num = (event: Event): number => Number((event.target as HTMLInputElement).value);

@Component({
	selector: 'pptx-chart-user-shape-position',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (row().depth === 0) {
			<div class="pptx-chart-card__row">
				<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeFrom' | translate }}</span>
				<input
					type="number"
					step="0.01"
					min="0"
					max="1"
					class="pptx-chart-card__input"
					[disabled]="!canEdit()"
					[value]="row().from!.x"
					(change)="onPoint('from', row().from!, 'x', $event)"
				/>
				<input
					type="number"
					step="0.01"
					min="0"
					max="1"
					class="pptx-chart-card__input"
					[disabled]="!canEdit()"
					[value]="row().from!.y"
					(change)="onPoint('from', row().from!, 'y', $event)"
				/>
				@if (row().anchor === 'rel' && row().to) {
					<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeTo' | translate }}</span>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						class="pptx-chart-card__input"
						[disabled]="!canEdit()"
						[value]="row().to!.x"
						(change)="onPoint('to', row().to!, 'x', $event)"
					/>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						class="pptx-chart-card__input"
						[disabled]="!canEdit()"
						[value]="row().to!.y"
						(change)="onPoint('to', row().to!, 'y', $event)"
					/>
				}
				@if (row().anchor === 'abs' && row().ext) {
					<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeSize' | translate }}</span>
					<input
						type="number"
						min="0"
						class="pptx-chart-card__input"
						[disabled]="!canEdit()"
						[value]="row().ext!.cx"
						(change)="onSize(row().ext!, 'cx', $event)"
					/>
					<input
						type="number"
						min="0"
						class="pptx-chart-card__input"
						[disabled]="!canEdit()"
						[value]="row().ext!.cy"
						(change)="onSize(row().ext!, 'cy', $event)"
					/>
				}
				<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeRotation' | translate }}</span>
				<input
					type="number"
					step="1"
					class="pptx-chart-card__input"
					[attr.aria-label]="'pptx.chart.userShapeRotation' | translate"
					[disabled]="!canEdit()"
					[value]="row().rotation ?? 0"
					(change)="onRotation($event)"
				/>
				<label class="pptx-chart-card__row">
					<input
						type="checkbox"
						[attr.aria-label]="'pptx.arrange.flipHorizontally' | translate"
						[disabled]="!canEdit()"
						[checked]="row().flipH ?? false"
						(change)="onFlipH($event)"
					/>
					<span class="pptx-chart-card__label">{{
						'pptx.arrange.flipHorizontally' | translate
					}}</span>
				</label>
				<label class="pptx-chart-card__row">
					<input
						type="checkbox"
						[attr.aria-label]="'pptx.arrange.flipVertically' | translate"
						[disabled]="!canEdit()"
						[checked]="row().flipV ?? false"
						(change)="onFlipV($event)"
					/>
					<span class="pptx-chart-card__label">{{
						'pptx.arrange.flipVertically' | translate
					}}</span>
				</label>
			</div>
		} @else if (box(); as b) {
			<div class="pptx-chart-card__row">
				<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeFrom' | translate }}</span>
				<input
					type="number"
					step="0.01"
					min="0"
					max="1"
					class="pptx-chart-card__input"
					[disabled]="!canEdit()"
					[value]="b.from.x"
					(change)="onBoxPoint('from', b, 'x', $event)"
				/>
				<input
					type="number"
					step="0.01"
					min="0"
					max="1"
					class="pptx-chart-card__input"
					[disabled]="!canEdit()"
					[value]="b.from.y"
					(change)="onBoxPoint('from', b, 'y', $event)"
				/>
				<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeTo' | translate }}</span>
				<input
					type="number"
					step="0.01"
					min="0"
					max="1"
					class="pptx-chart-card__input"
					[disabled]="!canEdit()"
					[value]="b.to.x"
					(change)="onBoxPoint('to', b, 'x', $event)"
				/>
				<input
					type="number"
					step="0.01"
					min="0"
					max="1"
					class="pptx-chart-card__input"
					[disabled]="!canEdit()"
					[value]="b.to.y"
					(change)="onBoxPoint('to', b, 'y', $event)"
				/>
				<span class="pptx-chart-card__label">{{ 'pptx.chart.userShapeRotation' | translate }}</span>
				<input
					type="number"
					step="1"
					class="pptx-chart-card__input"
					[attr.aria-label]="'pptx.chart.userShapeRotation' | translate"
					[disabled]="!canEdit()"
					[value]="row().rotation ?? 0"
					(change)="onRotation($event)"
				/>
				<label class="pptx-chart-card__row">
					<input
						type="checkbox"
						[attr.aria-label]="'pptx.arrange.flipHorizontally' | translate"
						[disabled]="!canEdit()"
						[checked]="row().flipH ?? false"
						(change)="onFlipH($event)"
					/>
					<span class="pptx-chart-card__label">{{
						'pptx.arrange.flipHorizontally' | translate
					}}</span>
				</label>
				<label class="pptx-chart-card__row">
					<input
						type="checkbox"
						[attr.aria-label]="'pptx.arrange.flipVertically' | translate"
						[disabled]="!canEdit()"
						[checked]="row().flipV ?? false"
						(change)="onFlipV($event)"
					/>
					<span class="pptx-chart-card__label">{{
						'pptx.arrange.flipVertically' | translate
					}}</span>
				</label>
			</div>
		}
	`,
	styles: CHART_EDITOR_STYLES,
})
export class ChartUserShapePositionComponent {
	readonly row = input.required<ChartUserShapeRow>();
	/** The chart's full overlay tree, needed to resolve a nested row's ancestor group chain. */
	readonly userShapes = input<ReadonlyArray<PptxChartUserShape> | undefined>(undefined);
	readonly canEdit = input<boolean>(true);
	readonly patch = output<ChartUserShapePositionPatch>();
	readonly boxPatch = output<ChartUserShapePositionBoxPatch>();
	readonly rotationPatch = output<ChartUserShapePositionRotationPatch>();
	readonly flipPatch = output<ChartUserShapePositionFlipPatch>();

	protected readonly box = computed(() =>
		getChartUserShapeRowChartBox(this.userShapes(), this.row().path),
	);

	protected onPoint(key: 'from' | 'to' | 'off', point: Point, axis: 'x' | 'y', event: Event): void {
		this.patch.emit({ path: this.row().path, patch: { [key]: { ...point, [axis]: num(event) } } });
	}

	protected onSize(ext: Size, axis: 'cx' | 'cy', event: Event): void {
		this.patch.emit({ path: this.row().path, patch: { ext: { ...ext, [axis]: num(event) } } });
	}

	protected onBoxPoint(
		key: 'from' | 'to',
		current: { from: Point; to: Point },
		axis: 'x' | 'y',
		event: Event,
	): void {
		this.boxPatch.emit({
			path: this.row().path,
			box: { ...current, [key]: { ...current[key], [axis]: num(event) } },
		});
	}

	protected onRotation(event: Event): void {
		const value = num(event);
		this.rotationPatch.emit({ path: this.row().path, rotation: value || undefined });
	}

	protected onFlipH(event: Event): void {
		const checked = (event.target as HTMLInputElement).checked;
		this.flipPatch.emit({ path: this.row().path, flip: { flipH: checked } });
	}

	protected onFlipV(event: Event): void {
		const checked = (event.target as HTMLInputElement).checked;
		this.flipPatch.emit({ path: this.row().path, flip: { flipV: checked } });
	}
}
