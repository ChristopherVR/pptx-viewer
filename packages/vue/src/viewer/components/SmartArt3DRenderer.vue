<script setup lang="ts">
/**
 * SmartArt3DRenderer - Vue Three.js SmartArt renderer.
 *
 * Builds the pure 3D model from the shared layout engine (no `three` import),
 * then lazily imports the vanilla scene runtime from
 * `pptx-viewer-shared/smartart-3d` and mounts it on a canvas. `three` is an
 * optional peer dependency: when it is missing, the diagram has no geometry, or
 * the scene errors, the component transparently falls back to the SVG
 * `SmartArtRenderer`.
 */
import type {
	PptxElement,
	PptxSmartArtChrome,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { buildSmartArt3DModel, computeSmartArtLayout } from 'pptx-viewer-shared';
import type { SmartArt3DModel } from 'pptx-viewer-shared';
import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import SmartArtRenderer from './SmartArtRenderer.vue';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

const smartArtData = computed(() =>
	props.element.type === 'smartArt' ? props.element.smartArtData : undefined,
);

const palette = computed<string[]>(() => {
	const data = smartArtData.value;
	const ctFills = data?.colorTransform?.fillColors;
	if (ctFills && ctFills.length > 0) {
		return ctFills;
	}
	return PALETTES[data?.colorScheme ?? 'colorful1'] ?? PALETTES.colorful1;
});

const style = computed<SmartArtStyle>(() => smartArtData.value?.style ?? 'flat');
const chrome = computed<PptxSmartArtChrome | undefined>(() => smartArtData.value?.chrome);

const model = computed<SmartArt3DModel | null>(() => {
	const data = smartArtData.value;
	if (!data || data.nodes.length === 0) {
		return null;
	}
	const layout = computeSmartArtLayout(
		data.nodes,
		{ width: props.element.width, height: props.element.height },
		palette.value,
		style.value,
		props.element.id,
		data.resolvedLayoutType,
		data.layout,
	);
	return buildSmartArt3DModel(layout, { background: chrome.value?.backgroundColor });
});

/** `true` once we know the 3D scene cannot run; render the SVG fallback. */
const useFallback = ref(true);
const canvasRef = ref<HTMLCanvasElement | null>(null);
let handle: SmartArt3DHandle | null = null;

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

async function mountScene(): Promise<void> {
	const m = model.value;
	if (!m || m.meshes.length === 0) {
		useFallback.value = true;
		return;
	}
	try {
		const { mountSmartArt3D } = await import('pptx-viewer-shared/smartart-3d');
		useFallback.value = false;
		// Wait for the canvas (v-else branch) to render now that fallback is off.
		await Promise.resolve();
		const canvas = canvasRef.value;
		if (!canvas) {
			useFallback.value = true;
			return;
		}
		handle = mountSmartArt3D(canvas, m, props.element.width, props.element.height, {});
	} catch {
		useFallback.value = true;
	}
}

onMounted(mountScene);

watch(
	() => [props.element.width, props.element.height] as const,
	([w, h]) => handle?.resize(w, h),
);

onBeforeUnmount(() => {
	handle?.dispose();
	handle = null;
});
</script>

<template>
	<SmartArtRenderer
		v-if="useFallback"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>
	<div
		v-else
		class="pptx-vue-element pptx-vue-smartart-3d"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<canvas ref="canvasRef" class="pptx-vue-smartart-3d-canvas" />
	</div>
</template>

<style scoped>
.pptx-vue-smartart-3d-canvas {
	width: 100%;
	height: 100%;
	display: block;
}
</style>
