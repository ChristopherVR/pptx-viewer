<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

/**
 * ChartEditOverlays: the floating HTML overlays for direct on-canvas chart
 * editing: a value badge shown during a data-point drag, and the inline title
 * editor opened by double-clicking the chart title (Enter commits, Escape
 * cancels, blur commits). Purely presentational; all state lives in
 * `useChartCanvasInteraction`.
 */
const props = defineProps<{
	/** Formatted value for the mid-drag badge, or null when not dragging. */
	dragLabel: string | null;
	/** Inline title editor draft; null while the editor is closed. */
	titleDraft: string | null;
}>();

const emit = defineEmits<{
	'title-input': [value: string];
	'title-commit': [];
	'title-cancel': [];
}>();

const inputEl = ref<HTMLInputElement | null>(null);

// Focus the input when the title editor opens: the dblclick that opened it
// landed on the SVG title, so the browser gives the input no focus of its own.
watch(
	() => props.titleDraft !== null,
	async (open) => {
		if (open) {
			await nextTick();
			inputEl.value?.focus();
		}
	},
);

function onInput(event: Event): void {
	emit('title-input', (event.target as HTMLInputElement).value);
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		emit('title-commit');
	} else if (event.key === 'Escape') {
		emit('title-cancel');
	}
	event.stopPropagation();
}
</script>

<template>
	<div v-if="dragLabel !== null" class="pptx-vue-chart-drag-badge">{{ dragLabel }}</div>
	<input
		v-if="titleDraft !== null"
		ref="inputEl"
		type="text"
		class="pptx-vue-chart-title-input"
		:value="titleDraft"
		@input="onInput"
		@pointerdown.stop
		@dblclick.stop
		@keydown="onKeydown"
		@blur="emit('title-commit')"
	/>
</template>

<style scoped>
.pptx-vue-chart-drag-badge {
	position: absolute;
	top: 4px;
	right: 4px;
	z-index: 10;
	pointer-events: none;
	border-radius: 4px;
	background: rgba(59, 130, 246, 0.9);
	color: #ffffff;
	padding: 2px 6px;
	font-size: 10px;
	font-weight: 500;
}

.pptx-vue-chart-title-input {
	position: absolute;
	left: 50%;
	top: 2px;
	transform: translateX(-50%);
	z-index: 10;
	width: 60%;
	pointer-events: auto;
	text-align: center;
	font-size: 11px;
	padding: 2px 4px;
	border: 1px solid #cbd5e1;
	border-radius: 4px;
	background: #ffffff;
	color: #0f172a;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
}
</style>
