import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxTableData, ShapeStyle, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	buildRunEffectStyle,
	buildTextBody3DSceneStyle,
	buildTextBuildSpec,
	isElementHidden,
	textBuildSpanStyle,
	resolveAutoFitFontScale,
	resolveParagraphIndent,
	resolveUnderlineDecorationStyle,
	segmentStyleToCss,
	substituteFieldText,
} from '../internal/shared';
import type {
	ElementAnimationState,
	FieldSubstitutionContext,
	FillOverlayCss,
	PictureBulletMarker,
	TextBuildSpec,
} from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { ChartElementViewComponent } from './chart-element-view.component';
import { ConnectorRendererComponent } from './connector-renderer.component';
import type { Rect } from './connector-routing';
import { getEffectFillOverlay, getSoftEdgeFilterDef } from './element-effect-defs';
import type { SoftEdgeFilterDef } from './element-effect-defs';
import {
	getContainerStyle,
	getDuotoneFilterDef,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from './element-style';
import type { StyleMap } from './element-style';
import { EquationRendererComponent } from './equation-renderer.component';
import { resolveHyperlinkHref } from './hyperlink';
import { ImageRendererComponent } from './image-renderer.component';
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
import { resolveAngularParagraphBullet } from './text-bullets';
import { resolveParagraphSpacing } from './text-paragraph-spacing';
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
 *
 * `fontScale` is the body's `a:normAutofit/@fontScale`: a run authoring its own
 * `sz` overrides the (already scaled) body font-size, so without it a
 * shrink-to-fit title painted at full size.
 */
function runStyleFromSegment(seg: TextSegment, fontScale = 1): StyleMap {
	const style = segmentStyleToCss(seg, fontScale);
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
	/** Resolved picture marker, or metadata for its accessible glyph fallback. */
	bulletPicture?: PictureBulletMarker;
	/** `[ngStyle]` map for the bullet marker (colour / font). */
	bulletStyle: StyleMap;
	/** Left indent in px derived from the paragraph outline level. */
	indentPx: number;
	/** `text-indent` in px (first-line / hanging indent), when authored. */
	textIndentPx?: number;
	/**
	 * True when the paragraph has no runs and no bullet: an authored blank line
	 * (`<a:p><a:endParaRPr/></a:p>`), which PowerPoint gives a full line box.
	 * The template renders a `<br>` for it so the gap survives (issue #131).
	 */
	isEmpty?: boolean;
	/**
	 * Per-paragraph `line-height` from this paragraph's own `a:lnSpc`: a unitless
	 * multiplier (`a:spcPct`) or a `"<n>pt"` string (`a:spcPts`). Undefined when
	 * the paragraph does not override the body-level line-height.
	 */
	lineHeight?: number | string;
	/** `margin-top` in px from `a:spcBef` (space before), when overridden. */
	spaceBeforePx?: number;
	/** `margin-bottom` in px from `a:spcAft` (space after), when overridden. */
	spaceAfterPx?: number;
	/**
	 * `font-size` in px set on the paragraph so its CSS line boxes are built
	 * from its own runs rather than the text body default. Mirrors the shared
	 * `RenderParagraph.strutFontSizePx`; see `resolveParagraphStrutFontSize`.
	 */
	strutFontSizePx?: number;
}

/**
 * ElementRendererComponent: Angular port of the React `ElementRenderer.tsx`
 * and the Vue `ElementRenderer.vue`.
 *
 * Renders a single slide element by its `type` discriminant:
 *  - `text` / `shape`    → positioned box with fill/stroke + rich text + effects
 *  - `connector`         → SVG straight/bent/curved connector
 *  - `chart`             → inline-SVG chart (bar/line/area/pie/scatter)
 *  - `table`             → HTML `<table>`
 *  - `smartArt`          → SVG drawing-shapes / node-text fallback
 *  - `ink`               → SVG ink strokes
 *  - `ole`               → embedded-object preview / icon
 *  - `model3d`           → interactive three.js scene when the optional
 *                          `three` peer is present, else poster / placeholder
 *  - `zoom`              → slide/section zoom thumbnail
 *  - `picture` / `image` → `<img>`
 *  - `media`             → native `<video>`/`<audio>` playback, poster fallback
 *  - `group`             → recursive children (self-referencing selector)
 *  - everything else     → labelled placeholder (defensive fallback)
 */
@Component({
	selector: 'pptx-element-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		NgStyle,
		ConnectorRendererComponent,
		TableRendererComponent,
		ChartElementViewComponent,
		SmartArtRendererComponent,
		SmartArt3DRendererComponent,
		InkRendererComponent,
		MediaRendererComponent,
		OleRendererComponent,
		Model3DRendererComponent,
		ZoomRendererComponent,
		EquationRendererComponent,
		ImageRendererComponent,
	],
	template: `
		@switch (true) {
			@case (isHidden()) {
				<!--
					Hidden via the Selection Pane: draw nothing, exactly as PowerPoint
					does. This is the FIRST case on purpose - @switch takes the first
					match, so one empty branch suppresses every element type at once
					without wrapping (and re-indenting) the whole template. The host
					carries \`display: contents\`, so an empty component collapses.
					Rendering nothing (rather than an invisible box) is what keeps the
					element out of hit-testing, the tab order and the export raster; it
					stays listed in and selectable from the Selection Pane, which reads
					the slide model rather than the DOM.
				-->
			}
			@case (element().type === 'connector') {
				<pptx-connector-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[obstacles]="obstacles()"
					[canvasWidth]="canvasWidth()"
					[canvasHeight]="canvasHeight()"
					[interactive]="interactive()"
					[animationState]="animationState()"
				/>
			}
			@case (element().type === 'ink') {
				<!--
					This renderer (and zoom / model3d / 3D SmartArt below) positions its
					own root box, so it takes the neutral element marker
					(data-pptx-element) as an input instead of being wrapped in a marked
					box the way chart / table / OLE are: an outer positioned box would
					offset it twice.
				-->
				<pptx-ink-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[mediaDataUrls]="mediaDataUrls()"
					[replay]="presenting()"
					[markElement]="interactive()"
				/>
			}
			@case (element().type === 'zoom') {
				<pptx-zoom-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[mediaDataUrls]="mediaDataUrls()"
					[markElement]="interactive()"
				/>
			}
			@case (element().type === 'model3d') {
				<pptx-model3d-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[mediaDataUrls]="mediaDataUrls()"
					[markElement]="interactive()"
				/>
			}
			@case (element().type === 'smartArt' && smartArt3D()) {
				<pptx-smart-art-3d-renderer
					[element]="element()"
					[zIndex]="zIndex()"
					[canEdit]="interactive() && editable()"
					[markElement]="interactive()"
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
						[editable]="interactive() && editable()"
						[animationState]="animationState()"
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
					<pptx-ole-renderer [element]="element()" />
				</div>
			}
			@case (element().type === 'chart') {
				<div
					class="pptx-ng-element pptx-ng-chart"
					[ngStyle]="containerStyle()"
					[attr.data-element-id]="element().id"
					[attr.data-pptx-element]="interactive() ? 'true' : null"
				>
					<pptx-chart-element-view
						[element]="element()"
						[editable]="interactive() && editable()"
						[animationState]="animationState()"
					/>
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
							[presenting]="presenting()"
							[fieldContext]="fieldContext()"
							[parentGroupFill]="childParentGroupFill()"
						/>
					}
				</div>
			}
			@case (isImageLike()) {
				<pptx-image-renderer
					[element]="element()"
					[mediaDataUrls]="mediaDataUrls()"
					[zIndex]="zIndex()"
					[interactive]="interactive()"
				/>
			}
			@case (element().type === 'media') {
				<pptx-media-renderer
					[element]="element()"
					[mediaDataUrls]="mediaDataUrls()"
					[zIndex]="zIndex()"
					[interactive]="interactive()"
					[presenting]="presenting()"
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
					@if (fillOverlay(); as ov) {
						<div
							class="pptx-ng-fill-overlay"
							aria-hidden="true"
							style="position: absolute; inset: 0; pointer-events: none"
							[style.background]="ov.color"
							[style.mix-blend-mode]="ov.blendMode"
						></div>
					}
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
								<p
									class="pptx-ng-para"
									[style.padding-left.px]="para.indentPx"
									[style.text-indent.px]="para.textIndentPx ?? null"
									[style.line-height]="para.lineHeight ?? null"
									[style.margin-top.px]="para.spaceBeforePx ?? null"
									[style.margin-bottom.px]="para.spaceAfterPx ?? null"
									[style.font-size.px]="para.strutFontSizePx ?? null"
								>
									@if (para.bulletPicture?.src) {
										<img
											class="pptx-ng-bullet-image"
											[src]="para.bulletPicture.src"
											[alt]="para.bulletPicture.accessibleLabel"
											[style.width.px]="para.bulletPicture.sizePx"
											[style.height.px]="para.bulletPicture.sizePx"
											style="display: inline-block; vertical-align: middle; margin-inline-end: 4px; object-fit: contain"
										/>
									} @else if (para.bulletMarker) {
										<span class="pptx-ng-bullet" [ngStyle]="para.bulletStyle"
											[attr.aria-label]="para.bulletPicture?.accessibleLabel ?? null"
											>{{ para.bulletMarker }}</span
										>
									}
									@if (textBuildSpecs()[$index]; as spec) {
										<!-- Staged text build: render the split pieces so each one
										     carries its own sub-animation. -->
										@if (spec.granularity === 'paragraph') {
											<span
												[attr.data-anim-id]="spec.animId"
												[ngStyle]="buildSpanStyle(spec)"
												>{{ paragraphText(para) }}</span
											>
										} @else {
											@for (span of spec.spans ?? []; track $index) {
												<span
													[attr.data-anim-id]="span.animId"
													[ngStyle]="buildSpanStyle(span)"
													>{{ span.text }}</span
												>
											}
										}
									} @else {
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
									}
									@if (para.isEmpty) {
										<!-- An authored blank line has no runs, so without this the
										     <p> collapses to zero height and the gap a deck puts
										     between a heading and its bullet list disappears. -->
										<br />
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

		<!-- Soft-edge feather <filter> def, referenced via filter: url(#soft-edge-<id>). -->
		@if (softEdgeFilter(); as sef) {
			<svg
				width="0"
				height="0"
				aria-hidden="true"
				style="position: absolute; width: 0; height: 0; overflow: hidden"
			>
				<defs>
					<filter
						[attr.id]="sef.id"
						x="-20%"
						y="-20%"
						width="140%"
						height="140%"
						color-interpolation-filters="sRGB"
					>
						<feGaussianBlur
							in="SourceAlpha"
							[attr.stdDeviation]="sef.radius"
							result="softEdgeAlpha"
						/>
						<feComposite in="SourceGraphic" in2="softEdgeAlpha" operator="in" />
					</filter>
				</defs>
			</svg>
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
	/**
	 * Native-animation playback (present only inside a running presentation, which
	 * provides {@link AnimationPlaybackService} at the overlay level). Optional so
	 * the same renderer in the editor / thumbnails / export resolves to `null` and
	 * renders with no animation state. Mirrors the Vue `injectPresentationElementStates`
	 * provide/inject and React's threaded `presentationElementStates` prop.
	 */
	private readonly playback = inject(AnimationPlaybackService, { optional: true });
	private readonly translate = inject(TranslateService);
	readonly smartArt3D = computed(() => this.smartArt3DService?.enabled() ?? false);
	/**
	 * Whether the Selection Pane has hidden this element. Drives the empty first
	 * `@case` in the template; see the comment there for why nothing is rendered
	 * rather than rendered-and-hidden.
	 */
	readonly isHidden = computed(() => isElementHidden(this.element()));
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

	/**
	 * True only on the live presentation stage; threaded to the media renderer so
	 * a slide's media autoplays when the slide becomes active (and to group
	 * children so nested media autoplays too). False everywhere else.
	 */
	readonly presenting = input<boolean>(false);

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

	/**
	 * The enclosing group's fill (`GroupPptxElement.groupFill`), passed down by
	 * the group render branch so a child painted with `a:grpFill`
	 * (`fillMode === 'group'`) inherits the group's resolved fill.
	 */
	readonly parentGroupFill = input<ShapeStyle | undefined>(undefined);

	/** Emitted when a table cell's text edit is committed. */
	readonly cellCommit = output<{ id: string; commit: TableCellCommit }>();

	/** Emitted when a structural table change (drag-resize) should be persisted. */
	readonly tableChange = output<{ id: string; tableData: PptxTableData }>();

	/** Duotone SVG `<filter>` descriptor for this element, if any. */
	readonly duotoneFilter = computed(() => getDuotoneFilterDef(this.element()));

	/**
	 * Soft-edge feather `<filter>` descriptor (id + radius). The template injects
	 * a matching `<filter>` into a hidden `<defs>` so the `filter:
	 * url(#soft-edge-<id>)` reference on the shape resolves. Undefined otherwise.
	 */
	readonly softEdgeFilter = computed<SoftEdgeFilterDef | undefined>(() =>
		getSoftEdgeFilterDef(this.element()),
	);

	/**
	 * DAG fill-overlay tint (colour + blend mode) painted as a separate blended
	 * layer over the shape. Undefined when the element has no fill overlay.
	 */
	readonly fillOverlay = computed<FillOverlayCss | undefined>(() =>
		getEffectFillOverlay(this.element()),
	);

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

	/**
	 * This element's native-animation playback state, or `undefined` outside a
	 * running presentation. Drives the staged chart / SmartArt build reveal and the
	 * `p:animClr` fill / stroke relinquish (threaded to the chart / SmartArt /
	 * connector renderers), mirroring React's per-element `animationState`.
	 */
	readonly animationState = computed<ElementAnimationState | undefined>(() =>
		this.playback?.presentationElementStates().get(this.element().id),
	);

	/**
	 * Per-paragraph split for a staged text build (by paragraph / word / letter),
	 * or `undefined` entries to render the runs normally. PowerPoint's "Animate
	 * text: By letter" needs the rendered text split to match the per-character
	 * sub-animations, otherwise the whole box just fades as one.
	 */
	readonly textBuildSpecs = computed<Array<TextBuildSpec<StyleMap> | undefined>>(() => {
		const states = this.playback?.presentationElementStates();
		if (!states || states.size === 0) {
			return [];
		}
		const id = this.element().id;
		return this.paragraphs().map((para, paraIndex) =>
			buildTextBuildSpec<StyleMap>(
				id,
				paraIndex,
				para.runs
					.filter((run) => run.text !== '\n')
					.map((run) => ({ text: run.text, style: run.style as StyleMap })),
				states,
			),
		);
	});

	/** Whole-paragraph text, for the paragraph-level build wrapper. */
	protected paragraphText(para: Paragraph): string {
		return para.runs.map((run) => run.text).join('');
	}

	/** Style for one build piece, merged over the run's own style. */
	protected buildSpanStyle(span: { style?: StyleMap; hidden?: boolean; cssAnimation?: string }) {
		return { ...(span.style ?? {}), ...textBuildSpanStyle(span) };
	}

	readonly containerStyle = computed<StyleMap>(() => ({
		...getContainerStyle(this.element(), this.zIndex()),
		...this.templateAffordanceStyle(),
	}));
	readonly shapeContainerStyle = computed<StyleMap>(() => {
		const state = this.animationState();
		return {
			...getContainerStyle(this.element(), this.zIndex()),
			...getShapeFillStrokeStyle(
				this.element(),
				this.parentGroupFill(),
				state?.animatesFill,
				state?.animatesStroke,
			),
			...this.templateAffordanceStyle(),
		};
	});
	readonly textStyle = computed<StyleMap>(() => getTextBlockStyle(this.element()));
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

	/**
	 * This group's own fill, handed to `a:grpFill` children as their
	 * `parentGroupFill`. Undefined for non-group elements. Mirrors the shared
	 * `getGroupChildParentFill` helper (inlined here so the Angular binding does
	 * not depend on a shared symbol that is only vendored at build time).
	 */
	readonly childParentGroupFill = computed<ShapeStyle | undefined>(() => {
		const el = this.element();
		return el.type === 'group' ? el.groupFill : undefined;
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
		// `a:normAutofit/@fontScale`: applied to every authored run size, since a
		// run's own `sz` overrides the (already scaled) body font-size. Mirrors
		// shared `buildParagraphs` and React's `renderSingleSegment`.
		const fontScale = resolveAutoFitFontScale(el.textStyle);
		const paragraphIndents = el.paragraphIndents;
		const out: Paragraph[] = [{ runs: [], bulletStyle: {}, indentPx: 0 }];
		let paraStarted = false;
		for (const seg of segments) {
			// A bare `"\n"` segment is the slide-LOAD path's paragraph separator;
			// `isParagraphBreak` is only set by the edit remap. Matching on the
			// former alone meant a freshly loaded deck arrived here as a single
			// paragraph, so only its first line got a bullet and every authored
			// blank line vanished (issue #131). Mirrors shared `buildParagraphs`.
			if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
				// An EMPTY paragraph (`paraStarted` still false) has no run to carry
				// its authored size or spacing: both ride this TERMINATING separator,
				// where core stamps the paragraph's `a:endParaRPr sz`. Read them off
				// it, or the blank line lays out on the body default and the error
				// accumulates down the panel (issue #131: Angular alone drifted
				// ~7px by the last heading of slide 13). Mirrors shared
				// `buildParagraphs`.
				if (!paraStarted) {
					const closing = out[out.length - 1];
					const endParaSize = seg.style?.fontSize;
					if (typeof endParaSize === 'number' && endParaSize > 0) {
						closing.strutFontSizePx = endParaSize;
					}
					const endSpacing = resolveParagraphSpacing(seg.paragraphProperties);
					if (endSpacing.lineHeight !== undefined) {
						closing.lineHeight = endSpacing.lineHeight;
					}
					if (endSpacing.spaceBeforePx !== undefined) {
						closing.spaceBeforePx = endSpacing.spaceBeforePx;
					}
					if (endSpacing.spaceAfterPx !== undefined) {
						closing.spaceAfterPx = endSpacing.spaceAfterPx;
					}
				}
				out.push({ runs: [], bulletStyle: {}, indentPx: 0 });
				paraStarted = false;
				continue;
			}
			const current = out[out.length - 1];
			// The first segment of each paragraph carries its bullet + outline level.
			if (!paraStarted) {
				paraStarted = true;
				const indent = resolveParagraphIndent(
					paragraphIndents?.[out.length - 1],
					seg.paragraphLevel,
				);
				current.indentPx = indent.marginLeftPx ?? 0;
				current.textIndentPx = indent.textIndentPx;
				// Per-paragraph line-height / space-before / space-after from this
				// paragraph's own `a:pPr` (#69), mirroring shared `buildParagraphs`.
				const spacing = resolveParagraphSpacing(seg.paragraphProperties);
				if (spacing.lineHeight !== undefined) {
					current.lineHeight = spacing.lineHeight;
				}
				if (spacing.spaceBeforePx !== undefined) {
					current.spaceBeforePx = spacing.spaceBeforePx;
				}
				if (spacing.spaceAfterPx !== undefined) {
					current.spaceAfterPx = spacing.spaceAfterPx;
				}
				const baseFontSize = seg.style?.fontSize ?? el.textStyle?.fontSize ?? 16;
				const bullet = resolveAngularParagraphBullet(seg, baseFontSize, fontScale);
				if (bullet) {
					current.bulletMarker = bullet.marker;
					current.bulletPicture = bullet.picture;
					Object.assign(current.bulletStyle, bullet.style);
					// PowerPoint draws the marker at `marL + indent` and starts
					// the text at `marL`, so the marker's box is exactly the
					// hanging distance wide. Reserving it lines the runs up on
					// the indent stop and removes the need for a spacer after
					// the glyph. Mirrors shared `buildParagraphs`.
					current.bulletStyle['display'] = 'inline-block';
					// `text-indent` inherits, and an inline-block is a block
					// container: without this reset the marker box applies the
					// paragraph's negative first-line indent AGAIN internally and
					// paints the glyph a full hang-width left of its own box
					// (measured 27px outside the text inset). Mirrors shared
					// `buildParagraphs`.
					current.bulletStyle['text-indent'] = '0px';
					if (indent.textIndentPx !== undefined && indent.textIndentPx < 0) {
						current.bulletStyle['min-width'] = `${-indent.textIndentPx}px`;
					} else {
						current.bulletStyle['margin-inline-end'] = '0.35em';
					}
					// The slide-load path inserts a DEDICATED marker segment whose
					// text is the precomputed glyph; the marker is rendered from
					// `bulletMarker` above, so keeping the segment as a run painted
					// the bullet twice. A run that merely carries `bulletInfo` but
					// holds real content (the edit-remap path) is kept. Mirrors
					// shared `buildParagraphs`.
					if (seg.bulletInfo && bullet.marker && seg.text.trim() === bullet.marker.trim()) {
						continue;
					}
				}
			}
			if (seg.equationXml) {
				current.runs.push({
					text: '',
					style: runStyleFromSegment(seg, fontScale),
					equationXml: seg.equationXml,
					equationNumber: seg.equationNumber,
				});
				continue;
			}
			// Track the tallest non-bullet run so the paragraph's line box is
			// built from its own text rather than the body default (a paragraph
			// of small runs inside a larger-defaulting body otherwise lays out
			// on too-tall lines and overflows the shape).
			if (!seg.bulletInfo && typeof seg.style?.fontSize === 'number' && seg.style.fontSize > 0) {
				current.strutFontSizePx = Math.max(current.strutFontSizePx ?? 0, seg.style.fontSize);
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
					style: runStyleFromSegment(seg, fontScale),
					href,
					tooltip: href ? seg.style?.hyperlinkTooltip : undefined,
				});
			}
		}
		// A paragraph that already matches the body default needs no re-basing.
		const bodyFontSize = el.textStyle?.fontSize;
		for (const p of out) {
			if (
				p.strutFontSizePx !== undefined &&
				typeof bodyFontSize === 'number' &&
				Math.abs(p.strutFontSizePx - bodyFontSize) < 0.01
			) {
				p.strutFontSizePx = undefined;
			}
		}
		// An authored blank line between two paragraphs is real vertical spacing
		// and must survive; blank paragraphs AFTER the last content are dropped,
		// since both the load and edit-remap paths leave a trailing separator
		// behind. Mirrors shared `buildParagraphs`.
		const hasContent = (p: Paragraph): boolean =>
			p.runs.length > 0 || p.bulletMarker !== undefined || p.bulletPicture !== undefined;
		let lastContent = -1;
		for (let i = 0; i < out.length; i++) {
			if (hasContent(out[i])) {
				lastContent = i;
			}
		}
		if (lastContent < 0) {
			return out.length === 1 ? out : [];
		}
		return out.slice(0, lastContent + 1).map((p) => {
			if (!hasContent(p)) {
				p.isEmpty = true;
			}
			return p;
		});
	});

	readonly hasText = computed(() =>
		this.paragraphs().some(
			(p) => p.runs.length > 0 || p.bulletMarker !== undefined || p.bulletPicture !== undefined,
		),
	);

	readonly placeholderLabel = computed(() => {
		const map: Record<string, string> = {
			group: 'pptx.elementType.group',
			media: 'pptx.elementType.media',
		};
		const key = map[this.element().type];
		return key ? this.translate.instant(key) : this.element().type;
	});
}
