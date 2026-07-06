<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import { buildParagraphs, buildTextBody3DSceneStyle, hasTextWarp } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from '../composables/element-style';
import { injectFieldContext, resolveFieldContext } from '../composables/field-context';
import { useSmartArt3D } from '../composables/smart-art-3d';
import { build3DExtrusionData } from '../composables/visual-3d';
import ActionButtonGlyphOverlay from './ActionButtonGlyphOverlay.vue';
import ChartRenderer from './ChartRenderer.vue';
import ConnectorRenderer from './ConnectorRenderer.vue';
import DuotoneFilterDefs from './DuotoneFilterDefs.vue';
import ElementImageBox from './ElementImageBox.vue';
import ElementMediaBox from './ElementMediaBox.vue';
import EquationRenderer from './EquationRenderer.vue';
import Extrusion3DOverlay from './Extrusion3DOverlay.vue';
import InkRenderer from './InkRenderer.vue';
import LinkTooltip from './LinkTooltip.vue';
import Model3DRenderer from './Model3DRenderer.vue';
import OleRenderer from './OleRenderer.vue';
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
	 * When true, this element belongs to the slide layout/master and the viewer is
	 * in edit-template mode: draw a visual affordance so the user can tell apart
	 * the (now editable) shared template shapes from normal slide content.
	 */
	templateEditing?: boolean;
}>();

const { t } = useI18n();

/** Host opt-in to the Three.js SmartArt renderer (provided by PowerPointViewer). */
const smartArt3D = useSmartArt3D();

/** OOXML field-substitution context (slide number, date/time, etc.), provided by the viewer root. */
const fieldContextSource = injectFieldContext();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);
const shapeStyle = computed<CSSProperties>(() => getShapeFillStrokeStyle(props.element));
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
 * Whether this element carries math equation segments (OMML). Equation text
 * boxes delegate wholesale to `EquationRenderer` (which self-positions).
 */
const hasEquation = computed(
	() =>
		hasTextProperties(props.element) &&
		(props.element.textSegments ?? []).some((s) => s.equationXml),
);

/** Whether this element's text is warped (WordArt / `prstTxWarp`). */
const isWarpedText = computed(() => hasTextWarp(props.element));

/** Rendered paragraphs (runs + bullet/indent), built by shared logic. */
const paragraphs = computed(() =>
	buildParagraphs(props.element, resolveFieldContext(fieldContextSource)),
);
const hasText = computed(() =>
	paragraphs.value.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
);

/** Affordance class toggled on for editable template (master/layout) elements. */
const templateClass = computed(() => (props.templateEditing ? 'pptx-vue-template-editing' : null));

/**
 * Element-level click action (`actionClick`), when present. Drives the on-canvas
 * link tooltip (and the `group/link` hover container). Mirrors React's
 * `ElementRenderer`, which shows a styled {@link LinkTooltip} for any element
 * carrying an action in an interactive tree.
 */
const linkAction = computed(() => props.element.actionClick);
const showLinkTooltip = computed(
	() =>
		props.interactive === true &&
		Boolean(linkAction.value?.url || linkAction.value?.tooltip || linkAction.value?.action),
);
const linkTooltipLabel = computed(
	() =>
		linkAction.value?.tooltip ||
		linkAction.value?.url ||
		linkAction.value?.action ||
		t('pptx.element.linkFallback'),
);
</script>

<template>
	<!-- Group: recurse into children -->
	<div
		v-if="element.type === 'group'"
		class="pptx-vue-element pptx-vue-group"
		:class="templateClass"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<ElementRenderer
			v-for="(child, i) in element.children ?? []"
			:key="child.id"
			:element="child"
			:media-data-urls="mediaDataUrls"
			:z-index="i"
			:interactive="interactive"
		/>
	</div>

	<!-- Image / picture -->
	<ElementImageBox
		v-else-if="isImageLike"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:class="templateClass"
	/>

	<!-- Media (video/audio/poster) -->
	<ElementMediaBox
		v-else-if="element.type === 'media'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:class="templateClass"
	/>

	<!-- Connector / line -->
	<ConnectorRenderer
		v-else-if="element.type === 'connector'"
		:element="element"
		:z-index="zIndex"
	/>

	<!-- Delegated element renderers (same prop contract) -->
	<TableRenderer
		v-else-if="element.type === 'table'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
	/>
	<ChartRenderer
		v-else-if="element.type === 'chart'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<SmartArt3DRenderer
		v-else-if="element.type === 'smartArt' && smartArt3D"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<SmartArtRenderer
		v-else-if="element.type === 'smartArt'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<InkRenderer
		v-else-if="element.type === 'ink'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<OleRenderer
		v-else-if="element.type === 'ole'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<Model3DRenderer
		v-else-if="element.type === 'model3d'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<ZoomRenderer
		v-else-if="element.type === 'zoom'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Equation (OMML → MathML): equation text boxes delegate wholesale -->
	<EquationRenderer
		v-else-if="hasEquation"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Text / shape -->
	<div
		v-else-if="isShapeLike"
		class="pptx-vue-element pptx-vue-shape"
		:class="[templateClass, showLinkTooltip ? 'group/link' : null]"
		:style="shapeDivStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<DuotoneFilterDefs :element="element" />
		<Extrusion3DOverlay v-if="extrusionData.hasExtrusion" :data="extrusionData" />
		<!-- Action-button glyph (home/help/sound/arrows/...); self-hides for non-buttons. -->
		<ActionButtonGlyphOverlay :element="element" />
		<WordArtText v-if="isWarpedText" :element="element" :z-index="0" />
		<SlideTextBlock v-else-if="hasText" :paragraphs="paragraphs" :text-style="textStyle" />
		<!-- On-canvas hyperlink / action tooltip (edit-mode hover). -->
		<LinkTooltip
			v-if="showLinkTooltip"
			:label="linkTooltipLabel"
			:has-url="Boolean(linkAction?.url)"
		/>
	</div>

	<!-- Fallback placeholder for not-yet-ported element types -->
	<div
		v-else
		class="pptx-vue-element pptx-vue-unsupported"
		:class="templateClass"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<div class="pptx-vue-placeholder">{{ element.type }}</div>
	</div>
</template>
