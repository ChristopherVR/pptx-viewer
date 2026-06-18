<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { buildParagraphs, hasTextWarp } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from '../composables/element-style';
import ChartRenderer from './ChartRenderer.vue';
import ConnectorRenderer from './ConnectorRenderer.vue';
import ElementImageBox from './ElementImageBox.vue';
import ElementMediaBox from './ElementMediaBox.vue';
import EquationRenderer from './EquationRenderer.vue';
import InkRenderer from './InkRenderer.vue';
import Model3DRenderer from './Model3DRenderer.vue';
import OleRenderer from './OleRenderer.vue';
import SlideTextBlock from './SlideTextBlock.vue';
import SmartArtRenderer from './SmartArtRenderer.vue';
import TableRenderer from './TableRenderer.vue';
import WordArtText from './WordArtText.vue';
import ZoomRenderer from './ZoomRenderer.vue';

/**
 * ElementRenderer — Vue port of the React `ElementRenderer.tsx`.
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
	 * primary editable canvas sets this — thumbnails, the sorter, the export
	 * stage and presentation mode render without it.
	 */
	interactive?: boolean;
}>();

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
const textStyle = computed<CSSProperties>(() => getTextBlockStyle(props.element));

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
const paragraphs = computed(() => buildParagraphs(props.element));
const hasText = computed(() =>
	paragraphs.value.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
);
</script>

<template>
	<!-- Group: recurse into children -->
	<div
		v-if="element.type === 'group'"
		class="pptx-vue-element pptx-vue-group"
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
	/>

	<!-- Media (video/audio/poster) -->
	<ElementMediaBox
		v-else-if="element.type === 'media'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
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
	/>
	<ChartRenderer
		v-else-if="element.type === 'chart'"
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

	<!-- Equation (OMML → MathML) — equation text boxes delegate wholesale -->
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
		:style="shapeDivStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<WordArtText v-if="isWarpedText" :element="element" :z-index="0" />
		<SlideTextBlock v-else-if="hasText" :paragraphs="paragraphs" :text-style="textStyle" />
	</div>

	<!-- Fallback placeholder for not-yet-ported element types -->
	<div
		v-else
		class="pptx-vue-element pptx-vue-unsupported"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<div class="pptx-vue-placeholder">{{ element.type }}</div>
	</div>
</template>
