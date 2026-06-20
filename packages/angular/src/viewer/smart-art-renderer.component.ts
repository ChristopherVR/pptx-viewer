import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { computeSmartArtLayout } from '../internal/shared';
import type {
	RenderedCircleNode,
	RenderedNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtLayoutResult,
} from '../internal/shared';
import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';
import {
	buildChromeStyle,
	computeDrawingViewBox,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from './smart-art-drawing';
import type { DrawingViewBox, RenderedShape } from './smart-art-drawing';

/**
 * SmartArtRendererComponent: Angular SmartArt renderer.
 *
 * Data path mirrors the Vue `SmartArtRenderer.vue` and the React renderer:
 *  1. **Drawing shapes** (`smartArtData.drawingShapes`) — the preferred path
 *     when the core extracted per-shape geometry from `ppt/diagrams/drawing*.xml`.
 *  2. **Shared SVG-fallback engine** (`computeSmartArtLayout`) — when no drawing
 *     shapes exist, the framework-agnostic engine in `pptx-viewer-shared`
 *     positions/styles the node tree across all 10 layout families (list /
 *     process / cycle / hierarchy / matrix / radial / pyramid / venn / funnel /
 *     target), returning `RenderedNode[]` (rect / circle / polygon) +
 *     `RenderedConnector[]` view-models. Every binding renders the same
 *     geometry; this maps those view-models to SVG exactly as Vue does.
 *  3. **Placeholder** — when there is neither data nor any nodes/shapes.
 */
@Component({
	selector: 'pptx-smart-art-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div
			class="pptx-ng-element pptx-ng-smartart"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
		>
			<div class="pptx-ng-smartart-chrome" [ngStyle]="chromeStyle()">
				@if (isEmpty()) {
					<div class="pptx-ng-smartart-placeholder">SmartArt</div>
				} @else if (hasDrawingShapes()) {
					<svg
						class="pptx-ng-smartart-svg"
						[attr.viewBox]="svgViewBox()"
						preserveAspectRatio="xMidYMid meet"
					>
						@for (shape of renderedShapes(); track shape.key) {
							<g [ngStyle]="shadowFilter() ? { filter: shadowFilter() } : {}">
								@if (shape.isEllipse) {
									<ellipse
										[attr.cx]="shape.cx"
										[attr.cy]="shape.cy"
										[attr.rx]="shape.width / 2"
										[attr.ry]="shape.height / 2"
										[attr.fill]="shape.fill"
										[attr.stroke]="shape.stroke"
										[attr.stroke-width]="shape.strokeWidth"
										[attr.transform]="shape.transform ?? null"
									/>
								} @else {
									<rect
										[attr.x]="shape.x"
										[attr.y]="shape.y"
										[attr.width]="shape.width"
										[attr.height]="shape.height"
										[attr.rx]="shape.rx"
										[attr.fill]="shape.fill"
										[attr.stroke]="shape.stroke"
										[attr.stroke-width]="shape.strokeWidth"
										[attr.transform]="shape.transform ?? null"
									/>
								}
								@if (shape.text) {
									<text
										[attr.x]="shape.textX"
										[attr.y]="shape.textY"
										text-anchor="middle"
										dominant-baseline="central"
										[attr.fill]="shape.fontColor"
										[attr.font-size]="shape.fontSize"
									>
										{{ shape.text }}
									</text>
								}
							</g>
						}
					</svg>
				} @else if (hasLayout()) {
					<svg
						class="pptx-ng-smartart-svg"
						[attr.viewBox]="layout().viewBox"
						preserveAspectRatio="xMidYMid meet"
						[attr.data-layout-family]="layout().family"
					>
						@for (conn of layout().connectors; track conn.key) {
							<path
								[attr.d]="conn.d"
								fill="none"
								stroke="#94a3b8"
								stroke-width="1.5"
								opacity="0.5"
							/>
						}
						@for (node of layout().nodes; track node.key) {
							<g [ngStyle]="shadowFilter() ? { filter: shadowFilter() } : {}">
								@if (asCircle(node); as c) {
									<circle
										[attr.cx]="c.cx"
										[attr.cy]="c.cy"
										[attr.r]="c.r"
										[attr.fill]="c.fill"
										[attr.stroke]="c.stroke"
										[attr.stroke-width]="c.strokeWidth"
										[attr.opacity]="c.opacity"
									/>
									<text
										[attr.x]="c.cx"
										[attr.y]="c.cy"
										text-anchor="middle"
										dominant-baseline="central"
										fill="white"
										[attr.font-size]="c.fontSize"
									>
										{{ c.text }}
									</text>
								} @else if (asPolygon(node); as p) {
									<polygon
										[attr.points]="p.points"
										[attr.fill]="p.fill"
										[attr.stroke]="p.stroke"
										[attr.stroke-width]="p.strokeWidth"
										[attr.opacity]="p.opacity"
									/>
									<text
										[attr.x]="p.textX"
										[attr.y]="p.textY"
										text-anchor="middle"
										dominant-baseline="central"
										fill="white"
										[attr.font-size]="p.fontSize"
									>
										{{ p.text }}
									</text>
								} @else if (asRect(node); as r) {
									<rect
										[attr.x]="r.x"
										[attr.y]="r.y"
										[attr.width]="r.width"
										[attr.height]="r.height"
										[attr.rx]="r.rx"
										[attr.fill]="r.fill"
										[attr.stroke]="r.stroke"
										[attr.stroke-width]="r.strokeWidth"
										[attr.opacity]="r.opacity"
									/>
									<text
										[attr.x]="r.textX"
										[attr.y]="r.textY"
										text-anchor="middle"
										dominant-baseline="central"
										fill="white"
										[attr.font-size]="r.fontSize"
									>
										{{ r.text }}
									</text>
								}
							</g>
						}
					</svg>
				} @else {
					<div class="pptx-ng-smartart-placeholder">SmartArt</div>
				}
			</div>
		</div>
	`,
	styles: `
		.pptx-ng-smartart-chrome {
			box-sizing: border-box;
			overflow: hidden;
		}

		.pptx-ng-smartart-svg {
			width: 100%;
			height: 100%;
			pointer-events: none;
		}

		.pptx-ng-smartart-placeholder {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 11px;
			color: rgba(255, 255, 255, 0.8);
			pointer-events: none;
		}
	`,
})
export class SmartArtRendererComponent {
	/** The smartArt element to render. Must be `type === 'smartArt'`. */
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);

	private readonly smartArtData = computed(() => {
		const el = this.element();
		return el.type === 'smartArt' ? el.smartArtData : undefined;
	});

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);

	readonly chromeStyle = computed<StyleMap>(() => buildChromeStyle(this.smartArtData()?.chrome));

	readonly palette = computed<string[]>(() => resolvePalette(this.smartArtData()));

	readonly artStyle = computed(() => this.smartArtData()?.style ?? 'flat');

	readonly nodes = computed(() => this.smartArtData()?.nodes ?? []);

	readonly shadowFilter = computed<string | undefined>(() => styleShadowFilter(this.artStyle()));

	private readonly rawDrawingShapes = computed(() => this.smartArtData()?.drawingShapes ?? []);

	readonly hasDrawingShapes = computed(() => this.rawDrawingShapes().length > 0);

	private readonly viewBox = computed<DrawingViewBox>(() =>
		computeDrawingViewBox(this.rawDrawingShapes()),
	);

	/** `viewBox` attribute string for the drawing-shapes `<svg>`. */
	readonly svgViewBox = computed<string>(() => {
		const vb = this.viewBox();
		return `0 0 ${vb.width} ${vb.height}`;
	});

	readonly renderedShapes = computed<RenderedShape[]>(() =>
		projectDrawingShapes(
			this.element().id,
			this.rawDrawingShapes(),
			this.viewBox(),
			this.palette(),
			this.artStyle(),
		),
	);

	// ── Shared SVG-fallback engine (no drawing shapes) ──────────────────────

	readonly layout = computed<SmartArtLayoutResult>(() => {
		const el = this.element();
		const data = this.smartArtData();
		return computeSmartArtLayout(
			this.nodes(),
			{ width: Math.max(el.width, 1), height: Math.max(el.height, 1) },
			this.palette(),
			this.artStyle(),
			el.id,
			data?.resolvedLayoutType,
			data?.layout,
		);
	});

	readonly hasLayout = computed(() => this.layout().nodes.length > 0);

	/** Narrow a `RenderedNode` to a circle, or `undefined`. */
	asCircle(node: RenderedNode): RenderedCircleNode | undefined {
		return node.kind === 'circle' ? node : undefined;
	}

	/** Narrow a `RenderedNode` to a polygon, or `undefined`. */
	asPolygon(node: RenderedNode): RenderedPolygonNode | undefined {
		return node.kind === 'polygon' ? node : undefined;
	}

	/** Narrow a `RenderedNode` to a rect, or `undefined`. */
	asRect(node: RenderedNode): RenderedRectNode | undefined {
		return node.kind === 'rect' ? node : undefined;
	}

	// ── Empty / no-data state ──────────────────────────────────────────────

	readonly isEmpty = computed(() => this.nodes().length === 0 && !this.hasDrawingShapes());
}

// Re-export helper types used in the template so template type-checking works.
export type { DrawingViewBox, RenderedShape };
