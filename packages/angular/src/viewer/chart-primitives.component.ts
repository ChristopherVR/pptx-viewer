/**
 * ChartPrimitivesComponent: projects the shared `SvgPrimitive` descriptors of
 * a `ChartViewModel` (bars, lines, arcs, dots, ...) into SVG nodes. Split out
 * of `ChartRendererComponent` so the projector stays a thin template.
 *
 * Data-mark primitives tagged with a `ChartPartRef` additionally carry the
 * `data-chart-*` hit-testing attributes (via the shared `chartPartToAttrs`
 * bridge). The attributes are ALWAYS emitted: they are inert without pointer
 * events, and `ChartElementViewComponent` activates them in edit mode via
 * CSS + event delegation, mirroring React's chart-view-model projector.
 *
 * Selector: `g[pptx-chart-primitives]` (attribute selector so the host is a
 * plain SVG `<g>` inside the chart renderer's `<svg>`).
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import {
	CHART_PART_ATTR,
	CHART_PART_POINT_ATTR,
	CHART_PART_SERIES_ATTR,
	chartPartToAttrs,
} from '../internal/shared';
import type {
	ChartPartRef,
	SvgCircle,
	SvgLine,
	SvgPath,
	SvgPolygon,
	SvgPolyline,
	SvgPrimitive,
	SvgRect,
	SvgText,
} from './chart-renderer-helpers';

@Component({
	selector: 'g[pptx-chart-primitives]',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@for (prim of primitives(); track $index) {
			@switch (prim.kind) {
				@case ('rect') {
					<svg:rect
						[attr.x]="asRect(prim).x"
						[attr.y]="asRect(prim).y"
						[attr.width]="asRect(prim).w"
						[attr.height]="asRect(prim).h"
						[attr.fill]="asRect(prim).fill"
						[attr.rx]="asRect(prim).rx ?? 0"
						[attr.opacity]="asRect(prim).opacity ?? 1"
						[attr.data-chart-part]="partRole(prim)"
						[attr.data-chart-series]="partSeries(prim)"
						[attr.data-chart-point]="partPoint(prim)"
					>
						@if (asRect(prim).title !== undefined) {
							<svg:title>{{ asRect(prim).title }}</svg:title>
						}
					</svg:rect>
				}
				@case ('path') {
					<svg:path
						[attr.d]="asPath(prim).d"
						[attr.fill]="asPath(prim).fill"
						[attr.stroke]="asPath(prim).stroke ?? 'none'"
						[attr.stroke-width]="asPath(prim).strokeWidth ?? 0"
						[attr.fill-opacity]="asPath(prim).opacity ?? 1"
						[attr.data-chart-part]="partRole(prim)"
						[attr.data-chart-series]="partSeries(prim)"
						[attr.data-chart-point]="partPoint(prim)"
					>
						<!--
							The shared descriptor's tooltip, projected as the SVG title
							element. It is the shape's ACCESSIBLE NAME as well as its hover
							text, and a choropleth patch carries no label of its own: without
							it a region map announces nothing and names nothing.
						-->
						@if (asPath(prim).title !== undefined) {
							<svg:title>{{ asPath(prim).title }}</svg:title>
						}
					</svg:path>
				}
				@case ('polyline') {
					<svg:polyline
						[attr.points]="asPolyline(prim).points"
						[attr.stroke]="asPolyline(prim).stroke"
						[attr.stroke-width]="asPolyline(prim).strokeWidth"
						[attr.fill]="asPolyline(prim).fill"
						[attr.opacity]="asPolyline(prim).opacity ?? 1"
						[attr.data-chart-part]="partRole(prim)"
						[attr.data-chart-series]="partSeries(prim)"
						[attr.data-chart-point]="partPoint(prim)"
					>
						@if (asPolyline(prim).title !== undefined) {
							<svg:title>{{ asPolyline(prim).title }}</svg:title>
						}
					</svg:polyline>
				}
				@case ('circle') {
					<svg:circle
						[attr.cx]="asCircle(prim).cx"
						[attr.cy]="asCircle(prim).cy"
						[attr.r]="asCircle(prim).r"
						[attr.fill]="asCircle(prim).fill"
						[attr.opacity]="asCircle(prim).opacity ?? 1"
						[attr.data-chart-part]="partRole(prim)"
						[attr.data-chart-series]="partSeries(prim)"
						[attr.data-chart-point]="partPoint(prim)"
					>
						@if (asCircle(prim).title !== undefined) {
							<svg:title>{{ asCircle(prim).title }}</svg:title>
						}
					</svg:circle>
				}
				@case ('line') {
					<svg:line
						[attr.x1]="asLine(prim).x1"
						[attr.y1]="asLine(prim).y1"
						[attr.x2]="asLine(prim).x2"
						[attr.y2]="asLine(prim).y2"
						[attr.stroke]="asLine(prim).stroke"
						[attr.stroke-width]="asLine(prim).strokeWidth"
					>
						@if (asLine(prim).title !== undefined) {
							<svg:title>{{ asLine(prim).title }}</svg:title>
						}
					</svg:line>
				}
				@case ('polygon') {
					<svg:polygon
						[attr.points]="asPolygon(prim).points"
						[attr.fill]="asPolygon(prim).fill"
						[attr.stroke]="asPolygon(prim).stroke"
						[attr.stroke-width]="asPolygon(prim).strokeWidth"
						[attr.opacity]="asPolygon(prim).opacity ?? 1"
						[attr.stroke-dasharray]="asPolygon(prim).dashArray ?? null"
						[attr.data-chart-part]="partRole(prim)"
						[attr.data-chart-series]="partSeries(prim)"
						[attr.data-chart-point]="partPoint(prim)"
					>
						@if (asPolygon(prim).title !== undefined) {
							<svg:title>{{ asPolygon(prim).title }}</svg:title>
						}
					</svg:polygon>
				}
				@case ('text') {
					<svg:text
						[attr.x]="asText(prim).x"
						[attr.y]="asText(prim).y"
						[attr.text-anchor]="asText(prim).textAnchor"
						[attr.font-size]="asText(prim).fontSize"
						[attr.fill]="asText(prim).fill"
						[attr.font-weight]="asText(prim).fontWeight ?? 'normal'"
						[attr.dominant-baseline]="asText(prim).dominantBaseline ?? 'auto'"
						[attr.opacity]="asText(prim).opacity ?? 1"
						[attr.transform]="asText(prim).transform ?? null"
					>
						{{ asText(prim).text }}
					</svg:text>
				}
			}
		}
	`,
})
export class ChartPrimitivesComponent {
	readonly primitives = input.required<readonly SvgPrimitive[]>();

	/** `data-chart-*` attributes for a tagged data-mark primitive, else null. */
	private partAttrs(p: SvgPrimitive): Record<string, string> | null {
		const part = (p as { part?: ChartPartRef }).part;
		return part ? chartPartToAttrs(part) : null;
	}

	partRole(p: SvgPrimitive): string | null {
		return this.partAttrs(p)?.[CHART_PART_ATTR] ?? null;
	}
	partSeries(p: SvgPrimitive): string | null {
		return this.partAttrs(p)?.[CHART_PART_SERIES_ATTR] ?? null;
	}
	partPoint(p: SvgPrimitive): string | null {
		return this.partAttrs(p)?.[CHART_PART_POINT_ATTR] ?? null;
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
