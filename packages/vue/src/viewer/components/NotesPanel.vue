<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, onMounted, ref, watch } from 'vue';

/**
 * NotesPanel - collapsible speaker-notes panel for the Vue editor.
 *
 * Renders below the slide canvas and shows/edits the current slide's speaker
 * notes. Reads the real core field `PptxSlide.notes` (a plain string populated
 * by `PptxSlideLoaderService` during parse and preserved through
 * `useLoadContent`). The host is responsible for writing the edited text back
 * to the slide via a history-aware reassignment when `update` is emitted.
 *
 * Touch / focus correctness
 * -------------------------
 * The textarea is UNCONTROLLED: its value is seeded imperatively via a template
 * ref exactly once per slide and never re-bound (`:value`) while the user types.
 * If we re-bound `:value` to a ref that the host's history-aware reassignment
 * mutated on every keystroke, the on-screen keyboard could dismiss and the
 * caret could jump, so instead the DOM owns the text during an edit and we
 * only commit on `change`/`blur` (history entry per edit, not per keystroke).
 *
 * Props : `{ slide: PptxSlide | undefined }`
 * Emits : `update: [notes: string]` - the new notes text from the textarea.
 */
const props = defineProps<{
	slide: PptxSlide | undefined;
}>();

const emit = defineEmits<{
	update: [notes: string];
}>();

const collapsed = ref(false);

/** The textarea element: the source of truth for in-progress edits. */
const textareaRef = ref<HTMLTextAreaElement | null>(null);

/** Write the committed notes for the current slide into the uncontrolled field. */
function seedTextarea(): void {
	const el = textareaRef.value;
	if (el) {
		el.value = props.slide?.notes ?? '';
	}
}

// Seed once on mount with the initial slide notes.
onMounted(seedTextarea);

/**
 * Re-seed the textarea whenever the active slide changes, e.g. navigating
 * between slides or a history undo/redo replacing the slide. We key on the
 * slide id so re-seeding only happens on a genuine slide swap, never on each
 * keystroke (which would steal focus / reset the caret on touch).
 */
watch(() => props.slide?.id, seedTextarea);

const hasSlide = computed<boolean>(() => props.slide !== undefined);

/**
 * Commit the notes text. Fired on `change` (blur / Enter-out) rather than every
 * keystroke so the host's history-aware reassignment doesn't remount this field
 * mid-typing, which on mobile dismisses the on-screen keyboard.
 */
function onCommit(event: Event): void {
	const target = event.target as HTMLTextAreaElement;
	emit('update', target.value);
}

function toggle(): void {
	collapsed.value = !collapsed.value;
}
</script>

<template>
	<section
		class="pptx-vue-notes-panel flex flex-col border-t border-border/60 bg-background"
		:data-collapsed="collapsed"
	>
		<button
			type="button"
			class="pptx-vue-notes-header flex w-full items-center justify-between px-3 py-2 text-left text-[0.8125rem] font-semibold text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
			:aria-expanded="!collapsed"
			@click="toggle"
		>
			<span class="pptx-vue-notes-title select-none">Speaker notes</span>
			<span class="pptx-vue-notes-chevron text-xs text-muted-foreground" aria-hidden="true">{{
				collapsed ? '▸' : '▾'
			}}</span>
		</button>

		<div v-show="!collapsed" id="slide-notes-content" class="pptx-vue-notes-body px-3 pb-3">
			<textarea
				ref="textareaRef"
				name="slide-notes"
				class="pptx-vue-notes-textarea box-border min-h-20 w-full resize-y rounded-md border border-border/50 bg-muted/60 p-2 text-[0.8125rem] leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
				:disabled="!hasSlide"
				:placeholder="hasSlide ? 'Add speaker notes…' : 'No slide selected'"
				aria-label="Speaker notes"
				spellcheck="true"
				@change="onCommit"
				@blur="onCommit"
			/>
		</div>
	</section>
</template>
