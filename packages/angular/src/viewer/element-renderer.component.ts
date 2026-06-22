import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { ChartRendererComponent } from './chart-renderer.component';
import { ConnectorRendererComponent } from './connector-renderer.component';
import type { Rect } from './connector-routing';
import {
	getContainerStyle,
	getDuotoneFilterDef,
	getImageSrc,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from './element-style';
import type { StyleMap } from './element-style';
import { EquationRendererComponent } from './equation-renderer.component';
import { resolveHyperlinkHref } from './hyperlink';
import { InkRendererComponent } from './ink-renderer.component';
import { Model3DRendererComponent } from './model3d-renderer.component';
import { OleRendererComponent } from './ole-renderer.component';
import { SmartArt3DRendererComponent } from './smart-art-3d-renderer.component';
import { SmartArt3DService } from './smart-art-3d.service';
import { SmartArtRendererComponent } from './smart-art-renderer.component';
import { TableRendererComponent } from './table-renderer.component';
import type { TableCellCommit } from './table-renderer.component';
import { bulletIndentPx, resolveParagraphBullet } from './text-bullets';
import { getTextWarp } from './text-warp';
import type { TextWarpPathDef } from './text-warp';
import { ZoomRendererComponent } from './zoom-renderer.component';

interface TextRun {
	text: string;
	style: StyleMap;
	/** Safe `href` when this run carries a renderable hyperlink. */
	href?: string;
	/** Hyperlink tooltip / title text. */
	tooltip?: string;
	/** Parsed OMML for an inline equation run (rendered as MathML). */
	equationXml?: Record<string, unknown>;
	/** Optional equation number for numbered equations. */
	equationNumber?: string;
}

interface Paragraph {
	runs: TextRun[];
	/** Bullet / number marker text, when this paragraph is a list item. */
	bulletMarker?: string;
	/** `[ngStyle]` map for the bullet marker (colour / font). */
	bulletStyle: StyleMap;
	/** Left indent in px derived from the paragraph outline level. */
	indentPx: number;
}

/**
 * ElementRendererComponent: Angular port of the React `ElementRenderer.tsx`
 * and the Vue `ElementRenderer.vue`.
 *
 * Renders a single slide element by its `type` discriminant (viewer-first
 * subset):
 *  - `text` / `shape`    → positioned box with fill/stroke + rich text + effects
 *  - `connector`         → SVG straight/bent/curved connector
 *  - `chart`             → inline-SVG chart (bar/line/area/pie/scatter)
 *  - `table`             → HTML `<table>`
 *  - `smartArt`          → SVG drawing-shapes / node-text fallback
 *  - `ink`               → SVG ink strokes
 *  - `ole`               → embedded-object preview / icon
 *  - `model3d`           → poster / placeholder (no three.js)
 *  - `zoom`              → slide/section zoom thumbnail
 *  - `picture` / `image` → `<img>`
 *  - `media`             → poster frame (`<img>`); playback TODO
 *  - `group`             → recursive children (self-referencing selector)
 *  - everything else     → labelled placeholder (TODO, see PORTING.md)
 *
 * Interaction (selection, resize, inline editing) is not yet ported.
 */
@Component({
	selector: 'pptx-element-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgStyle,
		ConnectorRendererComponent,
		TableRendererComponent,
		ChartRendererComponent,
		SmartArtRendererComponent,
		SmartArt3DRendererComponent,
		InkRendererComponent,
		OleRendererComponent,
		Model3DRendererComponent,
		ZoomRendererComponent,
		EquationRendererComponent,
	],
	template: `
		@switch (true) {
			@case (element().type === 'connector') {
				<pptx-connector-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[obstacles]="obstacles()"
					[canvasWidth]="canvasWidth()"
					[canvasHeight]="canvasHeight()"
					[interactive]="interactive()"
				/>
			}
			@case (element().type === 'ink') {
				<pptx-ink-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[mediaDataUrls]="mediaDataUrls()"
				/>
			}
			@case (element().type === 'zoom') {
				<pptx-zoom-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[mediaDataUrls]="mediaDataUrls()"
				/>
			}
			@case (element().type === 'model3d') {
				<pptx-model3d-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[mediaDataUrls]="mediaDataUrls()"
				/>
			}
			@case (element().type === 'smartArt' && smartArt3D()) {
				<pptx-smart-art-3d-renderer [element]="element()" [zIndex]="zIndex()" />
			}
			@case (element().type === 'smartArt') {
				<div
					class="pptx-ng-element pptx-ng-smartart"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					<pptx-smart-art-renderer
						[element]="element()"
						[zIndex]="zIndex()"
						[editable]="interactive() && editable()"
					/>
				</div>
			}
			@case (element().type === 'ole') {
				<div
					class="pptx-ng-element pptx-ng-ole"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					<pptx-ole-renderer [element]="element()" [zIndex]="zIndex()" />
				</div>
			}
			@case (element().type === 'chart') {
				<div
					class="pptx-ng-element pptx-ng-chart"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					<pptx-chart-renderer [element]="element()" />
				</div>
			}
			@case (element().type === 'table') {
				<div
					class="pptx-ng-element pptx-ng-table"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					<pptx-table-renderer
						[element]="element()"
						[editable]="interactive() && editable()"
						(cellCommit)="cellCommit.emit({ id: element().id, commit: $event })"
					/>
				</div>
			}
			@case (element().type === 'group') {
				<div
					class="pptx-ng-element pptx-ng-group"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					@for (child of children(); track child.id) {
						<pptx-element-renderer
							[element]="child"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="$index"
							[interactive]="interactive()"
						/>
					}
				</div>
			}
			@case (isImageLike()) {
				<div
					class="pptx-ng-element pptx-ng-image"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					@if (imageSrc()) {
						<img [src]="imageSrc()" alt="" class="pptx-ng-img" />
					}
				</div>
			}
			@case (element().type === 'media') {
				<div
					class="pptx-ng-element pptx-ng-media"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					@if (imageSrc()) {
						<img [src]="imageSrc()" alt="" class="pptx-ng-img" />
					} @else {
						<div class="pptx-ng-placeholder">{{ placeholderLabel() }}</div>
					}
				</div>
			}
			@case (isShapeLike()) {
				<div
					class="pptx-ng-element pptx-ng-shape"
					[ngStyle]="shapeContainerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					@if (pathWarp(); as warp) {
						<svg
							[attr.width]="warp.width"
							[attr.height]="warp.height"
							[attr.viewBox]="'0 0 ' + warp.width + ' ' + warp.height"
							style="position: absolute; inset: 0; overflow: visible; pointer-events: none"
							aria-hidden="true"
						>
							<defs>
								@for (line of warp.pathLines; track line.pathId) {
									<path [attr.id]="line.pathId" [attr.d]="line.d" fill="none" />
								}
							</defs>
							@for (line of warp.pathLines; track line.pathId) {
								<text
									[attr.font-size]="warp.baseFontSize"
									[attr.font-family]="warp.baseFontFamily"
									[attr.fill]="warp.baseColor"
								>
									<textPath
										[attr.href]="'#' + line.pathId"
										[attr.startOffset]="warp.startOffset"
										[attr.text-anchor]="warp.textAnchor"
									>
										@for (seg of line.segments; track $index) {
											<tspan
												[attr.fill]="seg.style?.color ?? warp.baseColor"
												[attr.font-weight]="seg.style?.bold ? 700 : 400"
												[attr.font-style]="seg.style?.italic ? 'italic' : 'normal'"
											>
												{{ seg.text }}
											</tspan>
										}
									</textPath>
								</text>
							}
						</svg>
					} @else if (hasText()) {
						<div class="pptx-ng-text" [ngStyle]="warpedTextStyle()">
							@for (para of paragraphs(); track $index) {
								<p class="pptx-ng-para" [style.padding-left.px]="para.indentPx">
									@if (para.bulletMarker) {
										<span class="pptx-ng-bullet" [ngStyle]="para.bulletStyle"
											>{{ para.bulletMarker }}&nbsp;</span
										>
									}
									@for (run of para.runs; track $index) {
										@if (run.equationXml) {
											<pptx-equation-renderer
												[equationXml]="run.equationXml"
												[equationNumber]="run.equationNumber"
											/>
										} @else if (
											run.text ===
											'
'
										) {
											<br />
										} @else if (run.href) {
											<a
												class="pptx-ng-link"
												[href]="run.href"
												target="_blank"
												rel="noopener noreferrer"
												[attr.title]="run.tooltip ?? null"
												[ngStyle]="run.style"
												>{{ run.text }}</a
											>
										} @else {
											<span [ngStyle]="run.style">{{ run.text }}</span>
										}
									}
								</p>
							}
						</div>
					}
				</div>
			}
			@default {
				<div
					class="pptx-ng-element pptx-ng-unsupported"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					<div class="pptx-ng-placeholder">{{ placeholderLabel() }}</div>
				</div>
			}
		}

		<!-- Duotone image-effect <filter> def, referenced via filter: url(#id). -->
		@if (duotoneFilter(); as df) {
			<svg
				width="0"
				height="0"
				aria-hidden="true"
				style="position: absolute; width: 0; height: 0; overflow: hidden"
			>
				<defs>
					<filter [attr.id]="df.id" color-interpolation-filters="sRGB">
						<feColorMatrix type="matrix" [attr.values]="df.primitives[0].values" />
						<feComponentTransfer>
							<feFuncR
								type="linear"
								[attr.slope]="df.primitives[1].channels[0].slope"
								[attr.intercept]="df.primitives[1].channels[0].intercept"
							/>
							<feFuncG
								type="linear"
								[attr.slope]="df.primitives[1].channels[1].slope"
								[attr.intercept]="df.primitives[1].channels[1].intercept"
							/>
							<feFuncB
								type="linear"
								[attr.slope]="df.primitives[1].channels[2].slope"
								[attr.intercept]="df.primitives[1].channels[2].intercept"
							/>
						</feComponentTransfer>
					</filter>
				</defs>
			</svg>
		}
	`,
})
export class ElementRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zIndex = input<number>(0);

	/**
	 * Host opt-in to the Three.js SmartArt renderer, surfaced via the
	 * viewer-scoped {@link SmartArt3DService}. Optional so renderers used outside
	 * the viewer subtree (thumbnails, export) default to the SVG renderer.
	 */
	private readonly smartArt3DService = inject(SmartArt3DService, { optional: true });
	readonly smartArt3D = computed(() => this.smartArt3DService?.enabled() ?? false);
	/** Obstacle rects (absolute slide coords) for connector A* routing. */
	readonly obstacles = input<readonly Rect[]>([]);
	readonly canvasWidth = input<number>(0);
	readonly canvasHeight = input<number>(0);
	/**
	 * When true (default), the element host carries the framework-neutral
	 * `data-pptx-element="true"` contract attribute (used by selection + the
	 * shared e2e specs). Thumbnail / preview / presentation canvases pass `false`
	 * so they don't pollute the contract selectors, mirroring React, where only
	 * the main editing canvas exposes the element contract (thumbnails use a
	 * separate lightweight renderer).
	 */
	readonly interactive = input<boolean>(true);

	/** Whether inline editing (e.g. table-cell text input) is enabled. */
	readonly editable = input<boolean>(false);

	/** Emitted when a table cell's text edit is committed. */
	readonly cellCommit = output<{ id: string; commit: TableCellCommit }>();

	/** Duotone SVG `<filter>` descriptor for this element, if any. */
	readonly duotoneFilter = computed(() => getDuotoneFilterDef(this.element()));

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);
	readonly shapeContainerStyle = computed<StyleMap>(() => ({
		...this.containerStyle(),
		...getShapeFillStrokeStyle(this.element()),
	}));
	readonly textStyle = computed<StyleMap>(() => getTextBlockStyle(this.element()));
	readonly imageSrc = computed(() => getImageSrc(this.element(), this.mediaDataUrls()));

	/** Text-warp (WordArt) descriptor for the element, if any. */
	readonly textWarp = computed(() => getTextWarp(this.element()));
	/** Only the SVG-textPath warp variant (for the `<svg>` overlay branch). */
	readonly pathWarp = computed<TextWarpPathDef | undefined>(() => {
		const w = this.textWarp();
		return w?.strategy === 'path' ? w : undefined;
	});
	/** Text block style, folding in a CSS-transform warp when present. */
	readonly warpedTextStyle = computed<StyleMap>(() => {
		const base = this.textStyle();
		const w = this.textWarp();
		if (w?.strategy === 'css') {
			return { ...base, transform: w.cssTransform, 'transform-origin': w.cssTransformOrigin };
		}
		return base;
	});

	readonly children = computed<PptxElement[]>(() => {
		const el = this.element();
		return el.type === 'group' ? (el.children ?? []) : [];
	});

	readonly isShapeLike = computed(
		() => this.element().type === 'text' || this.element().type === 'shape',
	);
	readonly isImageLike = computed(
		() => this.element().type === 'picture' || this.element().type === 'image',
	);

	readonly paragraphs = computed<Paragraph[]>(() => {
		const el = this.element();
		if (!hasTextProperties(el)) {
			return [];
		}
		const segments = el.textSegments;
		if (!segments || segments.length === 0) {
			return el.text
				? [{ runs: [{ text: el.text, style: {} }], bulletStyle: {}, indentPx: 0 }]
				: [];
		}
		const out: Paragraph[] = [{ runs: [], bulletStyle: {}, indentPx: 0 }];
		let paraStarted = false;
		for (const seg of segments) {
			if (seg.isParagraphBreak) {
				out.push({ runs: [], bulletStyle: {}, indentPx: 0 });
				paraStarted = false;
				continue;
			}
			const current = out[out.length - 1];
			// The first segment of each paragraph carries its bullet + outline level.
			if (!paraStarted) {
				paraStarted = true;
				current.indentPx = bulletIndentPx(seg.paragraphLevel);
				const bullet = resolveParagraphBullet(seg);
				if (bullet) {
					current.bulletMarker = bullet.marker;
					if (bullet.color) {
						current.bulletStyle['color'] = bullet.color;
					}
					if (bullet.fontFamily) {
						current.bulletStyle['font-family'] = bullet.fontFamily;
					}
				}
			}
			if (seg.equationXml) {
				current.runs.push({
					text: '',
					style: this.segmentStyle(seg),
					equationXml: seg.equationXml,
					equationNumber: seg.equationNumber,
				});
				continue;
			}
			const text = seg.isLineBreak ? '\n' : seg.text;
			if (text) {
				const href = resolveHyperlinkHref(seg.style?.hyperlink);
				current.runs.push({
					text,
					style: this.segmentStyle(seg),
					href,
					tooltip: href ? seg.style?.hyperlinkTooltip : undefined,
				});
			}
		}
		return out.filter((p) => p.runs.length > 0 || p.bulletMarker !== undefined || out.length === 1);
	});

	readonly hasText = computed(() =>
		this.paragraphs().some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
	);

	readonly placeholderLabel = computed(() => {
		const map: Record<string, string> = {
			group: 'Group',
			media: 'Media',
		};
		return map[this.element().type] ?? this.element().type;
	});

	private segmentStyle(seg: TextSegment): StyleMap {
		const s = seg.style ?? {};
		const style: StyleMap = {};
		if (s.fontFamily) {
			style['font-family'] = s.fontFamily;
		}
		if (typeof s.fontSize === 'number') {
			style['font-size'] = `${s.fontSize}px`;
		}
		if (s.color) {
			style['color'] = s.color;
		}
		if (s.bold) {
			style['font-weight'] = 'bold';
		}
		if (s.italic) {
			style['font-style'] = 'italic';
		}
		const deco: string[] = [];
		if (s.underline) {
			deco.push('underline');
		}
		if (s.strikethrough) {
			deco.push('line-through');
		}
		if (deco.length > 0) {
			style['text-decoration'] = deco.join(' ');
		}
		return style;
	}
}
