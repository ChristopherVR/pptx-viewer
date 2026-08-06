import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxTableData, ShapeStyle, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	buildRunEffectStyle,
	buildTextBody3DSceneStyle,
	buildTextBuildSpec,
	getOverflowSegments,
	isElementHidden,
	textBuildSpanStyle,
	resolveAutoFitFontScale,
	resolveParagraphIndent,
	resolveUnderlineDecorationStyle,
	segmentStyleToCss,
	strokeOutlineViewBox,
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
import {
	getEffectFillOverlay,
	getStrokeOutline,
	getSoftEdgeFilterDef,
} from './element-effect-defs';
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
	templateUrl: './element-renderer.component.html',
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
	 * Emit the `data-pptx-element` marker even though `interactive` is false.
	 * The slide canvas sets this for template (master/layout) elements, which are
	 * interaction-locked outside edit-template mode but are still rendered slide
	 * elements as far as the contract is concerned (the marker means "carries the
	 * element contract", not "editable right now"), matching the other bindings.
	 */
	readonly marked = input<boolean>(false);

	/** Whether this element's root carries `data-pptx-element="true"`. */
	readonly elementMarked = computed(() => this.interactive() || this.marked());

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
	 * The elements of the slide being painted, threaded down (including to
	 * recursive group children) alongside {@link fieldContext}.
	 *
	 * Needed only by `a:linkedTxbx` chains: a text box in a linked chain renders
	 * the slice of the chain's text that the preceding boxes could not hold,
	 * which is computable only from its SIBLINGS. Mirrors React's `slideElements`
	 * (taken from its `activeSlide.elements` prop). Left empty by a host that
	 * renders an element outside any slide, in which case a linked box falls back
	 * to its own authored segments.
	 */
	readonly slideElements = input<readonly PptxElement[]>([]);

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
	/**
	 * Stroked SVG outline: a gradient / pattern `a:ln`, or a stroke-only ("open")
	 * preset such as `line` or `arc`, neither of which a CSS border can paint.
	 */
	readonly gradientOutline = computed(() => getStrokeOutline(this.element()));

	/** viewBox in the element's PAINTED box, which the path data is authored in. */
	readonly outlineViewBox = computed(() => strokeOutlineViewBox(this.element()));

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
		// `a:linkedTxbx`: when this box is part of a linked chain it paints the
		// slice of the chain's text the preceding boxes could not hold, NOT its own
		// authored segments. The shared helper returns undefined (one field check)
		// for the overwhelmingly common non-chain element, so the fallback below is
		// the normal path. Everything downstream (autofit scale, paragraph indents,
		// bullets) still reads the element itself, exactly as React does.
		const segments = getOverflowSegments(el, this.slideElements()) ?? el.textSegments;
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
