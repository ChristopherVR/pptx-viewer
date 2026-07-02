<script setup lang="ts">
import type { PptxComment } from 'pptx-viewer-core';
import { getCommentMarkerPosition } from 'pptx-viewer-shared';
import { computed } from 'vue';

import type { CanvasSize } from '../types';

/**
 * CommentMarkersOverlay: numbered comment marker dots drawn over the slide
 * canvas. Vue port of the React `canvas/CommentMarkersOverlay.tsx`. Positions
 * come from the shared `getCommentMarkerPosition` (explicit x/y clamped to the
 * slide, else a 4-column grid fallback), so markers match React/Angular.
 */
const props = defineProps<{
	comments: PptxComment[];
	canvasSize: CanvasSize;
}>();

const emit = defineEmits<{
	'marker-click': [commentId: string];
}>();

const markers = computed(() =>
	props.comments.map((comment, index) => ({
		comment,
		index,
		pos: getCommentMarkerPosition(comment, index, props.canvasSize.width, props.canvasSize.height),
	})),
);
</script>

<template>
	<div class="pointer-events-none absolute inset-0 z-[45]">
		<button
			v-for="{ comment, index, pos } in markers"
			:key="comment.id"
			type="button"
			class="pptx-vue-comment-marker pointer-events-auto absolute flex cursor-pointer items-center justify-center rounded-full border-2 border-white text-[10px] font-bold leading-none text-white shadow"
			:style="{
				left: `${pos.x - 10}px`,
				top: `${pos.y - 10}px`,
				width: '20px',
				height: '20px',
				backgroundColor: 'rgba(255, 165, 0, 0.9)',
			}"
			:title="`${comment.author ?? 'Comment'}: ${comment.text}`"
			@click.stop="emit('marker-click', comment.id)"
		>
			{{ index + 1 }}
		</button>
	</div>
</template>
