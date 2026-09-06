import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxTableData, ShapeStyle } from 'pptx-viewer-core';

import {
	buildTextStyleOverrideCss,
	getGroupChildParentFill,
	isElementHidden,
	inlineElementPointerEvents,
} from '../internal/shared';
import type { ElementAnimationState, FieldSubstitutionContext } from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { ConnectorRendererComponent } from './connector-renderer.component';
import type { Rect } from './connector-routing';
import { getReflectionOverlay, getSoftEdgeFilterDef } from './element-effect-defs';
import type { ReflectionOverlay, SoftEdgeFilterDef } from './element-effect-defs';
import { ElementRendererGraphicsComponent } from './element-renderer-graphics.component';
import { buildElementContainerStyle, buildShapeContainerStyle } from './element-renderer-helpers';
import { ElementRendererShapeComponent } from './element-renderer-shape.component';
import { getDuotoneFilterDef } from './element-style';
import type { StyleMap } from './element-style';
import { ImageRendererComponent } from './image-renderer.component';
import { ReflectionMirrorContentComponent } from './reflection-mirror-content.component';
import { SmartArt3DService } from './smart-art-3d.service';
import type { TableCellCommit } from './table-renderer.component';

export { shouldPreventHyperlinkNavigation } from './hyperlink-confirm';

/** Element kinds dispatched to `ElementRendererGraphicsComponent`. */
const GRAPHICS_ELEMENT_TYPES = new Set<PptxElement['type']>([
	'ink',
	'contentPart',
	'zoom',
	'model3d',
	'smartArt',
	'ole',
	'chart',
	'table',
	'media',
]);

/**
 * ElementRendererComponent: Angular port of the React `ElementRenderer.tsx`
 * and the Vue `ElementRenderer.vue`. Dispatches by `element().type`:
 * `connector`/`group` (self-recursive) stay here; `picture`/`image` goes to
 * `ImageRendererComponent`; `text`/`shape` goes to
 * `ElementRendererShapeComponent`; everything else goes to
 * `ElementRendererGraphicsComponent`; an unmatched type falls back to a
 * labelled placeholder.
 */
