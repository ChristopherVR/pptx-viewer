<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	buildParagraphs,
	buildTextBody3DSceneStyle,
	getGroupChildParentFill,
	getOverflowSegments,
	hasTextWarp,
	inlineElementPointerEvents,
	isElementRendered,
	isEquationOnlyText,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from '../composables/element-style';
import { injectFieldContext, resolveFieldContext } from '../composables/field-context';
import { injectPresentationElementStates } from '../composables/presentation-element-states';
import { injectSlideElements, resolveSlideElements } from '../composables/slide-elements';
import { useSmartArt3D } from '../composables/smart-art-3d';
import { build3DExtrusionData } from '../composables/visual-3d';
import ActionButtonGlyphOverlay from './ActionButtonGlyphOverlay.vue';
import ChartRenderer from './ChartRenderer.vue';
import ConnectorRenderer from './ConnectorRenderer.vue';
import ContentPartRenderer from './ContentPartRenderer.vue';
import DuotoneFilterDefs from './DuotoneFilterDefs.vue';
import ElementImageBox from './ElementImageBox.vue';
import ElementMediaBox from './ElementMediaBox.vue';
import EquationRenderer from './EquationRenderer.vue';
import Extrusion3DOverlay from './Extrusion3DOverlay.vue';
import InkRenderer from './InkRenderer.vue';
import Model3DRenderer from './Model3DRenderer.vue';
import OleRenderer from './OleRenderer.vue';
import ShapeEffectOverlay from './ShapeEffectOverlay.vue';
import SlideTextBlock from './SlideTextBlock.vue';
import SmartArt3DRenderer from './SmartArt3DRenderer.vue';
import SmartArtRenderer from './SmartArtRenderer.vue';
import TableRenderer from './TableRenderer.vue';
import WordArtText from './WordArtText.vue';
import ZoomRenderer from './ZoomRenderer.vue';

/**
 * ElementRenderer: Vue port of the React `ElementRenderer.tsx`.
 *
 * A thin dispatcher: renders a slide element by its `type` discriminant,
 * delegating each non-trivial type to a dedicated renderer component. The text
 * paragraph/bullet model is built by the shared, framework-agnostic
 * `buildParagraphs`; image/media branches live in their own box components.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	/**
	 * When true, emit the `data-pptx-element` test/interaction hook. Only the
	 * primary editable canvas sets this; thumbnails, the sorter, the export
	 * stage and presentation mode render without it.
	 */
	interactive?: boolean;
	/**
	 * When true, emit the `data-pptx-element` marker even though `interactive` is
	 * off. The main canvas sets this for template (master/layout) elements, which
	 * are interaction-locked outside edit-template mode but are still rendered
	 * slide elements as far as the contract is concerned (mirrors React, which
	 * always tags canvas elements and gates interactivity separately).
	 */
	marked?: boolean;
	/**
	 * When true, this element belongs to the slide layout/master and the viewer is
	 * in edit-template mode: draw a visual affordance so the user can tell apart
	 * the (now editable) shared template shapes from normal slide content.
	 */
	templateEditing?: boolean;
	/** True only on the live presentation stage; enables media autoplay. */
	presenting?: boolean;
	/**
	 * The enclosing group's fill (`GroupPptxElement.groupFill`), passed down by a
	 * group's render branch so a child painted with `a:grpFill` inherits it.
	 */
	parentGroupFill?: ShapeStyle;
}>();

/** Host opt-in to the Three.js SmartArt renderer (provided by PowerPointViewer). */
const smartArt3D = useSmartArt3D();

/** OOXML field-substitution context (slide number, date/time, etc.), provided by the viewer root. */
const fieldContextSource = injectFieldContext();

/** Sibling elements of the slide being painted, used to resolve linked text box chains. */
const slideElementsSource = injectSlideElements();

/**
 * Native-animation playback state for this element (present only during a running
 * presentation). Drives the staged chart / SmartArt build reveal and the
 * `p:animClr` fill / stroke relinquish, mirroring React's per-element
 * `animationState`. Absent (undefined) in editor / read-only rendering.
 */
