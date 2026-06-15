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

import { buildChartViewModel } from './chart-renderer-helpers';
import type {
	ChartViewModel,
	SvgCircle,
	SvgLine,
	SvgPath,
	SvgPolygon,
	SvgPolyline,
	SvgPrimitive,
	SvgRect,
	SvgText,
} from './chart-renderer-helpers';

export type { ChartViewModel };

const LEGEND_SWATCH_SIZE = 10;
const LEGEND_ITEM_WIDTH = 80;

@Component({
	selector: 'pptx-chart-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [],
	template: `
		<svg
			[attr.width]="vm().svgWidth"
			[attr.height]="vm().svgHeight"
			[attr.viewBox]="viewBox()"
			class="pptx-ng-chart-svg"
			style="overflow: visible; display: block; pointer-events: none;"
		>
			<!-- Background tint -->
			<rect
				x="0"
				y="0"
				[attr.width]="vm().svgWidth"
				[attr.height]="vm().svgHeight"
				fill="#0f172a0d"
			/>

			<!-- Chart title -->
			@if (vm().title) {
				<text
					[attr.x]="vm().titleX"
					[attr.y]="vm().titleY"
					text-anchor="middle"
					font-size="12"
					font-weight="600"
					fill="#1e293b"
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

			<!-- Data primitives (bars, lines, arcs, dots ...) -->
			@for (prim of vm().primitives; track $index) {
				@switch (prim.kind) {
					@case ('rect') {
						<rect
							[attr.x]="asRect(prim).x"
							[attr.y]="asRect(prim).y"
							[attr.width]="asRect(prim).w"
							[attr.height]="asRect(prim).h"
							[attr.fill]="asRect(prim).fill"
							[attr.rx]="asRect(prim).rx ?? 0"
							[attr.opacity]="asRect(prim).opacity ?? 1"
						/>
					}
					@case ('path') {
						<path
							[attr.d]="asPath(prim).d"
							[attr.fill]="asPath(prim).fill"
							[attr.stroke]="asPath(prim).stroke ?? 'none'"
							[attr.stroke-width]="asPath(prim).strokeWidth ?? 0"
						/>
					}
					@case ('polyline') {
						<polyline
							[attr.points]="asPolyline(prim).points"
							[attr.stroke]="asPolyline(prim).stroke"
							[attr.stroke-width]="asPolyline(prim).strokeWidth"
							[attr.fill]="asPolyline(prim).fill"
							[attr.opacity]="asPolyline(prim).opacity ?? 1"
						/>
					}
					@case ('circle') {
						<circle
							[attr.cx]="asCircle(prim).cx"
							[attr.cy]="asCircle(prim).cy"
							[attr.r]="asCircle(prim).r"
							[attr.fill]="asCircle(prim).fill"
							[attr.opacity]="asCircle(prim).opacity ?? 1"
						/>
					}
					@case ('line') {
						<line
							[attr.x1]="asLine(prim).x1"
							[attr.y1]="asLine(prim).y1"
							[attr.x2]="asLine(prim).x2"
							[attr.y2]="asLine(prim).y2"
							[attr.stroke]="asLine(prim).stroke"
							[attr.stroke-width]="asLine(prim).strokeWidth"
						/>
					}
					@case ('polygon') {
						<polygon
							[attr.points]="asPolygon(prim).points"
							[attr.fill]="asPolygon(prim).fill"
							[attr.stroke]="asPolygon(prim).stroke"
							[attr.stroke-width]="asPolygon(prim).strokeWidth"
							[attr.opacity]="asPolygon(prim).opacity ?? 1"
							[attr.stroke-dasharray]="asPolygon(prim).dashArray ?? null"
						/>
					}
				}
			}

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
			@if (vm().legend.length > 0) {
				@for (entry of vm().legend; track $index) {
					<g [attr.transform]="legendTransform($index)">
						<rect
							x="0"
							y="-7"
							[attr.width]="swatchSize"
							[attr.height]="swatchSize"
							rx="2"
							[attr.fill]="entry.color"
						/>
						<text [attr.x]="swatchSize + 3" y="3" font-size="9" fill="#475569">
							{{ entry.label }}
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

	legendTransform(index: number): string {
		const v = this.vm();
		const isVertical = v.legendAnchor === 'start';
		const x = isVertical
			? v.legendX
			: v.legendX - (v.legend.length * LEGEND_ITEM_WIDTH) / 2 + index * LEGEND_ITEM_WIDTH;
		const y = isVertical ? v.legendY + index * 14 : v.legendY;
		return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
	}

	asRect(p: SvgPrimitive): SvgRect {
		return p as SvgRect;
	}
	asPath(p: SvgPrimitive): SvgPath {
		return p as SvgPath;
	}
	asPolyline(p: SvgPrimitive): SvgPolyline {
		return p as SvgPolyline;
	}
	asCircle(p: SvgPrimitive): SvgCircle {
		return p as SvgCircle;
	}
	asLine(p: SvgPrimitive): SvgLine {
		return p as SvgLine;
	}
	asPolygon(p: SvgPrimitive): SvgPolygon {
		return p as SvgPolygon;
	}
	asText(p: SvgPrimitive): SvgText {
		return p as SvgText;
	}
}
