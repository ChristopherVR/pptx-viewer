<script setup lang="ts">
import type { ConnectorArrowType, PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import {
	connectorNeedsPath,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	getConnectorPathGeometry,
} from '../composables/connector-routing';
import { DEFAULT_STROKE_COLOR } from '../constants';

/**
 * ConnectorRenderer — Vue port of the React `ConnectorElementRenderer`.
 *
 * Renders straight, bent, and curved connectors as an inline SVG spanning the
 * element's bounding box, with stroke colour/width/dash, start/end arrowheads,
 * and compound (double/triple) line support.
 *
 * Supported connector types:
 * - straightConnector1 / line  → simple <line> element
 * - bentConnector2/3/4/5       → orthogonal elbow path (L commands)
 * - curvedConnector2/3/4/5     → Bézier curve path (Q / C commands)
 * - compound lines (dbl/thickThin/thinThick/tri) → parallel offset strokes
 *
 * Flip is baked into the path geometry (not a CSS transform) so arrowheads
 * point the right way for both straight and multi-segment connectors.
 *
 * Not yet ported (TODO, see PORTING.md): line shadows/glow effects,
 * connector text overlay (data model does carry textSegments on some connectors
 * but no Vue text-overlay component exists yet).
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

// ── Compound line support ─────────────────────────────────────────────────────

const compoundLine = computed(() => ss.value?.compoundLine);

const compoundOffsets = computed(() =>
	getCompoundLineOffsets(compoundLine.value, strokeWidth.value),
);
const compoundWidths = computed(() => getCompoundLineWidths(compoundLine.value, strokeWidth.value));

// ── Path / geometry routing ───────────────────────────────────────────────────

/**
 * Whether this connector uses multi-segment routing (bent or curved).
 * When true we render a <path> instead of a <line>.
 */
const usePathRouting = computed(() => {
	const shapeType = hasShapeProperties(props.element) ? props.element.shapeType : undefined;
	return connectorNeedsPath(shapeType);
});

/**
 * SVG path geometry computed from the connector type, dimensions, flip flags,
 * and adjustment values.  Only used when `usePathRouting` is true.
 */
const pathGeometry = computed(() => {
	if (!usePathRouting.value) {
		return null;
	}
	const el = props.element;
	if (!hasShapeProperties(el)) {
		return null;
	}
	return getConnectorPathGeometry(el);
});

// Straight connector endpoints (used when !usePathRouting) — mirrored by flips.
const x1 = computed(() => (props.element.flipHorizontal ? w.value : 0));
const y1 = computed(() => (props.element.flipVertical ? h.value : 0));
const x2 = computed(() => (props.element.flipHorizontal ? 0 : w.value));
const y2 = computed(() => (props.element.flipVertical ? 0 : h.value));

// ── Arrowheads ───────────────────────────────────────────────────────────────

const startArrow = computed(() => normalizeArrow(ss.value?.connectorStartArrow));
const endArrow = computed(() => normalizeArrow(ss.value?.connectorEndArrow));

function normalizeArrow(a: ConnectorArrowType | undefined): ConnectorArrowType | undefined {
	return a && a !== 'none' ? a : undefined;
}

/** Distinct, DOM-id-safe marker ids per element + side. */
const markerSeed = computed(() => props.element.id.replace(/[^a-zA-Z0-9_-]/gu, '_'));
const startMarkerId = computed(() => `${markerSeed.value}-start`);
const endMarkerId = computed(() => `${markerSeed.value}-end`);

// ── Wrapper style ─────────────────────────────────────────────────────────────

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
		// Flip is handled via path geometry, so only rotation goes on the transform.
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

// ── Marker shape helpers ──────────────────────────────────────────────────────

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

// ── Compound offset style helpers ─────────────────────────────────────────────

/**
 * Build the transform style string for a compound stroke at the given offset.
 * Returns undefined for offset === 0 (no transform needed).
 */
function offsetTransform(offset: number): string | undefined {
	if (offset === 0) {
		return undefined;
	}
	return `translate(0, ${offset}px)`;
}
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

			<!-- ── Bent / curved connector: multi-segment <path> ─────────────────── -->
			<template v-if="usePathRouting && pathGeometry">
				<path
					v-for="(offset, idx) in compoundOffsets"
					:key="idx"
					:d="pathGeometry.pathData"
					fill="none"
					:stroke="strokeColor"
					:stroke-width="Math.max(compoundWidths[idx] ?? strokeWidth, 1)"
					:stroke-opacity="strokeOpacity"
					:stroke-dasharray="dashArray"
					stroke-linecap="round"
					stroke-linejoin="round"
					:style="offsetTransform(offset) ? { transform: offsetTransform(offset) } : undefined"
					:marker-start="idx === 0 && startMarker ? `url(#${startMarkerId})` : undefined"
					:marker-end="
						idx === compoundOffsets.length - 1 && endMarker ? `url(#${endMarkerId})` : undefined
					"
				/>
			</template>

			<!-- ── Straight connector: simple <line> (or compound parallel lines) ─ -->
			<template v-else>
				<line
					v-for="(offset, idx) in compoundOffsets"
					:key="idx"
					:x1="x1"
					:y1="y1 + offset"
					:x2="x2"
					:y2="y2 + offset"
					:stroke="strokeColor"
					:stroke-width="Math.max(compoundWidths[idx] ?? strokeWidth, 1)"
					:stroke-opacity="strokeOpacity"
					:stroke-dasharray="dashArray"
					stroke-linecap="round"
					:marker-start="idx === 0 && startMarker ? `url(#${startMarkerId})` : undefined"
					:marker-end="
						idx === compoundOffsets.length - 1 && endMarker ? `url(#${endMarkerId})` : undefined
					"
				/>
			</template>

			<!-- TODO: connector text overlay — textSegments data is present on the
			     element when the PPTX author added a label to the connector, but the
			     Vue viewer does not yet have a ConnectorTextOverlay component. -->
		</svg>
	</div>
</template>
