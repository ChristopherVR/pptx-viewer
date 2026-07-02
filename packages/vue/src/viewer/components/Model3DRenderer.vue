<script setup lang="ts">
import type { Model3DPptxElement, PptxElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getContainerStyle } from '../composables/element-style';
import { useModel3dScene } from '../composables/useModel3dScene';

/**
 * Model3DRenderer - Vue port of the React `Model3DRenderer` / `PosterFallback`
 * (in `Model3DRenderer.tsx`).
 *
 * When the element carries a 3D model (`modelData`) and the optional `three`
 * peer dependency is installed, this mounts the shared, framework-agnostic
 * vanilla-three controller (`mountModel3D` from `pptx-viewer-shared`) into a
 * container div for interactive rotate/zoom. The blob-URL lifecycle and
 * three.js availability are handled by {@link useModel3dScene}; this SFC stays
 * thin presentation.
 *
 * It falls back to the poster/preview image (`posterImage`, then `imageData`)
 * when there is no model data or three.js is unavailable, drawing a labelled
 * "3D model" placeholder when no poster exists - exactly like React.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const { t } = useI18n();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const model = computed<Model3DPptxElement | undefined>(() =>
	props.element.type === 'model3d' ? props.element : undefined,
);

/** Poster image preferred over the raster `imageData` fallback. */
const posterSrc = computed<string | undefined>(() => {
	const el = model.value;
	if (!el) {
		return undefined;
	}
	return el.posterImage ?? el.imageData;
});

// Interactive scene wiring. No presentation-mode prop reaches this component,
// so orbit controls default on (interactive viewing); this matches React's
// non-presentation default and avoids editing the root viewer / dispatcher.
const sceneContainer = ref<HTMLElement | null>(null);
const sceneWidth = computed(() => model.value?.width ?? 0);
const sceneHeight = computed(() => model.value?.height ?? 0);
const interactive = ref(true);

const { mounted } = useModel3dScene({
	container: sceneContainer,
	element: model,
	width: sceneWidth,
	height: sceneHeight,
	interactive,
});

/** Show the poster whenever an interactive scene is not mounted. */
const showPoster = computed(() => !mounted.value);
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-model3d"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<!--
			Always present so the scene can mount into it (v-show, not v-if, keeps
			the ref attached). Hidden while the poster fallback is showing.
		-->
		<div v-show="mounted" ref="sceneContainer" class="pptx-vue-model3d-scene" />
		<template v-if="showPoster">
			<img
				v-if="posterSrc"
				:src="posterSrc"
				:alt="t('pptx.model3d.label')"
				class="pptx-vue-model3d-poster"
				draggable="false"
			/>
			<div v-else class="pptx-vue-model3d-placeholder">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="pptx-vue-model3d-icon"
				>
					<path
						d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
					/>
					<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
					<line x1="12" y1="22.08" x2="12" y2="12" />
				</svg>
				<span>{{ t('pptx.model3d.label') }}</span>
			</div>
		</template>
	</div>
</template>

<style scoped>
.pptx-vue-model3d-scene {
	width: 100%;
	height: 100%;
	will-change: transform;
}

.pptx-vue-model3d-poster {
	width: 100%;
	height: 100%;
	object-fit: contain;
	pointer-events: none;
	user-select: none;
	display: block;
}

.pptx-vue-model3d-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	color: #9ca3af;
	background-color: #f9fafb;
	border: 1px dashed #e5e7eb;
	border-radius: 4px;
	box-sizing: border-box;
}

.pptx-vue-model3d-icon {
	margin-bottom: 4px;
	color: #d1d5db;
}
</style>
