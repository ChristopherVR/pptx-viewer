<script setup lang="ts">
import type { ConnectorArrowType, PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import { getLineGlowFilterCss, getLineShadowParams, markerPath } from 'pptx-viewer-shared';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import {
	connectorNeedsPath,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	getConnectorPathGeometry,
} from '../composables/connector-routing';
import { DEFAULT_STROKE_COLOR } from '../constants';
import ConnectorTextOverlay from './ConnectorTextOverlay.vue';

/**
 * ConnectorRenderer: Vue port of the React `ConnectorElementRenderer`.
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
 * Connector labels (a non-empty `<p:txBody>` on the connector) render via the
 * {@link ConnectorTextOverlay} child, centred over the bounding box.
 *
 * Line-level shadow (`a:ln/a:outerShdw`) renders as an SVG `feDropShadow` on the
 * primary stroke; line glow (`a:ln/a:glow`) as a CSS `drop-shadow` filter on the
 * wrapper. Both reuse the shared visual-effects helpers.
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
	/**
	 * Native-animation playback state. When an active `p:animClr` colour animation
	 * targets the stroke (`animatesStroke`), the SVG stroke is painted `inherit` so
	 * the wrapper's animated `stroke` keyframes cascade into the line + arrowheads.
	 */
	animationState?: ElementAnimationState;
}>();

const ss = computed(() =>
	hasShapeProperties(props.element) ? props.element.shapeStyle : undefined,
);

const strokeWidth = computed(() => Math.max(0, ss.value?.strokeWidth ?? 2));
const strokeColor = computed(() =>
	props.animationState?.animatesStroke
		? 'inherit'
		: (ss.value?.strokeColor ?? DEFAULT_STROKE_COLOR),
);
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

// Straight connector endpoints (used when !usePathRouting), mirrored by flips.
const x1 = computed(() => (props.element.flipHorizontal ? w.value : 0));
const y1 = computed(() => (props.element.flipVertical ? h.value : 0));
const x2 = computed(() => (props.element.flipHorizontal ? 0 : w.value));
const y2 = computed(() => (props.element.flipVertical ? 0 : h.value));

// ── Pointer hit target ────────────────────────────────────────────────────────

/**
 * WHY a separate invisible stroke: the wrapper is `pointer-events: none` (so a
 * connector's empty bounding box never swallows clicks meant for the shapes it
 * spans), which left the line itself unclickable too. No pointer route reached
 * a connector at all, so the inspector's connector card could only be opened
 * from the Elements list. React has always carried this transparent, generously
 * wide stroke that opts back INTO hit testing; `pointer-events: stroke` keeps
 * the target on the line and off the box.
 */
const hitTargetWidth = computed(() => Math.max(strokeWidth.value * 3, 14));

/** The routed path when the connector bends, else its straight endpoints. */
const hitPathData = computed(() =>
	usePathRouting.value && pathGeometry.value
		? pathGeometry.value.pathData
		: `M ${x1.value} ${y1.value} L ${x2.value} ${y2.value}`,
);

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
	if (lineGlow.value) {
		style.filter = lineGlow.value;
	}
	if (el.hidden) {
		style.display = 'none';
	}
	return style;
});

// ── Marker shape helpers ──────────────────────────────────────────────────────

// Pass the `@w`/`@len` arrow size tokens so `sm`/`med`/`lg` heads scale; the
// returned MarkerShape carries the suggested `markerWidth` (length along the
// line) and `markerHeight` (perpendicular width) applied on the <marker> below.
const startMarker = computed(() =>
	startArrow.value
		? markerPath(
				startArrow.value,
				ss.value?.connectorStartArrowWidth,
				ss.value?.connectorStartArrowLength,
			)
		: null,
);
const endMarker = computed(() =>
	endArrow.value
		? markerPath(
				endArrow.value,
				ss.value?.connectorEndArrowWidth,
				ss.value?.connectorEndArrowLength,
			)
		: null,
);

