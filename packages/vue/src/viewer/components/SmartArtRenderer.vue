<script setup lang="ts">
import type {
	PptxElement,
	PptxSmartArtChrome,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import type {
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtLayoutResult as ComputedLayout,
} from '../composables/smartart-layout';
import { computeSmartArtLayout } from '../composables/smartart-layout';

/**
 * SmartArtRenderer - Vue port of the React SmartArt renderer
 * (`viewer/utils/smartart*.tsx`).
 *
 * Data path: this component renders from the **pre-computed drawing shapes**
 * (`smartArtData.drawingShapes`) extracted by the core engine from
 * `ppt/diagrams/drawing*.xml`, mirroring React's `smartart-drawing.tsx`.
 * That is the path React prefers when drawing shapes are present, and it
 * avoids reimplementing the ~2800 LOC of layout math in the
 * `smartart-cycle/process/hierarchy/...` family.
 *
 * Fallbacks (mirroring `renderSmartArtElement`'s early returns):
 *  - No `smartArtData` or zero nodes → a small "SmartArt" placeholder.
 *  - Nodes present but no drawing shapes → a simple stacked block list of the
 *    node text (the common-case fallback; the full per-family layout renderers
 *    are out of scope per the porting brief).
 *
 * The whole graphic is wrapped in chrome (background / outline) when present.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

// ── Palette / style helpers (ported from smartart-helpers.tsx) ───────────────

const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};
const DEFAULT_PALETTE = PALETTES.colorful1;

function colour(index: number, palette: string[]): string {
	return palette[index % palette.length];
}

function styleShadow(style: SmartArtStyle): string | undefined {
	if (style === 'intense') {
		return 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))';
	}
	if (style === 'moderate') {
		return 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))';
	}
	return undefined;
}

function styleStroke(style: SmartArtStyle): number {
	if (style === 'intense') {
		return 2;
	}
	if (style === 'moderate') {
		return 1.5;
	}
	return 0;
}

function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}

// ── Resolved SmartArt data ───────────────────────────────────────────────────

const smartArtData = computed(() =>
	props.element.type === 'smartArt' ? props.element.smartArtData : undefined,
);

const nodes = computed<PptxSmartArtNode[]>(() => smartArtData.value?.nodes ?? []);

const palette = computed<string[]>(() => {
	const data = smartArtData.value;
	if (!data) {
		return DEFAULT_PALETTE;
	}
	const ctFills = data.colorTransform?.fillColors;
	if (ctFills && ctFills.length > 0) {
		return ctFills;
	}
	return PALETTES[data.colorScheme ?? 'colorful1'] ?? DEFAULT_PALETTE;
});

const style = computed<SmartArtStyle>(() => smartArtData.value?.style ?? 'flat');

const chrome = computed<PptxSmartArtChrome | undefined>(() => smartArtData.value?.chrome);

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const chromeStyle = computed<CSSProperties>(() => {
	const c = chrome.value;
	const s: CSSProperties = { width: '100%', height: '100%' };
	if (!c) {
		return s;
	}
	if (c.backgroundColor) {
		s.backgroundColor = c.backgroundColor;
	}
	if (c.outlineColor) {
		s.border = `${c.outlineWidth ?? 1}px solid ${c.outlineColor}`;
	}
	return s;
});

// ── Drawing-shape path (mirrors smartart-drawing.tsx) ────────────────────────

const drawingShapes = computed<PptxSmartArtDrawingShape[]>(
	() => smartArtData.value?.drawingShapes ?? [],
);

const hasDrawingShapes = computed(() => drawingShapes.value.length > 0);

interface RenderedShape {
	key: string;
	isEllipse: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	cx: number;
	cy: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	transform?: string;
	text?: string;
	textX: number;
	textY: number;
	fontColor: string;
	fontSize: number;
}

const drawingViewBox = computed(() => {
	const shapes = drawingShapes.value;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const s of shapes) {
		if (s.x < minX) {
			minX = s.x;
		}
		if (s.y < minY) {
			minY = s.y;
		}
		if (s.x + s.width > maxX) {
			maxX = s.x + s.width;
		}
		if (s.y + s.height > maxY) {
			maxY = s.y + s.height;
		}
	}
	if (!Number.isFinite(minX)) {
		minX = 0;
		minY = 0;
		maxX = 1;
		maxY = 1;
	}
	return {
		minX,
		minY,
		width: maxX - minX || 1,
		height: maxY - minY || 1,
	};
});

const renderedShapes = computed<RenderedShape[]>(() => {
	const shapes = drawingShapes.value;
	const { minX, minY } = drawingViewBox.value;
	const sw = styleStroke(style.value);
	const pal = palette.value;

	return shapes.map((shape, i): RenderedShape => {
		const fill = shape.fillColor ?? colour(i, pal);
		const relX = shape.x - minX;
		const relY = shape.y - minY;
		const isEllipse = shape.shapeType === 'ellipse';
		const rx = shape.shapeType === 'roundRect' ? Math.min(shape.width, shape.height) * 0.1 : 0;
		const cx = relX + shape.width / 2;
		const cy = relY + shape.height / 2;
		const stroke = shape.strokeColor ?? (sw > 0 ? 'rgba(255,255,255,0.3)' : 'none');
		const transform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

		return {
			key: `${props.element.id}-dsp-${shape.id}-${i}`,
			isEllipse,
			x: relX,
			y: relY,
			width: shape.width,
			height: shape.height,
			rx,
			cx,
			cy,
			fill,
			stroke,
			strokeWidth: shape.strokeWidth ?? sw,
			transform,
			text: shape.text ? truncate(shape.text, 30) : undefined,
			textX: cx,
			textY: cy,
			fontColor: shape.fontColor ?? 'white',
			fontSize: shape.fontSize ?? Math.max(8, Math.min(14, shape.height * 0.2)),
		};
	});
});

const shadowFilter = computed(() => styleShadow(style.value));

// ── SVG layout fallback (no drawing shapes) ──────────────────────────────────
//
// When drawing shapes are absent the component runs the pure-geometry layout
// engine from `smartart-layout.ts` to produce an SVG approximation.

const fallbackLayout = computed<ComputedLayout | undefined>(() => {
	if (hasDrawingShapes.value || nodes.value.length === 0) {
		return undefined;
	}
	const data = smartArtData.value;
	return computeSmartArtLayout(
		nodes.value,
		{ width: props.element.width, height: props.element.height },
		palette.value,
		style.value,
		props.element.id,
		data?.resolvedLayoutType,
		data?.layout,
	);
});

const isEmpty = computed(() => nodes.value.length === 0 && !hasDrawingShapes.value);
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-smartart"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<div class="pptx-vue-smartart-chrome" :style="chromeStyle">
			<!-- Empty / no-data placeholder -->
			<div v-if="isEmpty" class="pptx-vue-smartart-placeholder">SmartArt</div>

			<!-- Pre-computed drawing shapes (preferred path) -->
			<svg
				v-else-if="hasDrawingShapes"
				class="pptx-vue-smartart-svg"
				:viewBox="`0 0 ${drawingViewBox.width} ${drawingViewBox.height}`"
				preserveAspectRatio="xMidYMid meet"
			>
				<g
					v-for="shape in renderedShapes"
					:key="shape.key"
					:style="shadowFilter ? { filter: shadowFilter } : undefined"
				>
					<ellipse
						v-if="shape.isEllipse"
						:cx="shape.cx"
						:cy="shape.cy"
						:rx="shape.width / 2"
						:ry="shape.height / 2"
						:fill="shape.fill"
						:stroke="shape.stroke"
						:stroke-width="shape.strokeWidth"
						:transform="shape.transform"
					/>
					<rect
						v-else
						:x="shape.x"
						:y="shape.y"
						:width="shape.width"
						:height="shape.height"
						:rx="shape.rx"
						:fill="shape.fill"
						:stroke="shape.stroke"
						:stroke-width="shape.strokeWidth"
						:transform="shape.transform"
					/>
					<text
						v-if="shape.text"
						:x="shape.textX"
						:y="shape.textY"
						text-anchor="middle"
						dominant-baseline="central"
						:fill="shape.fontColor"
						:font-size="shape.fontSize"
					>
						{{ shape.text }}
					</text>
				</g>
			</svg>

			<!-- Fallback: SVG layout computed from node tree -->
			<svg
				v-else-if="fallbackLayout"
				class="pptx-vue-smartart-svg"
				:viewBox="fallbackLayout.viewBox"
				preserveAspectRatio="xMidYMid meet"
				:data-layout-family="fallbackLayout.family"
			>
				<!-- Connectors (render first so they appear behind nodes) -->
				<path
					v-for="conn in fallbackLayout.connectors"
					:key="conn.key"
					:d="conn.d"
					fill="none"
					stroke="#94a3b8"
					stroke-width="1.5"
					opacity="0.5"
				/>
				<!-- Rendered nodes -->
				<g
					v-for="node in fallbackLayout.nodes"
					:key="node.key"
					:style="fallbackLayout.shadowFilter ? { filter: fallbackLayout.shadowFilter } : undefined"
				>
					<!-- Circle nodes (cycle, radial, venn, target) -->
					<template v-if="node.kind === 'circle'">
						<circle
							:cx="(node as RenderedCircleNode).cx"
							:cy="(node as RenderedCircleNode).cy"
							:r="(node as RenderedCircleNode).r"
							:fill="node.fill"
							:stroke="node.stroke"
							:stroke-width="node.strokeWidth"
							:opacity="node.opacity"
						/>
						<text
							:x="(node as RenderedCircleNode).cx"
							:y="(node as RenderedCircleNode).cy"
							text-anchor="middle"
							dominant-baseline="central"
							fill="white"
							:font-size="node.fontSize"
						>
							{{ node.text }}
						</text>
					</template>
					<!-- Polygon nodes (process, pyramid, funnel) -->
					<template v-else-if="node.kind === 'polygon'">
						<polygon
							:points="(node as RenderedPolygonNode).points"
							:fill="node.fill"
							:stroke="node.stroke"
							:stroke-width="node.strokeWidth"
							:opacity="node.opacity"
						/>
						<text
							:x="(node as RenderedPolygonNode).textX"
							:y="(node as RenderedPolygonNode).textY"
							text-anchor="middle"
							dominant-baseline="central"
							fill="white"
							:font-size="node.fontSize"
						>
							{{ node.text }}
						</text>
					</template>
					<!-- Rect nodes (list, matrix, hierarchy) -->
					<template v-else>
						<rect
							:x="(node as RenderedRectNode).x"
							:y="(node as RenderedRectNode).y"
							:width="(node as RenderedRectNode).width"
							:height="(node as RenderedRectNode).height"
							:rx="(node as RenderedRectNode).rx"
							:fill="node.fill"
							:stroke="node.stroke"
							:stroke-width="node.strokeWidth"
							:opacity="node.opacity"
						/>
						<text
							:x="(node as RenderedRectNode).textX"
							:y="(node as RenderedRectNode).textY"
							text-anchor="middle"
							dominant-baseline="central"
							fill="white"
							:font-size="node.fontSize"
						>
							{{ node.text }}
						</text>
					</template>
				</g>
			</svg>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-smartart-chrome {
	box-sizing: border-box;
	overflow: hidden;
}

.pptx-vue-smartart-svg {
	width: 100%;
	height: 100%;
	pointer-events: none;
}

.pptx-vue-smartart-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.8);
	pointer-events: none;
}

.pptx-vue-smartart-list {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 4px;
	box-sizing: border-box;
	overflow: hidden;
}

.pptx-vue-smartart-block {
	flex: 1 1 0;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2px 6px;
	border-radius: 4px;
	color: #fff;
	font-size: 12px;
	text-align: center;
	overflow: hidden;
}
</style>