const presentationStates = injectPresentationElementStates();
const animationState = computed(() => presentationStates.value.get(props.element.id));

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);
const shapeStyle = computed<CSSProperties>(() =>
	getShapeFillStrokeStyle(
		props.element,
		props.parentGroupFill,
		animationState.value?.animatesFill,
		animationState.value?.animatesStroke,
	),
);
/**
 * The fill handed to this group's `a:grpFill` children (undefined for
 * non-groups): its own, or - when it has none of its own - whatever this group
 * inherited, because `a:grpFill` resolves against the nearest ANCESTOR with a
 * fill rather than the immediate parent.
 */
const childParentGroupFill = computed<ShapeStyle | undefined>(() =>
	getGroupChildParentFill(props.element, props.parentGroupFill),
);
/**
 * Merge container + shape styles for the shape box. The shape style may carry a
 * 3D `transform` (from `visual-3d`); compose it with the container's
 * rotation/flip transform instead of letting the spread clobber it.
 */
const shapeDivStyle = computed<CSSProperties>(() => {
	const c = containerStyle.value;
	const s = shapeStyle.value;
	const merged: CSSProperties = { ...c, ...s };
	if (c.transform && s.transform) {
		merged.transform = `${c.transform} ${s.transform}`;
	}
	return merged;
});
const textStyle = computed<CSSProperties>(() => {
	const base = getTextBlockStyle(props.element);
	// Text body 3D scene (a:bodyPr/a:scene3d -> perspective + rotate transform),
	// mirroring React's ElementBody. Compose its transform with any existing
	// text-block transform rather than clobbering it. No-op when absent.
	const textStyleRaw = hasTextProperties(props.element) ? props.element.textStyle : undefined;
	const scene3d = buildTextBody3DSceneStyle(textStyleRaw) as CSSProperties | undefined;
	if (!scene3d) {
		return base;
	}
	const merged: CSSProperties = { ...base, ...scene3d };
	if (base.transform && scene3d.transform) {
		merged.transform = `${String(base.transform)} ${String(scene3d.transform)}`;
	}
	return merged;
});

/**
 * CSS 3D extrusion side-panel data for shapes with `a:sp3d` extrusion depth.
 * Mirrors React's `ElementRenderer`: real extruded faces are rendered as
 * `<div>` panels (the box-shadow approximation from `getShapeFillStrokeStyle`
 * is kept underneath, as in React). `hasExtrusion` is false for the common
 * no-3D case, so the overlay renders nothing.
 */
const extrusionData = computed(() => {
	const ss = hasShapeProperties(props.element) ? props.element.shapeStyle : undefined;
	return build3DExtrusionData(
		ss?.shape3d,
		ss?.scene3d,
		ss?.fillColor,
		props.element.width,
		props.element.height,
	);
});

const isShapeLike = computed(() => props.element.type === 'text' || props.element.type === 'shape');
const isImageLike = computed(
	() => props.element.type === 'picture' || props.element.type === 'image',
);

/**
 * Whether this element is a pure equation box (OMML and nothing else). Those
 * delegate wholesale to `EquationRenderer`, which self-positions and centres
 * the maths. A body that MIXES prose with an inline `m:oMath` goes down the
 * ordinary paragraph path instead, where shared emits the equation as a run in
 * its authored position: sending it here dropped every word around it.
 */
const hasEquation = computed(
	() => hasTextProperties(props.element) && isEquationOnlyText(props.element.textSegments),
);

/** Whether this element's text is warped (WordArt / `prstTxWarp`). */
const isWarpedText = computed(() => hasTextWarp(props.element));

/**
 * The slice of an `a:linkedTxbx` chain's text this box renders, or `undefined`
 * when the element is not in a chain (the overwhelmingly common case, resolved
 * by a single field check inside the shared helper).
 */
const linkedSegments = computed(() =>
	getOverflowSegments(props.element, resolveSlideElements(slideElementsSource)),
);

/** Rendered paragraphs (runs + bullet/indent), built by shared logic. */
const paragraphs = computed(() =>
	buildParagraphs(props.element, resolveFieldContext(fieldContextSource), linkedSegments.value),
);
const hasText = computed(() =>
	paragraphs.value.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
);

