<script setup lang="ts">
import type { Model3DPptxElement, PptxElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';

/**
 * Model3DRenderer - Vue port of the React `Model3DRenderer` / `PosterFallback`
 * (in `Model3DRenderer.tsx`), poster-only subset.
 *
 * Interactive 3D rendering (three.js) is intentionally OUT OF SCOPE for the Vue
 * port; see PORTING.md. This component always renders the poster/preview image
 * (`posterImage`, falling back to `imageData`); when neither exists it draws a
 * labelled "3D model" placeholder, exactly like the React poster fallback.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

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
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-model3d"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<img
			v-if="posterSrc"
			:src="posterSrc"
			alt="3D Model"
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
			<span>3D Model</span>
		</div>
	</div>
</template>

<style scoped>
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
