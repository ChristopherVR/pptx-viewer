<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';

/**
 * NotesPanel — collapsible speaker-notes panel for the Vue editor.
 *
 * Renders below the slide canvas and shows/edits the current slide's speaker
 * notes. Reads the real core field `PptxSlide.notes` (a plain string populated
 * by `PptxSlideLoaderService` during parse and preserved through
 * `useLoadContent`). The host is responsible for writing the edited text back
 * to the slide via a history-aware reassignment when `update` is emitted.
 *
 * Props : `{ slide: PptxSlide | undefined }`
 * Emits : `update: [notes: string]` — the new notes text from the textarea.
 */
const props = defineProps<{
	slide: PptxSlide | undefined;
}>();

const emit = defineEmits<{
	update: [notes: string];
}>();

const collapsed = ref(false);

/** Local mirror of the textarea so typing is responsive even before the host commits. */
const draft = ref<string>(props.slide?.notes ?? '');

// Re-sync the draft whenever the active slide (or its committed notes) changes,
// e.g. navigating between slides or a history undo/redo replacing the slide.
watch(
	() => [props.slide?.id, props.slide?.notes] as const,
	() => {
		draft.value = props.slide?.notes ?? '';
	},
);

const hasSlide = computed<boolean>(() => props.slide !== undefined);

function onInput(event: Event): void {
	const target = event.target as HTMLTextAreaElement;
	draft.value = target.value;
	emit('update', target.value);
}

function toggle(): void {
	collapsed.value = !collapsed.value;
}
</script>

<template>
	<section class="pptx-vue-notes-panel" :data-collapsed="collapsed">
		<button type="button" class="pptx-vue-notes-header" :aria-expanded="!collapsed" @click="toggle">
			<span class="pptx-vue-notes-title">Speaker notes</span>
			<span class="pptx-vue-notes-chevron" aria-hidden="true">{{ collapsed ? '▸' : '▾' }}</span>
		</button>

		<div v-show="!collapsed" class="pptx-vue-notes-body">
			<textarea
				class="pptx-vue-notes-textarea"
				:value="draft"
				:disabled="!hasSlide"
				:placeholder="hasSlide ? 'Add speaker notes…' : 'No slide selected'"
				aria-label="Speaker notes"
				spellcheck="true"
				@input="onInput"
			/>
		</div>
	</section>
</template>

<style scoped>
.pptx-vue-notes-panel {
	display: flex;
	flex-direction: column;
	border-top: 1px solid rgba(0, 0, 0, 0.12);
	background: #fafafa;
	font-family: inherit;
}

.pptx-vue-notes-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding: 0.5rem 0.75rem;
	border: none;
	background: transparent;
	cursor: pointer;
	font-size: 0.8125rem;
	font-weight: 600;
	color: #333;
	text-align: left;
}

.pptx-vue-notes-header:hover {
	background: rgba(0, 0, 0, 0.04);
}

.pptx-vue-notes-title {
	user-select: none;
}

.pptx-vue-notes-chevron {
	font-size: 0.75rem;
	color: #666;
}

.pptx-vue-notes-body {
	padding: 0 0.75rem 0.75rem;
}

.pptx-vue-notes-textarea {
	width: 100%;
	min-height: 5rem;
	resize: vertical;
	padding: 0.5rem;
	border: 1px solid rgba(0, 0, 0, 0.18);
	border-radius: 4px;
	background: #fff;
	font: inherit;
	font-size: 0.8125rem;
	line-height: 1.4;
	color: #222;
	box-sizing: border-box;
}

.pptx-vue-notes-textarea:disabled {
	background: #f0f0f0;
	color: #999;
	cursor: not-allowed;
}

.pptx-vue-notes-textarea:focus {
	outline: 2px solid #2563eb;
	outline-offset: -1px;
}
</style>
