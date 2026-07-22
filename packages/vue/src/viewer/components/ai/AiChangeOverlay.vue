<script setup lang="ts">
/**
 * AiChangeOverlay: plays the "watch the AI edit land" animation. For each
 * element the assistant just changed on the visible slide it draws a ghost rect
 * that, on the next frame, flips from its `start` to `end` state so the browser
 * transitions between them: added elements fade+scale in, removed fade+scale
 * out, moved/resized glide old->new, all under a glow-pulse. Rendered INSIDE the
 * scaled slide stage, so the change bounds (slide CSS pixels) map 1:1.
 *
 * Purely presentational: the batch (with per-element from/to bounds + resolved
 * config) comes from the shared AiChangeAnimator via the panel controller. The
 * ghosts carry their own geometry, so no element lookup is needed. Vue
 * counterpart of React's AiChangeOverlay.
 */
import type { AiChangeBatch } from 'pptx-viewer-shared/ai';
import { aiChangeAnimationCss, changeGhostStyle } from 'pptx-viewer-shared/ai';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';

const props = defineProps<{
	batch: AiChangeBatch | null;
	activeSlideIndex: number;
}>();

const phase = ref<'start' | 'end'>('start');
let outer = 0;
let inner = 0;

function cancelFrames(): void {
	cancelAnimationFrame(outer);
	cancelAnimationFrame(inner);
}

// Restart on every new batch (keyed by nonce): paint the `start` state, then on
// the next frame flip to `end` so the CSS transition actually runs. Two frames:
// let the browser paint `start` before flipping, otherwise it snaps.
watch(
	() => props.batch?.nonce ?? null,
	() => {
		cancelFrames();
		if (!props.batch) {
			return;
		}
		phase.value = 'start';
		outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => {
				phase.value = 'end';
			});
		});
	},
	{ immediate: true },
);

// The keyframes/glow CSS is config-dependent, so inject it into <head> once per
// batch (Vue strips <style> tags from templates). Removed when the batch clears.
const STYLE_ID = 'pptx-ai-change-css';
function syncStyleTag(): void {
	if (typeof document === 'undefined') {
		return;
	}
	const existing = document.getElementById(STYLE_ID);
	if (!props.batch) {
		existing?.remove();
		return;
	}
	const el = (existing as HTMLStyleElement | null) ?? document.createElement('style');
	if (!existing) {
		el.id = STYLE_ID;
		el.setAttribute('data-export-ignore', 'true');
		document.head.appendChild(el);
	}
	el.textContent = aiChangeAnimationCss(props.batch.config);
}
watch(() => props.batch?.nonce ?? null, syncStyleTag, { immediate: true });

onBeforeUnmount(() => {
	cancelFrames();
	document.getElementById(STYLE_ID)?.remove();
});

interface Ghost {
	key: string;
	kind: string;
	elementId: string;
	style: CSSProperties;
}

const ghosts = computed<Ghost[]>(() => {
	const batch = props.batch;
	if (!batch) {
		return [];
	}
	const out: Ghost[] = [];
	for (const change of batch.changes) {
		if (change.slideIndex !== props.activeSlideIndex) {
			continue;
		}
		const s = changeGhostStyle(change, phase.value, batch.config);
		// The shared builder returns unitless px numbers (React auto-appends px);
		// Vue's :style object binding does not, so unitise the geometry here.
		out.push({
			key: `ai-change-${change.elementId}-${batch.nonce}`,
			kind: change.kind,
			elementId: change.elementId,
			style: {
				position: s.position,
				left: `${s.left}px`,
				top: `${s.top}px`,
				width: `${s.width}px`,
				height: `${s.height}px`,
				opacity: s.opacity,
				transform: s.transform,
				transition: s.transition,
				boxShadow: s.boxShadow,
				border: s.border,
				borderRadius: s.borderRadius,
				pointerEvents: s.pointerEvents,
				zIndex: s.zIndex,
			},
		});
	}
	return out;
});
</script>

<template>
	<div
		v-for="ghost in ghosts"
		:key="ghost.key"
		:data-testid="`ai-change-${ghost.elementId}`"
		:data-ai-change="ghost.kind"
		data-export-ignore="true"
		:style="ghost.style"
	/>
</template>
