import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';
import { layoutSmartArtNodes } from './smart-art-layouts';
import type { SmartArtLayoutResult } from './smart-art-layouts';
import {
	buildChromeStyle,
	buildFallbackBlocks,
	computeDrawingViewBox,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from './smart-art-renderer-helpers';
import type { DrawingViewBox, FallbackBlock, RenderedShape } from './smart-art-renderer-helpers';

/**
 * SmartArtRendererComponent: Angular port of the Vue `SmartArtRenderer.vue`
 * (packages/vue/src/viewer/components/SmartArtRenderer.vue).
 *
 * Viewer-first subset: renders from pre-computed drawing shapes
 * (`smartArtData.drawingShapes`) when present, otherwise falls back to a
 * stacked coloured block list of node text. When neither is available a small
 * "SmartArt" placeholder is shown.
 *
 * Editing, interaction, and the full family-specific layout renderers
 * (hierarchy / cycle / process / …) are out of scope; tracked in PORTING.md.
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
						[attr.viewBox]="layoutViewBox()"
						preserveAspectRatio="xMidYMid meet"
					>
						@for (conn of layoutResult().connectors; track $index) {
							<line
								[attr.x1]="conn.x1"
								[attr.y1]="conn.y1"
								[attr.x2]="conn.x2"
								[attr.y2]="conn.y2"
								stroke="rgba(148, 163, 184, 0.7)"
								stroke-width="1.5"
							/>
						}
						@for (node of layoutResult().nodes; track node.id) {
							@if (node.r) {
								<circle
									[attr.cx]="node.x + node.r"
									[attr.cy]="node.y + node.r"
									[attr.r]="node.r"
									[attr.fill]="nodeFill(node.level)"
								/>
							} @else {
								<rect
									[attr.x]="node.x"
									[attr.y]="node.y"
									[attr.width]="node.w"
									[attr.height]="node.h"
									rx="4"
									[attr.fill]="nodeFill(node.level)"
								/>
							}
							@if (node.text) {
								<text
									[attr.x]="node.x + node.w / 2"
									[attr.y]="node.y + node.h / 2"
									text-anchor="middle"
									dominant-baseline="central"
									fill="#ffffff"
									font-size="11"
								>
									{{ node.text }}
								</text>
							}
						}
					</svg>
				} @else {
					<div class="pptx-ng-smartart-list">
						@for (block of fallbackBlocks(); track block.key) {
							<div class="pptx-ng-smartart-block" [ngStyle]="{ 'background-color': block.fill }">
								{{ block.text }}
							</div>
						}
					</div>
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

		.pptx-ng-smartart-list {
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			gap: 4px;
			padding: 4px;
			box-sizing: border-box;
			overflow: hidden;
		}

		.pptx-ng-smartart-block {
			flex: 1 1 0;
			min-height: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 2px 6px;
			border-radius: 4px;
			color: #fff;
			font-size: 12px;
			text-align: center;
			overflow: hidden;
		}
	`,
})
export class SmartArtRendererComponent {
	/** The smartArt element to render. Must be `type === 'smartArt'`. */
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);

	// ── Raw SmartArt data ──────────────────────────────────────────────────

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);

	readonly chromeStyle = computed<StyleMap>(() => {
		const el = this.element();
		const chrome = el.type === 'smartArt' ? el.smartArtData?.chrome : undefined;
		return buildChromeStyle(chrome);
	});

	readonly palette = computed<string[]>(() => {
		const el = this.element();
		return resolvePalette(el.type === 'smartArt' ? el.smartArtData : undefined);
	});

	readonly artStyle = computed(() => {
		const el = this.element();
		return el.type === 'smartArt' ? (el.smartArtData?.style ?? 'flat') : 'flat';
	});

	readonly nodes = computed(() => {
		const el = this.element();
		return el.type === 'smartArt' ? (el.smartArtData?.nodes ?? []) : [];
	});

	// ── Drawing-shape path ─────────────────────────────────────────────────

	readonly rawDrawingShapes = computed(() => {
		const el = this.element();
		return el.type === 'smartArt' ? (el.smartArtData?.drawingShapes ?? []) : [];
	});

	readonly hasDrawingShapes = computed(() => this.rawDrawingShapes().length > 0);

	readonly viewBox = computed<DrawingViewBox>(() => computeDrawingViewBox(this.rawDrawingShapes()));

	/** `viewBox` attribute string for the `<svg>` element. */
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

	readonly shadowFilter = computed<string | undefined>(() => styleShadowFilter(this.artStyle()));

	// ── Family layout fallback (when no authored drawing shapes) ────────────

	readonly layoutResult = computed<SmartArtLayoutResult>(() => {
		const el = this.element();
		const data = el.type === 'smartArt' ? el.smartArtData : undefined;
		if (!data) {
			return { nodes: [], connectors: [] };
		}
		return layoutSmartArtNodes(data, Math.max(el.width, 1), Math.max(el.height, 1));
	});

	readonly hasLayout = computed(() => this.layoutResult().nodes.length > 0);

	readonly layoutViewBox = computed<string>(() => {
		const el = this.element();
		return `0 0 ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`;
	});

	/** Palette colour for a node at the given depth level. */
	nodeFill(level: number): string {
		const p = this.palette();
		return p[level % p.length] ?? p[0];
	}

	// ── Fallback block list ────────────────────────────────────────────────

	readonly fallbackBlocks = computed<FallbackBlock[]>(() =>
		buildFallbackBlocks(this.element().id, this.nodes(), this.palette()),
	);

	// ── Empty / no-data state ──────────────────────────────────────────────

	readonly isEmpty = computed(() => this.nodes().length === 0 && !this.hasDrawingShapes());
}

// Re-export helper types used in the template so template type-checking works.
export type { DrawingViewBox, FallbackBlock, RenderedShape };
