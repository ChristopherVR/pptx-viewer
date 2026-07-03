import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { PptxElement, PptxTableData, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	buildRunEffectStyle,
	buildTextBody3DSceneStyle,
	resolveUnderlineDecorationStyle,
	segmentStyleToCss,
	substituteFieldText,
} from '../internal/shared';
import type { FieldSubstitutionContext } from '../internal/shared';
import { ChartRendererComponent } from './chart-renderer.component';
import { getClrChangeParams } from './color-changed-image-helpers';
import type { ClrChangeParams } from './color-changed-image-helpers';
import { ColorChangedImageComponent } from './color-changed-image.component';
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
import { MediaRendererComponent } from './media-renderer.component';
import { Model3DRendererComponent } from './model3d-renderer.component';
import { OleRendererComponent } from './ole-renderer.component';
import { SmartArt3DRendererComponent } from './smart-art-3d-renderer.component';
import { SmartArt3DService } from './smart-art-3d.service';
import { SmartArtRendererComponent } from './smart-art-renderer.component';
import { TableRendererComponent } from './table-renderer.component';
import type { TableCellCommit } from './table-renderer.component';
import { showsTemplateAffordance } from './template-mode';
import { bulletIndentPx, resolveParagraphBullet } from './text-bullets';
import { getTextWarp } from './text-warp';
import type { TextWarpPathDef } from './text-warp';
import { ZoomRendererComponent } from './zoom-renderer.component';

/**
 * Build a run's `[ngStyle]` map from a text segment, layering the underline /
 * double-strike *variant* decoration (`text-decoration-style` / `-thickness` /
 * `text-underline-offset`) on top of the shared `segmentStyleToCss` output.
 *
 * The shared helper only emits the boolean `text-decoration: underline`; this
 * mirrors React's segment renderer (`text-segment-render.tsx`), which applies
 * `resolveUnderlineDecorationStyle` over the boolean underline to make the 16
 * OOXML underline styles visually distinct. Kept additive in the Angular
 * renderer so the shared helper's contract stays stable for its other consumers.
 */
