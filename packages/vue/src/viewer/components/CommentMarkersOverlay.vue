<script setup lang="ts">
import type { PptxComment } from 'pptx-viewer-core';
import { buildCommentMarkers, COMMENT_MARKER_SIZE } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';

/**
 * CommentMarkersOverlay: numbered comment marker dots drawn over the slide
 * canvas. Vue port of the React `canvas/CommentMarkersOverlay.tsx`. The
 * descriptors (position clamped to the slide or a 4-column grid fallback,
 * 1-based numbering, and the `"<author>: <text>"` tooltip) come from the
 * shared `buildCommentMarkers`, so markers match every other binding.
 */
const props = defineProps<{
	comments: PptxComment[];
	canvasSize: CanvasSize;
}>();

const emit = defineEmits<{
	'marker-click': [commentId: string];
}>();

const { t } = useI18n();

const half = COMMENT_MARKER_SIZE / 2;

const markers = computed(() =>
	buildCommentMarkers(
		props.comments,
		props.canvasSize.width,
		props.canvasSize.height,
		t('pptx.comments.unknownAuthor'),
	),
);
</script>

<template>
	<div class="pointer-events-none absolute inset-0 z-[45]">
		<button
			v-for="marker in markers"
			:key="marker.commentId"
			type="button"
			class="pptx-vue-comment-marker pointer-events-auto absolute flex cursor-pointer items-center justify-center rounded-full border-2 border-white text-[10px] font-bold leading-none text-white shadow"
			:style="{
				left: `${marker.x - half}px`,
				top: `${marker.y - half}px`,
				width: `${COMMENT_MARKER_SIZE}px`,
				height: `${COMMENT_MARKER_SIZE}px`,
				backgroundColor: 'rgba(255, 165, 0, 0.9)',
			}"
			:title="marker.title"
			@click.stop="emit('marker-click', marker.commentId)"
		>
			{{ marker.label }}
		</button>
	</div>
</template>
