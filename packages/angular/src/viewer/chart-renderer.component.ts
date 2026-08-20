/**
 * ChartRendererComponent - Angular port of the React chart rendering pipeline
 * (`packages/react/src/viewer/utils/chart*.tsx`), viewer-first subset.
 *
 * Supported chart kinds (inline SVG):
 *   bar / column (clustered, stacked, percentStacked)
 *   line / line3D
 *   area / area3D
 *   pie / doughnut / pie3D / ofPie
 *   scatter
 *   bubble
 *   radar / radar3D
 *
 * Deferred (labelled fallback box):
 *   stock, waterfall, combo, surface, treemap, sunburst,
 *   funnel, boxWhisker, histogram, regionMap, bar3D (complex 3-D shading),
 *   error bars, trendlines, secondary axes, data tables.
 *
 * Architecture: all geometry/math lives in `chart-renderer-helpers.ts` (pure TS,
 * no Angular imports) so vitest tests can run without TestBed. The component
 * is a thin projector: input -> `computed()` -> `ChartViewModel` -> template.
 *
 * Selector: `pptx-chart-renderer`
 * Input:    `element` - required `PptxElement` narrowed to `type === 'chart'`
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { computeChartLegendLayout } from '../internal/shared';
import { ChartPrimitivesComponent } from './chart-primitives.component';
import { buildChartViewModel } from './chart-renderer-helpers';
import type { ChartViewModel } from './chart-renderer-helpers';

export type { ChartViewModel };

const LEGEND_SWATCH_SIZE = 10;

@Component({
	selector: 'pptx-chart-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ChartPrimitivesComponent],
	template: `
		<svg
			[attr.width]="vm().svgWidth"
			[attr.height]="vm().svgHeight"
			[attr.viewBox]="viewBox()"
			class="pptx-ng-chart-svg"
			style="overflow: visible; display: block; pointer-events: none;"
		>
			<!-- Chart-area fill; absent when the deck declares c:chartSpace/a:noFill -->
			@if (vm().areaFill) {
				<rect
					x="0"
					y="0"
					[attr.width]="vm().svgWidth"
					[attr.height]="vm().svgHeight"
					[attr.fill]="vm().areaFill"
				/>
			}

			<!-- Chart title (data-chart-part enables in-place editing in edit mode) -->
			@if (vm().title) {
				<text
					[attr.x]="vm().titleX"
					[attr.y]="vm().titleY"
					text-anchor="middle"
					font-size="12"
					font-weight="600"
					fill="#1e293b"
					data-chart-part="title"
				>
					{{ vm().title }}
				</text>
			}

			<!-- Gridlines -->
			@for (gl of vm().gridlines; track $index) {
				<line
					[attr.x1]="gl.x1"
					[attr.y1]="gl.y1"
					[attr.x2]="gl.x2"
					[attr.y2]="gl.y2"
					[attr.stroke]="gl.stroke"
					[attr.stroke-width]="gl.strokeWidth"
				/>
			}

			<!-- Value-axis labels -->
			@for (lbl of vm().axisLabels; track $index) {
				<text
					[attr.x]="lbl.x"
					[attr.y]="lbl.y"
					[attr.text-anchor]="lbl.textAnchor"
					[attr.font-size]="lbl.fontSize"
					[attr.fill]="lbl.fill"
					[attr.dominant-baseline]="lbl.dominantBaseline ?? 'auto'"
				>
					{{ lbl.text }}
				</text>
			}

			<!-- Secondary value-axis gridlines -->
			@for (gl of vm().secondaryGridlines ?? []; track $index) {
				<line
					[attr.x1]="gl.x1"
					[attr.y1]="gl.y1"
					[attr.x2]="gl.x2"
					[attr.y2]="gl.y2"
					[attr.stroke]="gl.stroke"
					[attr.stroke-width]="gl.strokeWidth"
					[attr.stroke-dasharray]="gl.dashArray"
					[attr.opacity]="gl.opacity ?? 1"
				/>
			}

			<!-- Secondary value-axis labels -->
			@for (lbl of vm().secondaryAxisLabels ?? []; track $index) {
				<text
					[attr.x]="lbl.x"
					[attr.y]="lbl.y"
					[attr.text-anchor]="lbl.textAnchor"
					[attr.font-size]="lbl.fontSize"
					[attr.fill]="lbl.fill"
					[attr.dominant-baseline]="lbl.dominantBaseline ?? 'auto'"
					[attr.opacity]="lbl.opacity ?? 1"
					[attr.transform]="lbl.transform"
				>
					{{ lbl.text }}
				</text>
			}

			<!-- Zero line -->
			@if (vm().zeroLine) {
				<line
					[attr.x1]="vm().zeroLine!.x1"
					[attr.y1]="vm().zeroLine!.y1"
					[attr.x2]="vm().zeroLine!.x2"
					[attr.y2]="vm().zeroLine!.y2"
					[attr.stroke]="vm().zeroLine!.stroke"
					[attr.stroke-width]="vm().zeroLine!.strokeWidth"
				/>
			}

			<!-- Category-axis labels -->
			@for (lbl of vm().categoryLabels; track $index) {
				<text
					[attr.x]="lbl.x"
					[attr.y]="lbl.y"
					[attr.text-anchor]="lbl.textAnchor"
					[attr.font-size]="lbl.fontSize"
					[attr.fill]="lbl.fill"
					[attr.dominant-baseline]="lbl.dominantBaseline ?? 'auto'"
				>
					{{ lbl.text }}
				</text>
			}

			<!-- Data primitives (bars, lines, arcs, dots ...); data marks carry
			     data-chart-* hit-testing attributes (inert outside edit mode). -->
			<g pptx-chart-primitives [primitives]="vm().primitives"></g>

			<!-- Data labels -->
			@for (dl of vm().dataLabels; track $index) {
				<text
					[attr.x]="dl.x"
					[attr.y]="dl.y"
					[attr.text-anchor]="dl.textAnchor"
					[attr.font-size]="dl.fontSize"
					[attr.fill]="dl.fill"
					[attr.font-weight]="dl.fontWeight ?? 'normal'"
					[attr.dominant-baseline]="dl.dominantBaseline ?? 'auto'"
				>
					{{ dl.text }}
				</text>
			}

			<!-- Legend -->
			@if (legendItems().length > 0) {
				@for (item of legendItems(); track $index) {
					<g [attr.transform]="legendTransform(item)">
						<rect
							x="0"
							y="-7"
							[attr.width]="swatchSize"
							[attr.height]="swatchSize"
							rx="2"
							[attr.fill]="item.color"
						/>
						<text [attr.x]="swatchSize + 3" y="3" font-size="9" fill="#475569">
							{{ item.label }}
						</text>
					</g>
				}
			}
		</svg>
	`,
})
export class ChartRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly vm = computed<ChartViewModel>(() => buildChartViewModel(this.element()));
	readonly viewBox = computed(() => `0 0 ${this.vm().svgWidth} ${this.vm().svgHeight}`);
	readonly swatchSize = LEGEND_SWATCH_SIZE;
	readonly legendItems = computed(() => computeChartLegendLayout(this.vm()));

	legendTransform(item: { x: number; y: number }): string {
		return `translate(${item.x.toFixed(1)},${item.y.toFixed(1)})`;
	}
}