// ── Line shadow / glow effects ─────────────────────────────────────────────────

/** Resolved line-shadow params (feDropShadow), or undefined when no shadow. */
const lineShadow = computed(() => getLineShadowParams(ss.value));
/** CSS `drop-shadow` filter for a line glow, applied to the wrapper. */
const lineGlow = computed(() => getLineGlowFilterCss(ss.value));
/** DOM-safe id for the shadow <filter>. */
const shadowFilterId = computed(() => `${markerSeed.value}-line-shadow`);

// ── Connector text label ───────────────────────────────────────────────────────

/** The element narrowed to its text properties, when it carries any. */
const textEl = computed(() => (hasTextProperties(props.element) ? props.element : undefined));

/** Trimmed plain-text label (empty when the connector has no text). */
const connectorText = computed(() => textEl.value?.text?.trim() ?? '');
/** Per-run styled text segments, when present. */
const connectorTextSegments = computed<readonly TextSegment[] | undefined>(
	() => textEl.value?.textSegments,
);
/** Paragraph-level text style (font/colour/alignment). */
const connectorTextStyle = computed<TextStyle | undefined>(() => textEl.value?.textStyle);

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
					:markerWidth="startMarker.markerWidth"
					:markerHeight="startMarker.markerHeight"
					orient="auto-start-reverse"
					markerUnits="strokeWidth"
				>
					<circle v-if="startMarker.shape === 'circle'" cx="5" cy="5" r="4" :fill="strokeColor" />
					<path
						v-else
						:d="startMarker.d"
						:fill="startMarker.strokeOnly ? 'none' : strokeColor"
						:stroke="startMarker.strokeOnly ? strokeColor : undefined"
					/>
				</marker>
				<marker
					v-if="endMarker"
					:id="endMarkerId"
					viewBox="0 0 10 10"
					refX="5"
					refY="5"
					:markerWidth="endMarker.markerWidth"
					:markerHeight="endMarker.markerHeight"
					orient="auto-start-reverse"
					markerUnits="strokeWidth"
				>
					<circle v-if="endMarker.shape === 'circle'" cx="5" cy="5" r="4" :fill="strokeColor" />
					<path
						v-else
						:d="endMarker.d"
						:fill="endMarker.strokeOnly ? 'none' : strokeColor"
						:stroke="endMarker.strokeOnly ? strokeColor : undefined"
					/>
				</marker>
				<filter v-if="lineShadow" :id="shadowFilterId" x="-50%" y="-50%" width="200%" height="200%">
					<feDropShadow
						:dx="lineShadow.offsetX"
						:dy="lineShadow.offsetY"
						:stdDeviation="lineShadow.blur / 2"
						:flood-color="lineShadow.color"
						:flood-opacity="lineShadow.opacity"
					/>
				</filter>
			</defs>

			<!-- Invisible click target: the only pointer-reachable part of a connector. -->
			<path
				class="pptx-vue-connector-hit"
				:d="hitPathData"
				fill="none"
				stroke="transparent"
				:stroke-width="hitTargetWidth"
				stroke-linecap="round"
				stroke-linejoin="round"
				style="pointer-events: stroke"
			/>

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
					:filter="idx === 0 && lineShadow ? `url(#${shadowFilterId})` : undefined"
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
					:filter="idx === 0 && lineShadow ? `url(#${shadowFilterId})` : undefined"
					:marker-start="idx === 0 && startMarker ? `url(#${startMarkerId})` : undefined"
					:marker-end="
						idx === compoundOffsets.length - 1 && endMarker ? `url(#${endMarkerId})` : undefined
					"
				/>
			</template>
		</svg>

		<!-- Connector label, centred over the path (rendered above the SVG). -->
		<ConnectorTextOverlay
			v-if="connectorTextSegments"
			:text="connectorText"
			:segments="connectorTextSegments"
			:text-style="connectorTextStyle"
		/>
	</div>
</template>
