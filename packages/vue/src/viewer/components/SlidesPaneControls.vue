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
	<div class="pptx-vue-slides-controls" role="toolbar" aria-label="Slide actions">
		<button
			type="button"
			class="pptx-vue-slides-controls__btn"
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
			<span class="pptx-vue-slides-controls__label">Add</span>
		</button>

		<button
			type="button"
			class="pptx-vue-slides-controls__btn"
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
			<span class="pptx-vue-slides-controls__label">Duplicate</span>
		</button>

		<button
			type="button"
			class="pptx-vue-slides-controls__btn pptx-vue-slides-controls__btn--danger"
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
			<span class="pptx-vue-slides-controls__label">Delete</span>
		</button>
	</div>
</template>

<style scoped>
.pptx-vue-slides-controls {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px;
	border-top: 1px solid rgba(0, 0, 0, 0.08);
	background: var(--pptx-vue-pane-bg, #fafafa);
}

.pptx-vue-slides-controls__btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	flex: 1 1 auto;
	justify-content: center;
	padding: 5px 8px;
	font-size: 12px;
	line-height: 1;
	color: var(--pptx-vue-text, #333);
	background: var(--pptx-vue-btn-bg, #fff);
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 4px;
	cursor: pointer;
	transition:
		background-color 0.12s ease,
		border-color 0.12s ease;
}

.pptx-vue-slides-controls__btn:hover:not(:disabled) {
	background: var(--pptx-vue-btn-hover-bg, #f0f0f0);
	border-color: rgba(0, 0, 0, 0.22);
}

.pptx-vue-slides-controls__btn:focus-visible {
	outline: 2px solid var(--pptx-vue-focus, #2563eb);
	outline-offset: 1px;
}

.pptx-vue-slides-controls__btn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

.pptx-vue-slides-controls__btn--danger:hover:not(:disabled) {
	color: var(--pptx-vue-danger, #c0392b);
	border-color: var(--pptx-vue-danger, #c0392b);
}

.pptx-vue-slides-controls__label {
	white-space: nowrap;
}
</style>
