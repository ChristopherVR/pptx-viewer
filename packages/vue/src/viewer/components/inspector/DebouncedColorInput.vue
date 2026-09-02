<script setup lang="ts">
import { ref, watch } from 'vue';

import { injectRecentColors } from '../../composables/recent-colors-context';

/**
 * DebouncedColorInput: a native colour picker that commits live as the user
 * drags through the swatch, keeping the canvas in sync while a local mirror
 * keeps the control responsive. Vue equivalent of React's DebouncedColorInput;
 * undo grouping is handled downstream in the editor history.
 *
 * Every caller wraps the same native `<input type="color">`, so the
 * "Recent colours" push (wave-4 B6) is wired here once, on the native
 * `change` event (the committed value, never the continuous `input` stream),
 * instead of every one of this component's callers repeating it.
 */
const props = defineProps<{
	value: string;
	disabled?: boolean;
	ariaLabel?: string;
}>();

const emit = defineEmits<{
	commit: [hex: string];
}>();

/** Local mirror so the swatch stays responsive during a drag. */
const local = ref<string>(props.value);
const recentColors = injectRecentColors();

// Re-sync when the selected element (external value) changes.
watch(
	() => props.value,
	(next) => {
		local.value = next;
	},
);

function onInput(event: Event): void {
	const next = (event.target as HTMLInputElement).value;
	local.value = next;
	emit('commit', next);
}

function onChange(event: Event): void {
	recentColors?.push((event.target as HTMLInputElement).value);
}
</script>

<template>
	<input
		type="color"
		class="pptx-vue-color-input h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
		:aria-label="ariaLabel ?? 'Color'"
		:disabled="disabled"
		:value="local"
		@input="onInput"
		@change="onChange"
	/>
</template>