/** Affordance class toggled on for editable template (master/layout) elements. */
const templateClass = computed(() => (props.templateEditing ? 'pptx-vue-template-editing' : null));

/**
 * The neutral element marker (`data-pptx-element="true"`) every binding
 * advertises for a rendered slide element, or `undefined` on a static surface.
 *
 * Bound on the delegated renderer components (chart, table, connector, ink,
 * ole, model3d, zoom, equation, 3D SmartArt) as well as on the branches that
 * render their own box: each of those components has a single root `<div>` that
 * already carries `data-element-id`, so Vue's attribute fallthrough lands the
 * marker on exactly that node. Without it those types painted correctly but
 * were not elements as far as the contract is concerned, so anything that
 * enumerates or hit-tests slide elements by the marker skipped them silently.
 *
 * `marked` keeps the marker on interaction-locked template-layer elements.
 */
const elementMarker = computed<'true' | undefined>(() =>
	props.interactive || props.marked ? 'true' : undefined,
);

/**
 * `pointer-events: none` on the root while this render is not interactive,
 * mirroring React's `pointer-events-none` Tailwind class and Angular's
 * `rootPointerEvents` computed (see `element-renderer.component.ts`) on the
 * same condition. `elementMarker` keeps the `data-pptx-element` contract
 * attribute on a locked template (master/layout) element so it stays
 * findable as a rendered slide element, but the attribute alone never
 * stopped clicks/drags from reaching it: without this, a layout/master
 * shape stayed fully clickable with `editTemplateMode` off, because nothing
 * on its DOM node reflected the stage's id-based lock.
 *
 * `null` while interactive (rather than clearing `pointerEvents` explicitly)
 * so the style-array merge below leaves an already-set `pointerEvents` (e.g.
 * the hollow-shape outline-only hit-test in `getShapeFillStrokeStyle`)
 * untouched instead of clobbering it.
 *
 * On a RUNNING SHOW the value is `null` too, whatever `interactive` says: the
 * rule there is `PRESENTATION_HIT_TEST_CSS`, which re-enables action shapes
 * nested inside inert ones, and an inline `none` here outranks that stylesheet.
 * Writing it made every on-slide Action Setting unclickable, so the show
 * advanced instead of following the link. `inlineElementPointerEvents` owns the
 * distinction for all five bindings.
 */
const rootPointerEvents = computed<CSSProperties | null>(() => {
	const value = inlineElementPointerEvents({
		interactive: props.interactive === true,
		presenting: props.presenting === true,
	});
	return value ? { pointerEvents: value } : null;
});

/*
 * The on-canvas action affordances (amber "has action" badge + hover link
 * tooltip) used to be rendered here, but only for the text / shape branch: this
 * component dispatches every other type straight to a per-type view whose root
 * IS the element node, so there was nowhere to put them for a picture, chart,
 * table or media element. They are now painted for ALL types at the stage
 * boundary by `applyElementActionAffordances` (see `SlideStage.vue`), from the
 * same shared rule and stylesheet the other four bindings use.
 */

/**
 * Whether this element reaches the canvas at all. The Selection Pane's eye
 * toggle writes `element.hidden` (and `p:cNvPr/@hidden` on save); a hidden
 * element is drawn nowhere, exactly as in PowerPoint. Rendering nothing (rather
 * than painting an invisible box) is what keeps it out of hit-testing, the tab
 * order and the export raster. It stays listed in and selectable from the
 * Selection Pane, which reads the slide model rather than the DOM.
 */
const isRendered = computed(() => isElementRendered(props.element));
</script>

