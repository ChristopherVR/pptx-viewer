/**
 * chart-quick-actions-overlay.component.ts: PowerPoint's three floating
 * quick-action icons ("Chart Elements" +, "Chart Styles" paintbrush, "Chart
 * Filters" funnel) shown just outside a selected chart's top-right corner.
 *
 * Selector: `pptx-chart-quick-actions-overlay`
 *
 * Mounted inside `SlideCanvasComponent`'s template as a sibling of the
 * resize/rotate/adjust handle blocks, inside the same scaled
 * `.pptx-ng-canvas-stage`. Angular has no CSS inverse-scale variable (unlike
 * React's `--pptx-handle-inverse-scale`): this component follows the SAME
 * convention `selection-geometry.ts`'s `computeHandleBoxes`/
 * `computeCornerHandle` already use, computing every screen-constant
 * quantity (button size, gaps) as `screenPx / zoom` while leaving the
 * element's own x/y/width/height in raw slide px.
 *
 * All decision-making (which buttons render, checklist/gallery/filter state)
 * comes from the shared `buildChartQuickActionsDescriptor`; this component
 * only renders three buttons plus whichever popover is open, and commits
 * through `commitChartElementData` (the same on-canvas commit helper
 * `ChartElementViewComponent` uses for mark-drag/inline-title edits), so
 * undo/redo and the save round-trip are shared with every other on-canvas
 * chart edit. See the shared module's header for scope notes (Series-only
 * Chart Filters, no trendline/error-bar/up-down-bars rows).
 *
 * @module angular-viewer/chart-quick-actions-overlay
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	input,
	signal,
} from '@angular/core';
import { LucideFilter, LucidePaintbrush, LucidePlus } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';

import {
	applyChartElementToggle,
	applyChartStylePreset,
	buildChartQuickActionsDescriptor,
	CHART_QUICK_ACTION_BUTTON_SIZE,
	hideChartSeries,
	restoreFilteredSeries,
} from '../internal/shared';
import type { ChartQuickElementKey } from '../internal/shared';
import { commitChartElementData } from './chart-element-view-helpers';
import { EditorStateService } from './editor-state.service';
import { SLIDE_CONTEXT } from './slide-context';

type QuickActionId = 'elements' | 'styles' | 'filters';

@Component({
	selector: 'pptx-chart-quick-actions-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucidePlus, LucidePaintbrush, LucideFilter],
	host: {
		'data-pptx-chart-quick-actions': 'true',
		'data-export-ignore': 'true',
		'(pointerdown)': '$event.stopPropagation()',
	},
	template: `
		@if (descriptor(); as d) {
			@for (button of d.buttons; track button.id) {
				<button
					type="button"
					class="pptx-ng-chart-quick-btn"
					[disabled]="!canEdit()"
					[attr.data-testid]="'chart-quick-action-' + button.id"
					[attr.aria-label]="button.labelKey | translate"
					[title]="button.labelKey | translate"
					[style.left.px]="screenPx(button.x)"
					[style.top.px]="screenPx(button.y)"
					[style.width.px]="screenPx(button.size)"
					[style.height.px]="screenPx(button.size)"
					(click)="toggle(button.id)"
				>
					@if (button.id === 'elements') {
						<svg lucidePlus class="pptx-ng-chart-quick-icon"></svg>
					} @else if (button.id === 'styles') {
						<svg lucidePaintbrush class="pptx-ng-chart-quick-icon"></svg>
					} @else {
						<svg lucideFilter class="pptx-ng-chart-quick-icon"></svg>
					}
				</button>

				@if (open() === button.id && button.id === 'elements') {
					<div
						class="pptx-ng-chart-quick-card"
						data-testid="chart-quick-elements-popover"
						[style.left.px]="screenPx(button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4)"
						[style.top.px]="screenPx(button.y)"
					>
						<h4 class="pptx-ng-chart-quick-heading">
							{{ 'pptx.chart.quickElements' | translate }}
						</h4>
						@for (item of d.elements; track item.key) {
							<label class="pptx-ng-chart-quick-check">
								<input
									type="checkbox"
									[disabled]="!canEdit()"
									[checked]="item.checked"
									[attr.data-testid]="'chart-quick-element-' + item.key"
									(change)="onElementToggle(item.key, $event)"
								/>
								<span>{{ item.labelKey | translate }}</span>
							</label>
						}
					</div>
				}

				@if (open() === button.id && button.id === 'styles') {
					<div
						class="pptx-ng-chart-quick-card pptx-ng-chart-quick-styles"
						data-testid="chart-quick-styles-popover"
						[style.left.px]="screenPx(button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4)"
						[style.top.px]="screenPx(button.y)"
					>
						@for (preset of d.styles.presets; track preset.id) {
							<button
								type="button"
								class="pptx-ng-chart-quick-swatch"
								[class.is-applied]="preset.applied"
								[disabled]="!canEdit()"
								[attr.data-testid]="'chart-quick-style-' + preset.id"
								[attr.aria-label]="preset.labelKey | translate"
								[attr.aria-pressed]="preset.applied"
								[title]="preset.labelKey | translate"
								(click)="onStylePreset(preset.id)"
							>
								<span class="pptx-ng-chart-quick-swatch-row">
									@for (c of preset.colors.slice(0, 5); track $index) {
										<span [style.background-color]="c"></span>
									}
								</span>
							</button>
						}
					</div>
				}

				@if (open() === button.id && button.id === 'filters') {
					<div
						class="pptx-ng-chart-quick-card"
						data-testid="chart-quick-filters-popover"
						[style.left.px]="screenPx(button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4)"
						[style.top.px]="screenPx(button.y)"
					>
						<h4 class="pptx-ng-chart-quick-heading">{{ 'pptx.chart.quickFilters' | translate }}</h4>
						@for (row of d.filters.series; track row.key) {
							<label class="pptx-ng-chart-quick-check">
								<input
									type="checkbox"
									[disabled]="!canEdit()"
									[checked]="row.visible"
									[attr.data-testid]="'chart-quick-filter-' + row.key"
									(change)="onFilterToggle(row.seriesIndex, row.filteredIndex)"
								/>
								<span class="pptx-ng-chart-quick-name">{{ row.name }}</span>
							</label>
						}
					</div>
				}
			}
		}
	`,
	styles: `
		:host {
			position: absolute;
			left: 0;
			top: 0;
			z-index: 59;
		}
		.pptx-ng-chart-quick-btn {
			position: absolute;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			border: 1px solid var(--pptx-inspector-border, #444);
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			cursor: pointer;
		}
		.pptx-ng-chart-quick-btn:hover {
			background: var(--pptx-inspector-active, #0078d4);
		}
		.pptx-ng-chart-quick-btn:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
		.pptx-ng-chart-quick-icon {
			width: 14px;
			height: 14px;
		}
		.pptx-ng-chart-quick-card {
			position: absolute;
			z-index: 10;
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			min-width: 11rem;
			padding: 0.5rem;
			border-radius: 6px;
			border: 1px solid var(--pptx-inspector-border, #444);
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
		}
		.pptx-ng-chart-quick-heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0;
		}
		.pptx-ng-chart-quick-check {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			font-size: 11px;
			cursor: pointer;
		}
		.pptx-ng-chart-quick-name {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.pptx-ng-chart-quick-styles {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0.35rem;
			min-width: 12rem;
		}
		.pptx-ng-chart-quick-swatch {
			border-radius: 4px;
			overflow: hidden;
			border: 1px solid var(--pptx-inspector-border, #444);
			padding: 0;
			cursor: pointer;
		}
		.pptx-ng-chart-quick-swatch.is-applied {
			border-color: var(--pptx-inspector-active, #0078d4);
			box-shadow: 0 0 0 1px var(--pptx-inspector-active, #0078d4);
		}
		.pptx-ng-chart-quick-swatch-row {
			display: flex;
			height: 20px;
			width: 100%;
		}
		.pptx-ng-chart-quick-swatch-row > span {
			flex: 1 1 auto;
		}
	`,
})
export class ChartQuickActionsOverlayComponent {
	readonly element = input.required<ChartPptxElement>();
	readonly canEdit = input<boolean>(true);
	/** Effective stage zoom, so screen-constant sizes/gaps divide it out. */
	readonly zoom = input<number>(1);

	protected readonly CHART_QUICK_ACTION_BUTTON_SIZE = CHART_QUICK_ACTION_BUTTON_SIZE;

	private readonly editor = inject(EditorStateService, { optional: true });
	private readonly slideContext = inject(SLIDE_CONTEXT, { optional: true });
	private readonly hostRef = inject(ElementRef<HTMLElement>);

	protected readonly open = signal<QuickActionId | null>(null);

	/** Close whichever popover is open on an outside click, mirroring every other binding's overlay. */
	@HostListener('document:mousedown', ['$event'])
	protected onDocumentMouseDown(event: MouseEvent): void {
		if (this.open() && !this.hostRef.nativeElement.contains(event.target as Node)) {
			this.open.set(null);
		}
	}

	/** The stage scale, guarded against 0. */
	private readonly scale = computed(() => this.zoom() || 1);

	/**
	 * The descriptor's geometry, computed against a SCREEN-space box (the
	 * element's box multiplied by the stage scale): every constant the shared
	 * function adds (gaps, button size) is then correctly screen-constant, and
	 * {@link screenPx} divides each resulting quantity back down to the slide
	 * px this component renders in, mirroring `selection-geometry.ts`'s
	 * `computeHandleBoxes`.
	 */
	protected readonly descriptor = computed(() => {
		const el = this.element();
		const scale = this.scale();
		return buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: el.chartData,
			selectionBox: {
				x: el.x * scale,
				y: el.y * scale,
				width: el.width * scale,
				height: el.height * scale,
			},
		});
	});

	/** Convert a screen-space quantity (from {@link descriptor}) back to slide px. */
	protected screenPx(value: number): number {
		return value / this.scale();
	}

	protected toggle(id: QuickActionId): void {
		this.open.update((current) => (current === id ? null : id));
	}

	private commit(chartData: PptxChartData): void {
		commitChartElementData(
			this.editor,
			this.element().id,
			chartData,
			this.slideContext?.slideId() ?? null,
		);
	}

	protected onElementToggle(key: ChartQuickElementKey, event: Event): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		const checked = (event.target as HTMLInputElement).checked;
		this.commit(applyChartElementToggle(chartData, key, checked));
	}

	protected onStylePreset(presetId: string): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		const next = applyChartStylePreset(chartData, presetId);
		if (next) {
			this.commit(next);
		}
	}

	protected onFilterToggle(
		seriesIndex: number | undefined,
		filteredIndex: number | undefined,
	): void {
		const chartData = this.element().chartData;
		if (!chartData) {
			return;
		}
		const next =
			seriesIndex !== undefined
				? hideChartSeries(chartData, seriesIndex)
				: restoreFilteredSeries(chartData, filteredIndex!);
		if (next) {
			this.commit(next);
		}
	}
}