@Component({
	selector: 'pptx-element-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		NgStyle,
		ConnectorRendererComponent,
		ElementRendererGraphicsComponent,
		ElementRendererShapeComponent,
		ImageRendererComponent,
		ReflectionMirrorContentComponent,
	],
	templateUrl: './element-renderer.component.html',
})
export class ElementRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zIndex = input<number>(0);

	/**
	 * Host opt-in to the Three.js SmartArt renderer. Optional so renderers used
	 * outside the viewer subtree (thumbnails, export) default to the SVG one.
	 */
	private readonly smartArt3DService = inject(SmartArt3DService, { optional: true });
	/**
	 * Native-animation playback, present only inside a running presentation.
	 * Optional so the editor/thumbnails/export render with no animation state.
	 */
	private readonly playback = inject(AnimationPlaybackService, { optional: true });
	private readonly translate = inject(TranslateService);
	readonly smartArt3D = computed(() => this.smartArt3DService?.enabled() ?? false);
	/** Whether the Selection Pane has hidden this element; see the empty first `@case`. */
	readonly isHidden = computed(() => isElementHidden(this.element()));
	/** Obstacle rects (slide coords) for connector A* routing. */
	readonly obstacles = input<readonly Rect[]>([]);
	readonly canvasWidth = input<number>(0);
	readonly canvasHeight = input<number>(0);
	/**
	 * When true (default), the element host carries the framework-neutral
	 * `data-pptx-element="true"` contract attribute (used by selection + the
	 * shared e2e specs). Thumbnail/preview/presentation canvases pass `false`
	 * so they don't pollute the contract selectors, mirroring React.
	 */
	readonly interactive = input<boolean>(true);

	/**
	 * Emit the `data-pptx-element` marker even though `interactive` is false:
	 * the marker means "carries the element contract", not "editable right
	 * now", so an interaction-locked template (master/layout) element still
	 * sets it, matching the other bindings.
	 */
	readonly marked = input<boolean>(false);

	/**
	 * When true (default), the rendered node carries `data-element-id`.
	 *
	 * Turned OFF by the miniature surfaces that paint EVERY slide at once
	 * (thumbnail rail, slide sorter, presenter navigator, ...): those put one
	 * node per element per slide into the document, so without this an id
	 * would resolve to the wrong slide's copy. React's equivalent hazard is
	 * why `StaticElementRenderer` stamps no id at all for its miniatures.
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
	 * React's `pointer-events-none` class on the same condition. This is the
	 * piece `editTemplateMode` actually depends on: {@link marked} keeps a
	 * locked template element findable via `data-pptx-element`, but only this
	 * stops clicks/drags from reaching it (without it a layout/master shape
	 * stayed fully clickable with `editTemplateMode` off, indistinguishable
	 * from an interactive one to anything reading its computed style, e.g.
	 * `e2e/template-editing.spec.ts`).
	 */
	readonly rootPointerEvents = computed<'none' | null>(
		() =>
			inlineElementPointerEvents({
				interactive: this.interactive(),
				presenting: this.presenting(),
			}) ?? null,
	);

	/**
	 * True only on the live presentation stage, so a slide's media autoplays
	 * when it becomes active (and nested group children autoplay too).
	 */
	readonly presenting = input<boolean>(false);

	/** Whether inline editing (table-cell text input, etc.) is enabled. */
	readonly editable = input<boolean>(false);

	/**
	 * OOXML field-substitution context (slide number, date/time, header/footer,
	 * slide title, custom doc properties), threaded down (incl. to recursive
	 * group children) so field runs resolve to display text.
	 */
	readonly fieldContext = input<FieldSubstitutionContext | undefined>(undefined);

	/**
	 * The elements of the slide being painted, threaded down (including to
	 * recursive group children) alongside {@link fieldContext}. Needed only by
	 * `a:linkedTxbx` chains: a text box in a linked chain renders the slice of
	 * the chain's text the preceding boxes could not hold, computable only
	 * from its SIBLINGS. Mirrors React's `slideElements`. Left empty outside
	 * any slide, in which case a linked box falls back to its own segments.
	 */
	readonly slideElements = input<readonly PptxElement[]>([]);

	/**
	 * When true, inherited master/layout elements get a visual affordance
	 * (amber outline + reduced opacity) signalling they are now editable. No
	 * effect on normal slide elements or when false.
	 */
	readonly editTemplateMode = input<boolean>(false);

	/**
	 * The enclosing group's fill (`GroupPptxElement.groupFill`), so a child
	 * painted with `a:grpFill` inherits the group's resolved fill.
	 */
	readonly parentGroupFill = input<ShapeStyle | undefined>(undefined);

	/**
	 * The element currently open in the element-level inline text editor
	 * (the `<textarea data-inline-editor>` overlay in `slide-canvas.component`),
	 * or `null`. Mirrors React's `ElementBody.renderBody`, which swaps its
	 * static text render out for the inline editor rather than layering the
	 * two: without this the element's normal text painted UNDERNEATH the
	 * editor overlay, showing through as a duplicate "text shadow" (issue #182).
	 */
	readonly editingElementId = input<string | null>(null);

	/** Emitted when a table cell's text edit is committed. */
	readonly cellCommit = output<{ id: string; commit: TableCellCommit }>();
	/** Emitted when a structural table change (drag-resize) should be persisted. */
	readonly tableChange = output<{ id: string; tableData: PptxTableData }>();

	/** Duotone SVG `<filter>` descriptor, if any. */
	readonly duotoneFilter = computed(() => getDuotoneFilterDef(this.element()));

	/**
	 * Soft-edge feather `<filter>` descriptor (id + radius). The template
	 * injects a matching `<filter>` def so `filter: url(#soft-edge-<id>)`
	 * resolves. Undefined otherwise.
	 */
	readonly softEdgeFilter = computed<SoftEdgeFilterDef | undefined>(() =>
		getSoftEdgeFilterDef(this.element()),
	);

	/**
	 * `a:reflection` mirrored-sibling descriptor, or `undefined`. Used by the
	 * `group` branch below (a group reflects its whole composited subtree);
	 * `ElementRendererShapeComponent` recomputes its own copy locally instead,
	 * mirroring how `ImageRendererComponent` already does the same.
	 */
	readonly reflection = computed<ReflectionOverlay | undefined>(() =>
		getReflectionOverlay(this.element()),
	);

	/**
	 * This element's native-animation playback state, or `undefined` outside a
	 * running presentation. Drives the staged chart/SmartArt build reveal and
	 * the `p:animClr` fill/stroke relinquish.
	 */
	readonly animationState = computed<ElementAnimationState | undefined>(() =>
		this.playback?.presentationElementStates().get(this.element().id),
	);

	/**
	 * A font-style emphasis effect (Bold Flash, Bold Reveal, Underline, Change
	 * Font Style/Size) overrides the runs' own inline bold/italic/underline/
	 * size, which plain CSS inheritance cannot reach. See
	 * `animation-text-style-css.ts`. NOT gated on `hasTextProperties`: a table
	 * cell, a chart title/label/legend, and a SmartArt node caption all
	 * animate this way too, and shared's selector scopes itself to this
	 * element's `data-element-id`, which every branch below carries.
	 */
	readonly textStyleOverrideCss = computed<string | undefined>(() =>
		buildTextStyleOverrideCss(this.element().id, this.animationState()?.textStyle),
	);

	/** Live per-sub-element animation states for the staged text-build split. */
	readonly subElementAnimStates = computed(() => this.playback?.presentationElementStates());

	readonly containerStyle = computed<StyleMap>(() =>
		buildElementContainerStyle(this.element(), this.zIndex(), this.editTemplateMode()),
	);
	/** Fill/stroke/effects container style; see `buildShapeContainerStyle`'s doc. */
	readonly shapeContainerStyle = computed<StyleMap>(() => {
		const state = this.animationState();
		return buildShapeContainerStyle(
			this.element(),
			this.zIndex(),
			this.parentGroupFill(),
			state?.animatesFill,
			state?.animatesStroke,
			this.editTemplateMode(),
		);
	});
	readonly children = computed<PptxElement[]>(() => {
		const el = this.element();
		return el.type === 'group' ? (el.children ?? []) : [];
	});

	/**
	 * The fill handed to this group's `a:grpFill` children as their
	 * `parentGroupFill`; undefined for non-group elements. Uses the shared
	 * helper, not a hand-inlined copy: `a:grpFill` resolves against the
	 * nearest ANCESTOR that has a fill, so a naive "this group's own fill
	 * only" version left a shape inside a fill-less nested group transparent.
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

	/** Element kinds routed to `ElementRendererGraphicsComponent`; see `GRAPHICS_ELEMENT_TYPES`. */
	readonly isGraphicsElement = computed(() => GRAPHICS_ELEMENT_TYPES.has(this.element().type));

	readonly placeholderLabel = computed(() => {
		const map: Record<string, string> = {
			group: 'pptx.elementType.group',
			media: 'pptx.elementType.media',
		};
		const key = map[this.element().type];
		return key ? this.translate.instant(key) : this.element().type;
	});
}
