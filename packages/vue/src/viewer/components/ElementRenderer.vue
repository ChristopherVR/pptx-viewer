<script setup lang="ts">
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import {
	getContainerStyle,
	getImageSrc,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from '../composables/element-style';
import ChartRenderer from './ChartRenderer.vue';
import ConnectorRenderer from './ConnectorRenderer.vue';
import TableRenderer from './TableRenderer.vue';

/**
 * ElementRenderer — Vue port of the React `ElementRenderer.tsx`.
 *
 * Renders a single slide element by its `type` discriminant. This is the
 * viewer-first subset:
 *  - `text` / `shape`        → positioned box with fill/stroke + rich text
 *  - `picture` / `image`     → `<img>`
 *  - `media`                 → poster frame (`<img>`) — playback TODO
 *  - `group`                 → recursive children
 *  - everything else         → labelled placeholder (TODO, see PORTING.md)
 *
 * Interaction (selection, resize handles, inline editing), connectors,
 * charts, tables, SmartArt, ink, OLE, and 3D are not yet ported.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);
const shapeStyle = computed<CSSProperties>(() => getShapeFillStrokeStyle(props.element));
const textStyle = computed<CSSProperties>(() => getTextBlockStyle(props.element));
const imageSrc = computed(() => getImageSrc(props.element, props.mediaDataUrls));

const isShapeLike = computed(() => props.element.type === 'text' || props.element.type === 'shape');
const isImageLike = computed(
	() => props.element.type === 'picture' || props.element.type === 'image',
);

/** Per-run inline style derived from a TextSegment's style. */
function segmentStyle(seg: TextSegment): CSSProperties {
	const s = seg.style ?? {};
	const style: CSSProperties = {};
	if (s.fontFamily) {
		style.fontFamily = s.fontFamily;
	}
	if (typeof s.fontSize === 'number') {
		style.fontSize = `${s.fontSize}pt`;
	}
	if (s.color) {
		style.color = s.color;
	}
	if (s.bold) {
		style.fontWeight = 'bold';
	}
	if (s.italic) {
		style.fontStyle = 'italic';
	}
	const deco: string[] = [];
	if (s.underline) {
		deco.push('underline');
	}
	if (s.strikethrough) {
		deco.push('line-through');
	}
	if (deco.length > 0) {
		style.textDecoration = deco.join(' ');
	}
	return style;
}

/**
 * Group text segments into paragraphs of runs. Paragraph breaks start a new
 * line; line breaks insert a newline within a paragraph.
 */
const paragraphs = computed<Array<Array<{ text: string; style: CSSProperties }>>>(() => {
	const el = props.element;
	if (!hasTextProperties(el)) {
		return [];
	}
	const segments = el.textSegments;
	if (!segments || segments.length === 0) {
		return el.text ? [[{ text: el.text, style: {} }]] : [];
	}
	const out: Array<Array<{ text: string; style: CSSProperties }>> = [[]];
	for (const seg of segments) {
		if (seg.isParagraphBreak) {
			out.push([]);
			continue;
		}
		const current = out[out.length - 1];
		const text = seg.isLineBreak ? '\n' : seg.text;
		if (text) {
			current.push({ text, style: segmentStyle(seg) });
		}
	}
	return out.filter((p) => p.length > 0 || out.length === 1);
});

const hasText = computed(() => paragraphs.value.some((p) => p.length > 0));

/** Friendly label for the placeholder rendered for not-yet-ported types. */
const placeholderLabel = computed(() => {
	const map: Record<string, string> = {
		smartArt: 'SmartArt',
		connector: 'Connector',
		group: 'Group',
		media: 'Media',
		ink: 'Ink',
		ole: 'Embedded object',
		model3d: '3D model',
		zoom: 'Zoom',
	};
	return map[props.element.type] ?? props.element.type;
});
</script>

<template>
	<!-- Group: recurse into children -->
	<div
		v-if="element.type === 'group'"
		class="pptx-vue-element pptx-vue-group"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<ElementRenderer
			v-for="(child, i) in element.children ?? []"
			:key="child.id"
			:element="child"
			:media-data-urls="mediaDataUrls"
			:z-index="i"
		/>
	</div>

	<!-- Image / picture -->
	<div
		v-else-if="isImageLike"
		class="pptx-vue-element pptx-vue-image"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<img
			v-if="imageSrc"
			:src="imageSrc"
			alt=""
			style="width: 100%; height: 100%; object-fit: contain; display: block"
		/>
	</div>

	<!-- Media: poster frame only (playback not yet ported) -->
	<div
		v-else-if="element.type === 'media'"
		class="pptx-vue-element pptx-vue-media"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<img
			v-if="imageSrc"
			:src="imageSrc"
			alt=""
			style="width: 100%; height: 100%; object-fit: contain; display: block"
		/>
		<div v-else class="pptx-vue-placeholder">{{ placeholderLabel }}</div>
	</div>

	<!-- Connector / line -->
	<ConnectorRenderer
		v-else-if="element.type === 'connector'"
		:element="element"
		:z-index="zIndex"
	/>

	<!-- Table -->
	<TableRenderer
		v-else-if="element.type === 'table'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Chart -->
	<ChartRenderer
		v-else-if="element.type === 'chart'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Text / shape -->
	<div
		v-else-if="isShapeLike"
		class="pptx-vue-element pptx-vue-shape"
		:style="{ ...containerStyle, ...shapeStyle }"
		:data-element-id="element.id"
	>
		<div v-if="hasText" class="pptx-vue-text" :style="textStyle">
			<p v-for="(para, pi) in paragraphs" :key="pi" style="margin: 0">
				<template v-for="(run, ri) in para" :key="ri">
					<br v-if="run.text === '\n'" />
					<span v-else :style="run.style">{{ run.text }}</span>
				</template>
			</p>
		</div>
	</div>

	<!-- Fallback placeholder for not-yet-ported element types -->
	<div
		v-else
		class="pptx-vue-element pptx-vue-unsupported"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<div class="pptx-vue-placeholder">{{ placeholderLabel }}</div>
	</div>
</template>
