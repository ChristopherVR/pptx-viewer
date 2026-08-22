import { NgStyle, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxTableData, ShapeStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	buildTextBody3DSceneStyle,
	buildTextBuildSpec,
	getGroupChildParentFill,
	getOverflowSegments,
	isElementHidden,
	textBuildSpanStyle,
	inlineElementPointerEvents,
	buildHollowHitOutline,
	strokeOutlineViewBox,
} from '../internal/shared';
import type {
	ElementAnimationState,
	FieldSubstitutionContext,
	FillOverlayCss,
	TextBuildSpec,
} from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { ChartElementViewComponent } from './chart-element-view.component';
import { ConnectorRendererComponent } from './connector-renderer.component';
import type { Rect } from './connector-routing';
import { ContentPartRendererComponent } from './content-part-renderer.component';
import {
	getEffectFillOverlay,
	getStrokeOutline,
	getSoftEdgeFilterDef,
	getSubpathFillOverlay,
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
import { ImageRendererComponent } from './image-renderer.component';
import { InkRendererComponent } from './ink-renderer.component';
import { MediaRendererComponent } from './media-renderer.component';
import { Model3DRendererComponent } from './model3d-renderer.component';
import { OleRendererComponent } from './ole-renderer.component';
import { buildAngularParagraphs } from './paragraph-view';
import type { Paragraph } from './paragraph-view';
import { SmartArt3DRendererComponent } from './smart-art-3d-renderer.component';
import { SmartArt3DService } from './smart-art-3d.service';
import { SmartArtRendererComponent } from './smart-art-renderer.component';
import { TableRendererComponent } from './table-renderer.component';
import type { TableCellCommit } from './table-renderer.component';
import { showsTemplateAffordance } from './template-mode';
import { getTextWarp } from './text-warp';
import type { TextWarpPathDef } from './text-warp';
import { ZoomRendererComponent } from './zoom-renderer.component';

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
		NgTemplateOutlet,
		ConnectorRendererComponent,
		TableRendererComponent,
		ChartElementViewComponent,
		SmartArtRendererComponent,
		SmartArt3DRendererComponent,
		InkRendererComponent,
		ContentPartRendererComponent,
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

	/**
	 * When true (default), the rendered node carries `data-element-id`.
	 *
	 * Turned OFF by the miniature surfaces that paint EVERY slide at once
	 * (thumbnail rail, mobile slide sheet, slide sorter, presenter navigator,
	 * layout gallery, diff strip). Those put one node per element per slide into
	 * the document, so the id of an element on slide 1 was addressable while
	 * slide 3 was on screen, and every framework-neutral `[data-element-id]`
	 * query resolved the wrong slide. React solved the same hazard by giving
	 * thumbnails a separate `StaticElementRenderer` that stamps no id at all
	 * ("exposing their ids there would put two nodes with the same id in the
	 * document"); this input is Angular's equivalent, since it reuses the live
	 * renderer for its miniatures.
	 *
	 * Distinct from {@link interactive}: the presentation stage is not
	 * interactive but MUST keep its ids, because the morph engine's generated
	 * keyframe CSS selects on them.
	 */
	readonly exposeElementId = input<boolean>(true);

	/** `data-element-id` for this element, or null on a miniature surface. */
	readonly elementIdAttr = computed<string | null>(() =>
		this.exposeElementId() ? this.element().id : null,
	);

	/** Whether this element's root carries `data-pptx-element="true"`. */
	readonly elementMarked = computed(() => this.interactive() || this.marked());

	/**
	 * `pointer-events: none` while this render is not interactive, mirroring
	 * React's `pointer-events-none` Tailwind class on the same condition. This is
	 * the piece `editTemplateMode` actually depends on: {@link marked} keeps the
	 * `data-pptx-element` contract attribute on a locked template (master/layout)
	 * element so it stays findable as a rendered slide element, but the attribute
	 * alone never stopped clicks/drags from reaching it. Without this, a
	 * layout/master shape stayed fully clickable with `editTemplateMode` off:
	 * nothing on its DOM node reflected the lock, only the stage's pointerdown
	 * handler's id-based gate did, which kept selection/drag from acting on it
	 * but left the element itself indistinguishable from an interactive one to
	 * anything reading its computed style (e.g. `e2e/template-editing.spec.ts`).
	 */
	readonly rootPointerEvents = computed<'none' | null>(
		() =>
			inlineElementPointerEvents({
				interactive: this.interactive(),
				presenting: this.presenting(),
			}) ?? null,
	);

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

	/**
	 * Transparent outline hit band for an unfilled, textless shape. Its container
	 * is `pointer-events: none` so clicks fall through to whatever it is drawn
	 * over; this opts the OUTLINE back in (same trick as the connector target).
	 */
	readonly hollowHit = computed(() => buildHollowHitOutline(this.element()));

	readonly fillOverlay = computed<FillOverlayCss | undefined>(() =>
		getEffectFillOverlay(this.element()),
	);

	/**
	 * Per-sub-path fill overlay for a multi-sub-path preset or custom geometry,
	 * or `undefined` when a single merged fill is correct (the ordinary case).
	 */
	readonly subpathFill = computed(() => getSubpathFillOverlay(this.element()));

	/** `viewBox` for the sub-path fill overlay, in its own coordinate space. */
	readonly subpathFillViewBox = computed(() => {
		const overlay = this.subpathFill();
		return overlay ? `0 0 ${overlay.viewBoxWidth} ${overlay.viewBoxHeight}` : undefined;
	});

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
		const container = getContainerStyle(this.element(), this.zIndex());
		const shape = getShapeFillStrokeStyle(
			this.element(),
			this.parentGroupFill(),
			state?.animatesFill,
			state?.animatesStroke,
		);
		const merged: StyleMap = {
			...container,
			...shape,
			...this.templateAffordanceStyle(),
		};
		// The shape style may carry a 3D `transform` (`a:spPr/a:scene3d` camera);
		// COMPOSE it with the container's rotation / flip transform rather than
		// letting the spread clobber it, exactly as the Vue binding does.
		if (container['transform'] && shape['transform']) {
			merged['transform'] = `${String(container['transform'])} ${String(shape['transform'])}`;
		}
		return merged;
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
		// A text block can carry its own transform (vertical writing modes), so
		// the scene transform is composed onto it rather than replacing it.
		if (base['transform'] && scene?.transform) {
			merged['transform'] = `${String(base['transform'])} ${String(scene.transform)}`;
		}
		const w = this.textWarp();
		if (w?.strategy === 'css') {
			const composed = merged['transform'];
			merged['transform'] = composed ? `${w.cssTransform} ${String(composed)}` : w.cssTransform;
			merged['transform-origin'] = w.cssTransformOrigin;
		}
		return merged;
	});

	readonly children = computed<PptxElement[]>(() => {
		const el = this.element();
		return el.type === 'group' ? (el.children ?? []) : [];
	});

	/**
	 * The fill handed to this group's `a:grpFill` children as their
	 * `parentGroupFill`; undefined for non-group elements.
	 *
	 * The shared helper, not a hand-inlined copy: the inlined one returned this
	 * group's own fill only, and `a:grpFill` resolves against the nearest
	 * ANCESTOR that has a fill, so a shape inside a fill-less nested group came
	 * out transparent. (The old copy justified itself with "shared is only
	 * vendored at build time", but this component already imports a dozen shared
	 * symbols from the vendored barrel.)
	 */
	readonly childParentGroupFill = computed<ShapeStyle | undefined>(() =>
		getGroupChildParentFill(this.element(), this.parentGroupFill()),
	);

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
		return buildAngularParagraphs(el, this.fieldContext(), segments);
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
