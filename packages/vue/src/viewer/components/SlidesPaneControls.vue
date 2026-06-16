<script setup lang="ts">
/**
 * SlidesPaneControls — compact button row for slide-level editing.
 *
 * Renders Add / Duplicate / Delete actions and emits the corresponding
 * events. The Delete button is disabled (and `delete` suppressed) when
 * `canDelete` is false — i.e. when removing the last remaining slide
 * would leave the deck empty. Purely presentational: all state lives in
 * the parent, which wires these events to `useSlideOperations`.
 */
defineProps<{
	/** When false, deletion is disabled (only one slide remains). */
	canDelete: boolean;
}>();

const emit = defineEmits<{
	add: [];
	duplicate: [];
	delete: [];
}>();
</script>

<template>
	<div
		class="pptx-vue-slides-controls flex items-center gap-1 border-t border-border bg-card p-1.5"
		role="toolbar"
		aria-label="Slide actions"
	>
		<button
			type="button"
			class="pptx-vue-slides-controls__btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-border bg-secondary px-2 py-1.5 text-xs leading-none text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45"
			title="Add slide"
			aria-label="Add slide"
			@click="emit('add')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
				<path
					d="M8 3v10M3 8h10"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
				/>
			</svg>
			<span class="pptx-vue-slides-controls__label whitespace-nowrap">Add</span>
		</button>

		<button
			type="button"
			class="pptx-vue-slides-controls__btn inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-border bg-secondary px-2 py-1.5 text-xs leading-none text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45"
			title="Duplicate slide"
			aria-label="Duplicate slide"
			@click="emit('duplicate')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
				<rect
					x="5"
					y="5"
					width="8"
					height="8"
					rx="1.2"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
				/>
				<path
					d="M3 11V4a1 1 0 0 1 1-1h7"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/>
			</svg>
			<span class="pptx-vue-slides-controls__label whitespace-nowrap">Duplicate</span>
		</button>

		<button
			type="button"
			class="pptx-vue-slides-controls__btn pptx-vue-slides-controls__btn--danger inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-border bg-secondary px-2 py-1.5 text-xs leading-none text-foreground transition-colors hover:border-destructive hover:bg-muted hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45"
			title="Delete slide"
			aria-label="Delete slide"
			:disabled="!canDelete"
			@click="canDelete && emit('delete')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
				<path
					d="M3 4h10M6.5 4V2.8A.8.8 0 0 1 7.3 2h1.4a.8.8 0 0 1 .8.8V4M5 4l.6 8.2a1 1 0 0 0 1 .8h2.8a1 1 0 0 0 1-.8L12 4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span class="pptx-vue-slides-controls__label whitespace-nowrap">Delete</span>
		</button>
	</div>
</template>
