<script setup lang="ts">
/**
 * AiFocusHighlightOverlay: draws animated rings around the element(s) the AI
 * assistant is focused on, rendered INSIDE the (already-scaled) slide stage so
 * element canvas coordinates map 1:1. Two variants share the same overlay:
 *   - `pick`  : a persistent, subtle ring for an element the user handed to the
 *     assistant in pick mode (with a brief entry pulse).
 *   - `active`: a livelier pulsing ring for the element a running tool is
 *     touching right now ("the AI is looking at / working on this").
 *
 * Purely presentational: it reads element bounds from the active slide and the
 * highlight list computed by {@link useAiPanelController}. Only highlights on the
 * active slide are drawn. The colour-tween rule (below) fades slide-element
 * colour edits from old to new while the AI is active (the host toggles the
 * `data-pptx-ai-active` attribute on the canvas).
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { AiCanvasHighlight } from '../../composables/ai/useAiPanelController';

const props = defineProps<{
	highlights: AiCanvasHighlight[];
	/** Elements of the currently visible slide, for bounds lookup. */
	elements: PptxElement[];
	activeSlideIndex: number;
}>();

interface Ring {
	key: string;
	elementId: string;
	variant: 'pick' | 'active';
	style: CSSProperties;
}

const rings = computed<Ring[]>(() => {
	const byId = new Map(props.elements.map((el) => [el.id, el]));
	const out: Ring[] = [];
	for (const hl of props.highlights) {
		if (hl.slideIndex !== props.activeSlideIndex) {
			continue;
		}
		const el = byId.get(hl.elementId);
		if (!el) {
			continue;
		}
		const active = hl.variant === 'active';
		out.push({
			key: `ai-hl-${hl.variant}-${hl.elementId}`,
			elementId: hl.elementId,
			variant: hl.variant,
			style: {
				left: `${el.x - 3}px`,
				top: `${el.y - 3}px`,
				width: `${el.width + 6}px`,
				height: `${el.height + 6}px`,
				zIndex: 9998,
				border: active ? '2px solid rgba(59,130,246,0.9)' : '2px solid rgba(59,130,246,0.55)',
				animation: active
					? 'pptx-ai-ring-in 0.18s ease-out, pptx-ai-ring-pulse 1s ease-out infinite'
					: 'pptx-ai-ring-in 0.9s ease-out',
				boxShadow: active ? undefined : '0 0 10px 2px rgba(59,130,246,0.18)',
			},
		});
	}
	return out;
});
</script>

<template>
	<div
		v-for="ring in rings"
		:key="ring.key"
		:data-testid="`ai-focus-highlight-${ring.elementId}`"
		:data-ai-highlight="ring.variant"
		data-export-ignore="true"
		class="absolute pointer-events-none rounded-[3px]"
		:style="ring.style"
	/>
</template>

<style>
@keyframes pptx-ai-ring-pulse {
	0% {
		box-shadow:
			0 0 0 0 rgba(59, 130, 246, 0.55),
			0 0 0 0 rgba(59, 130, 246, 0.35);
	}
	70% {
		box-shadow:
			0 0 0 6px rgba(59, 130, 246, 0),
			0 0 14px 4px rgba(59, 130, 246, 0.28);
	}
	100% {
		box-shadow:
			0 0 0 0 rgba(59, 130, 246, 0),
			0 0 10px 2px rgba(59, 130, 246, 0.22);
	}
}
@keyframes pptx-ai-ring-in {
	0% {
		opacity: 0;
		transform: scale(1.04);
	}
	100% {
		opacity: 1;
		transform: scale(1);
	}
}
/* While the AI is active, tween colour changes on slide elements so an edit
   fades from its old value to the new one instead of snapping. */
[data-pptx-ai-active='true'] [data-element-id],
[data-pptx-ai-active='true'] [data-element-id] * {
	transition:
		color 0.5s ease,
		fill 0.5s ease,
		stroke 0.5s ease,
		background-color 0.5s ease,
		border-color 0.5s ease;
}
</style>