<template>
	<!-- Hidden via the Selection Pane: render nothing at all (see `isRendered`). -->
	<template v-if="!isRendered" />

	<!-- Group: recurse into children -->
	<div
		v-else-if="element.type === 'group'"
		class="pptx-vue-element pptx-vue-group"
		:class="templateClass"
		:style="[containerStyle, rootPointerEvents]"
		:data-element-id="element.id"
		:data-pptx-element="elementMarker"
	>
		<ElementRenderer
			v-for="(child, i) in element.children ?? []"
			:key="child.id"
			:element="child"
			:media-data-urls="mediaDataUrls"
			:z-index="i"
			:interactive="interactive"
			:marked="marked"
			:presenting="presenting"
			:parent-group-fill="childParentGroupFill"
		/>
	</div>

	<!-- Image / picture -->
	<ElementImageBox
		v-else-if="isImageLike"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:marked="marked"
		:class="templateClass"
	/>

	<!-- Media (video/audio/poster) -->
	<ElementMediaBox
		v-else-if="element.type === 'media'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:marked="marked"
		:presenting="presenting"
		:class="templateClass"
	/>

	<!--
		Connector / line.

		This and every delegated renderer below take `data-pptx-element` by
		attribute fallthrough onto their single root box; see `elementMarker`.
	-->
	<ConnectorRenderer
		v-else-if="element.type === 'connector'"
		:element="element"
		:z-index="zIndex"
		:animation-state="animationState"
		:data-pptx-element="elementMarker"
	/>

	<!-- Delegated element renderers (same prop contract) -->
	<!--
		Table and chart take `interactive` as a real prop (they already gate their
		own editing on it) and mark their own root from it, so no fallthrough
		attribute is bound here: the table's root is a `v-if`, and a fallthrough
		attr on a branch that renders nothing warns at runtime.
	-->
	<TableRenderer
		v-else-if="element.type === 'table'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:marked="marked"
	/>
	<ChartRenderer
		v-else-if="element.type === 'chart'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:marked="marked"
		:animation-state="animationState"
	/>
	<SmartArt3DRenderer
		v-else-if="element.type === 'smartArt' && smartArt3D"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:replay="presenting"
		:data-pptx-element="elementMarker"
	/>
	<SmartArtRenderer
		v-else-if="element.type === 'smartArt'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:marked="marked"
		:animation-state="animationState"
	/>
	<InkRenderer
		v-else-if="element.type === 'ink'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:replay="presenting"
		:data-pptx-element="elementMarker"
	/>
	<ContentPartRenderer
		v-else-if="element.type === 'contentPart'"
		:element="element"
		:z-index="zIndex"
		:presenting="presenting"
		:data-pptx-element="elementMarker"
	/>
	<OleRenderer
		v-else-if="element.type === 'ole'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:data-pptx-element="elementMarker"
	/>
	<Model3DRenderer
		v-else-if="element.type === 'model3d'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:data-pptx-element="elementMarker"
	/>
	<ZoomRenderer
		v-else-if="element.type === 'zoom'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:data-pptx-element="elementMarker"
	/>

	<!-- Equation (OMML → MathML): equation text boxes delegate wholesale -->
	<EquationRenderer
		v-else-if="hasEquation"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:data-pptx-element="elementMarker"
	/>

	<!-- Text / shape -->
	<div
		v-else-if="isShapeLike"
		class="pptx-vue-element pptx-vue-shape"
		:class="templateClass"
		:style="[shapeDivStyle, rootPointerEvents]"
		:data-element-id="element.id"
		:data-pptx-element="elementMarker"
	>
		<DuotoneFilterDefs :element="element" />
		<!-- Soft-edge <filter> defs + DAG fill-overlay tint layer + reflection. -->
		<ShapeEffectOverlay :element="element" :media-data-urls="mediaDataUrls" />
		<Extrusion3DOverlay v-if="extrusionData.hasExtrusion" :data="extrusionData" />
		<!-- Action-button glyph (home/help/sound/arrows/...); self-hides for non-buttons. -->
		<ActionButtonGlyphOverlay :element="element" />
		<WordArtText v-if="isWarpedText" :element="element" :z-index="0" />
		<SlideTextBlock
			v-else-if="hasText"
			:paragraphs="paragraphs"
			:text-style="textStyle"
			:element-id="element.id"
			:sub-element-anim-states="presentationStates"
		/>
	</div>

	<!-- Fallback placeholder for not-yet-ported element types -->
	<div
		v-else
		class="pptx-vue-element pptx-vue-unsupported"
		:class="templateClass"
		:style="[containerStyle, rootPointerEvents]"
		:data-element-id="element.id"
		:data-pptx-element="elementMarker"
	>
		<div class="pptx-vue-placeholder">{{ element.type }}</div>
	</div>
</template>