function runStyleFromSegment(seg: TextSegment): StyleMap {
	const style = segmentStyleToCss(seg);
	const s = seg.style;
	if (s) {
		const isDoubleStrike = Boolean(s.strikethrough && s.strikeType === 'dblStrike');
		const deco = resolveUnderlineDecorationStyle(
			isDoubleStrike,
			s.underline ? s.underlineStyle : undefined,
		);
		if (deco) {
			if (deco.textDecorationStyle !== undefined) {
				style['text-decoration-style'] = deco.textDecorationStyle;
			}
			if (deco.textDecorationThickness !== undefined) {
				style['text-decoration-thickness'] = deco.textDecorationThickness;
			}
			if (deco.textUnderlineOffset !== undefined) {
				style['text-underline-offset'] = deco.textUnderlineOffset;
			}
		}
		// Per-run text effects (gradient/pattern fill, outer/inner shadow, 3D
		// extrusion text-shadow, blur, HSL, alpha opacity, glow, reflection),
		// mirroring React's per-run span style. No-op {} for plain runs.
		Object.assign(style, buildRunEffectStyle(s));
	}
	return style;
}

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
 *  - `media`             → native `<video>`/`<audio>` playback, poster fallback
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
		MediaRendererComponent,
		OleRendererComponent,
		Model3DRendererComponent,
		ZoomRendererComponent,
		EquationRendererComponent,
		ColorChangedImageComponent,
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
				<pptx-smart-art-3d-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[canEdit]="interactive() && editable()"
				/>
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
						(tableChange)="tableChange.emit($event)"
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
							[fieldContext]="fieldContext()"
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
					@if (imageSrc(); as src) {
						@if (clrChangeParams(); as cc) {
							<pptx-color-changed-image
								[src]="src"
								[clrChange]="cc"
								alt=""
								imgClass="pptx-ng-img"
							/>
						} @else {
							<img [src]="src" alt="" class="pptx-ng-img" />
						}
					}
				</div>
			}
			@case (element().type === 'media') {
				<pptx-media-renderer
					[element]="element()"
					[mediaDataUrls]="mediaDataUrls()"
					[zIndex]="zIndex()"
					[interactive]="interactive()"
					[placeholderLabel]="placeholderLabel()"
				/>
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

	/**
	 * OOXML field-substitution context (slide number, date/time, header/footer,
	 * slide title, custom doc properties). Built once per slide by the slide
	 * canvas and threaded down (including to recursive group children) so field
	 * runs resolve to display text, mirroring React's `fieldContext`.
	 */
	readonly fieldContext = input<FieldSubstitutionContext | undefined>(undefined);

	/**
	 * When true, inherited master/layout (template) elements get a visual
	 * affordance (amber outline ring + slightly reduced opacity) signalling that
	 * they are now directly editable. Has no effect on normal slide elements, and
	 * no effect at all when false, so default rendering is untouched.
	 */
	readonly editTemplateMode = input<boolean>(false);

	/** Emitted when a table cell's text edit is committed. */
	readonly cellCommit = output<{ id: string; commit: TableCellCommit }>();

	/** Emitted when a structural table change (drag-resize) should be persisted. */
	readonly tableChange = output<{ id: string; tableData: PptxTableData }>();

	/** Duotone SVG `<filter>` descriptor for this element, if any. */
	readonly duotoneFilter = computed(() => getDuotoneFilterDef(this.element()));

	/**
	 * Outline ring + slight transparency applied to inherited template
	 * (master/layout) elements while editTemplateMode is on. Empty otherwise, so
	 * normal rendering is never altered.
	 */
	readonly templateAffordanceStyle = computed<StyleMap>(() => {
		const empty: StyleMap = {};
		if (!showsTemplateAffordance(this.element(), this.editTemplateMode())) {
			return empty;
		}
		const active: StyleMap = {
			outline: '1px dashed #f59e0b',
			'outline-offset': '1px',
			opacity: '0.95',
		};
		return active;
	});

	readonly containerStyle = computed<StyleMap>(() => ({
		...getContainerStyle(this.element(), this.zIndex()),
		...this.templateAffordanceStyle(),
	}));
	readonly shapeContainerStyle = computed<StyleMap>(() => ({
		...getContainerStyle(this.element(), this.zIndex()),
		...getShapeFillStrokeStyle(this.element()),
		...this.templateAffordanceStyle(),
	}));
	readonly textStyle = computed<StyleMap>(() => getTextBlockStyle(this.element()));
	readonly imageSrc = computed(() => getImageSrc(this.element(), this.mediaDataUrls()));

	/**
	 * Parsed `<a:clrChange>` colour-change effect for this element, or
	 * `undefined` when it carries none. When present the image / media branch
	 * renders via {@link ColorChangedImageComponent} (offscreen-canvas chroma
	 * key) instead of a plain `<img>`.
	 */
	readonly clrChangeParams = computed<ClrChangeParams | undefined>(() =>
		getClrChangeParams(this.element()),
	);

	/** Text-warp (WordArt) descriptor for the element, if any. */
	readonly textWarp = computed(() => getTextWarp(this.element(), this.fieldContext()));
	/** Only the SVG-textPath warp variant (for the `<svg>` overlay branch). */
	readonly pathWarp = computed<TextWarpPathDef | undefined>(() => {
		const w = this.textWarp();
		return w?.strategy === 'path' ? w : undefined;
	});
	/** Text block 3D scene style (a:bodyPr/a:scene3d), mirroring React's ElementBody. */
	readonly scene3dStyle = computed<StyleMap | undefined>(() => {
		const el = this.element();
		const textStyleRaw = hasTextProperties(el) ? el.textStyle : undefined;
		return buildTextBody3DSceneStyle(textStyleRaw);
	});

	/**
	 * Text block style, folding in a CSS-transform warp and the 3D scene
	 * (perspective + rotation) when present. The warp transform and the scene
	 * transform are composed rather than clobbering each other.
	 */
	readonly warpedTextStyle = computed<StyleMap>(() => {
		const base = this.textStyle();
		const scene = this.scene3dStyle();
		const merged: StyleMap = scene ? { ...base, ...scene } : { ...base };
		const w = this.textWarp();
		if (w?.strategy === 'css') {
			const sceneTransform = scene?.transform;
			merged.transform = sceneTransform
				? `${w.cssTransform} ${String(sceneTransform)}`
				: w.cssTransform;
			merged['transform-origin'] = w.cssTransformOrigin;
		}
		return merged;
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
					style: runStyleFromSegment(seg),
					equationXml: seg.equationXml,
					equationNumber: seg.equationNumber,
				});
				continue;
			}
			const rawText = seg.isLineBreak ? '\n' : seg.text;
			// Resolve OOXML field runs (slide number, date/time, header/footer,
			// slide title, docproperty) to their display text, mirroring React's
			// per-run `substituteFieldText` in `text-segment-render`.
			const text = seg.fieldType
				? substituteFieldText(rawText, seg.fieldType, this.fieldContext())
				: rawText;
			if (text) {
				const href = resolveHyperlinkHref(seg.style?.hyperlink);
				current.runs.push({
					text,
					style: runStyleFromSegment(seg),
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
}
