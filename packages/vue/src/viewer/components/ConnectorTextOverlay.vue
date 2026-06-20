<script setup lang="ts">
import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

/**
 * ConnectorTextOverlay: Vue port of the React `ConnectorTextOverlay`.
 *
 * Renders a connector's label text centred over its bounding box. PowerPoint
 * lets authors attach a text run to a connector (`<p:cxnSp>` with a non-empty
 * `<p:txBody>`); the label is painted on top of the connector path, centred
 * both horizontally and vertically within the element box.
 *
 * The overlay is a plain absolutely-positioned flex container (not part of the
 * SVG) so per-segment rich text renders with normal HTML text layout. It is
 * `pointer-events: none` so it never intercepts selection / hit-testing on the
 * connector beneath it.
 */
const props = defineProps<{
	/** Trimmed plain-text label (empty → nothing rendered). */
	text: string;
	/** Per-run styled segments (empty → nothing rendered). */
	segments: readonly TextSegment[] | undefined;
	/** Paragraph-level text style (alignment, default font, colour). */
	textStyle?: TextStyle;
}>();

/** Whether there is any label to render. */
const hasText = computed(
	() => Boolean(props.text) && Boolean(props.segments) && (props.segments?.length ?? 0) > 0,
);

/**
 * Map an OOXML paragraph alignment to a CSS `text-align` value. The justify
 * variants (`justLow`/`dist`/`thaiDist`) collapse to `justify`; everything
 * else passes through, defaulting to `center` (connector labels centre by
 * convention).
 */
const containerStyle = computed<CSSProperties>(() => {
	const align = props.textStyle?.align;
	const textAlign: CSSProperties['textAlign'] =
		align === 'justLow' || align === 'dist' || align === 'thaiDist'
			? 'justify'
			: (align ?? 'center');
	return { textAlign };
});

/** Paragraph-level inline style applied to the inner text block. */
const blockStyle = computed<CSSProperties>(() => {
	const ts = props.textStyle;
	return {
		fontFamily: ts?.fontFamily ?? 'inherit',
		fontSize: ts?.fontSize ? `${ts.fontSize}pt` : '10pt',
		color: ts?.color ?? '#000000',
		fontWeight: ts?.bold ? 'bold' : 'normal',
		fontStyle: ts?.italic ? 'italic' : 'normal',
		textDecoration: ts?.underline ? 'underline' : 'none',
	};
});

/** Per-segment inline style, falling back to the paragraph-level style. */
function segStyle(seg: TextSegment): CSSProperties {
	const s = seg.style;
	const ts = props.textStyle;
	return {
		fontFamily: s?.fontFamily ?? ts?.fontFamily ?? 'inherit',
		fontSize: s?.fontSize ? `${s.fontSize}pt` : undefined,
		color: s?.color ?? ts?.color ?? '#000000',
		fontWeight: s?.bold ? 'bold' : ts?.bold ? 'bold' : 'normal',
		fontStyle: s?.italic ? 'italic' : ts?.italic ? 'italic' : 'normal',
		textDecoration: s?.underline ? 'underline' : 'none',
	};
}
</script>

<template>
	<div v-if="hasText" class="pptx-vue-connector-text" :style="containerStyle">
		<div class="pptx-vue-connector-text__block" :style="blockStyle">
			<span
				v-for="(seg, idx) in segments"
				:key="idx"
				class="pptx-vue-connector-text__run"
				:style="segStyle(seg)"
				>{{ seg.text }}</span
			>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-connector-text {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	pointer-events: none;
}

.pptx-vue-connector-text__block {
	padding: 0 4px;
	white-space: pre-wrap;
	line-height: 1.2;
	max-width: 100%;
}
</style>
