<script setup lang="ts">
import type { ConnectorArrowType, PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { DEFAULT_STROKE_COLOR } from '../constants';

/**
 * ConnectorRenderer — Vue port of the React `ConnectorElementRenderer`
 * (basic subset).
 *
 * Renders straight connectors/lines as an inline SVG spanning the element's
 * bounding box, with stroke colour/width/dash and start/end arrowheads. Flip
 * is baked into the endpoints (not a CSS transform) so arrowheads point the
 * right way.
 *
 * Not yet ported (TODO, see PORTING.md): bent/curved connector routing
 * (`getConnectorPathGeometry`), compound lines, connector text overlay, line
 * shadows/glow. Bent/curved connectors currently fall back to a straight line.
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
}>();

const ss = computed(() =>
	hasShapeProperties(props.element) ? props.element.shapeStyle : undefined,
);

const strokeWidth = computed(() => Math.max(0, ss.value?.strokeWidth ?? 2));
const strokeColor = computed(() => ss.value?.strokeColor ?? DEFAULT_STROKE_COLOR);
const strokeOpacity = computed(() => ss.value?.strokeOpacity ?? 1);

const dashArray = computed<string | undefined>(() => {
	const dash = ss.value?.strokeDash;
	const w = Math.max(strokeWidth.value, 1);
	if (!dash || dash === 'solid') {
		return undefined;
	}
	if (dash === 'dot' || dash === 'sysDot') {
		return `${w} ${w}`;
	}
	return `${w * 3} ${w}`;
});

const w = computed(() => Math.max(props.element.width, 1));
const h = computed(() => Math.max(props.element.height, 1));

// Straight connector endpoints, mirrored by flip flags.
const x1 = computed(() => (props.element.flipHorizontal ? w.value : 0));
const y1 = computed(() => (props.element.flipVertical ? h.value : 0));
const x2 = computed(() => (props.element.flipHorizontal ? 0 : w.value));
const y2 = computed(() => (props.element.flipVertical ? 0 : h.value));

const startArrow = computed(() => normalizeArrow(ss.value?.connectorStartArrow));
const endArrow = computed(() => normalizeArrow(ss.value?.connectorEndArrow));

function normalizeArrow(a: ConnectorArrowType | undefined): ConnectorArrowType | undefined {
	return a && a !== 'none' ? a : undefined;
}

/** Distinct, DOM-id-safe marker ids per element + side. */
const markerSeed = computed(() => props.element.id.replace(/[^a-zA-Z0-9_-]/gu, '_'));
const startMarkerId = computed(() => `${markerSeed.value}-start`);
const endMarkerId = computed(() => `${markerSeed.value}-end`);

const wrapperStyle = computed<CSSProperties>(() => {
	const el = props.element;
	const style: CSSProperties = {
		position: 'absolute',
		left: `${el.x}px`,
		top: `${el.y}px`,
		width: `${el.width}px`,
		height: `${el.height}px`,
		zIndex: props.zIndex,
		pointerEvents: 'none',
		overflow: 'visible',
	};
	if (el.rotation) {
		// Flip is handled via endpoints, so only rotation goes on the transform.
		style.transform = `rotate(${el.rotation}deg)`;
	}
	if (typeof el.opacity === 'number') {
		style.opacity = el.opacity;
	}
	if (el.hidden) {
		style.display = 'none';
	}
	return style;
});

/** Marker element shape per arrow type (viewBox 0 0 10 10). */
function markerPath(type: ConnectorArrowType): { shape: 'path' | 'circle'; d?: string } {
	switch (type) {
		case 'diamond':
			return { shape: 'path', d: 'M5 0 L10 5 L5 10 L0 5 Z' };
		case 'oval':
			return { shape: 'circle' };
		case 'stealth':
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 L3 5 Z' };
		// triangle / arrow / fallback
		default:
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 Z' };
	}
}

const startMarker = computed(() => (startArrow.value ? markerPath(startArrow.value) : null));
const endMarker = computed(() => (endArrow.value ? markerPath(endArrow.value) : null));
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-connector"
		:style="wrapperStyle"
		:data-element-id="element.id"
	>
		<svg
			:width="w"
			:height="h"
			:viewBox="`0 0 ${w} ${h}`"
			style="overflow: visible; display: block"
		>
			<defs>
				<marker
					v-if="startMarker"
					:id="startMarkerId"
					viewBox="0 0 10 10"
					refX="5"
					refY="5"
					:markerWidth="4"
					:markerHeight="4"
					orient="auto-start-reverse"
					markerUnits="strokeWidth"
				>
					<circle v-if="startMarker.shape === 'circle'" cx="5" cy="5" r="4" :fill="strokeColor" />
					<path v-else :d="startMarker.d" :fill="strokeColor" />
				</marker>
				<marker
					v-if="endMarker"
					:id="endMarkerId"
					viewBox="0 0 10 10"
					refX="5"
					refY="5"
					:markerWidth="4"
					:markerHeight="4"
					orient="auto-start-reverse"
					markerUnits="strokeWidth"
				>
					<circle v-if="endMarker.shape === 'circle'" cx="5" cy="5" r="4" :fill="strokeColor" />
					<path v-else :d="endMarker.d" :fill="strokeColor" />
				</marker>
			</defs>
			<line
				:x1="x1"
				:y1="y1"
				:x2="x2"
				:y2="y2"
				:stroke="strokeColor"
				:stroke-width="strokeWidth"
				:stroke-opacity="strokeOpacity"
				:stroke-dasharray="dashArray"
				stroke-linecap="round"
				:marker-start="startMarker ? `url(#${startMarkerId})` : undefined"
				:marker-end="endMarker ? `url(#${endMarkerId})` : undefined"
			/>
		</svg>
	</div>
</template>
