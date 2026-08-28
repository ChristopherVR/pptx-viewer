<script setup lang="ts">
import { useI18n } from 'vue-i18n';

/**
 * Chart3DLoading - lightweight spinner shown by every interactive 3D chart
 * renderer (bar3D/line3D/area3D/pie3D/surface) while `three` is still being
 * probed or the scene is lazy-loading.
 *
 * Standing in for the SVG fallback during that window used to make every 3D
 * chart flash its flat 2D rendering for a moment before the WebGL scene
 * swapped in. Reuses the same `.pptx-vue-spinner` class the top-level
 * viewer's own loading state uses (`PowerPointViewer.vue`), so the visual
 * matches instead of introducing a second spinner style.
 */
defineProps<{
	width: number;
	height: number;
}>();

const { t } = useI18n();
</script>

<template>
	<div
		class="pptx-vue-chart3d-loading"
		role="status"
		aria-live="polite"
		:style="{ width: `${width}px`, height: `${height}px` }"
	>
		<div class="pptx-vue-spinner" aria-hidden="true" />
		<span>{{ t('pptx.viewer.loading') }}</span>
	</div>
</template>

<style scoped>
.pptx-vue-chart3d-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	color: #6b7280;
	font-size: 12px;
}
</style>
