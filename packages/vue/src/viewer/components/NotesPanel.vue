<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import NotesToolbar from './NotesToolbar.vue';
import { useNotesEditor } from './useNotesEditor';

/**
 * NotesPanel - collapsible speaker-notes panel for the Vue editor.
 *
 * Renders below the slide canvas and shows/edits the current slide's speaker
 * notes. Reads the real core fields `PptxSlide.notes` (plain string) and
 * `PptxSlide.notesSegments` (rich runs, when the deck was loaded from a .pptx).
 * The host writes the edited text back to the slide via a history-aware
 * reassignment when `update` is emitted.
 *
 * Rich vs plain
 * -------------
 * The default surface is a contentEditable RICH editor (bold/italic/underline/
 * strikethrough, bullet/numbered lists, indent, hyperlinks), mirroring the
 * React viewer. On a mobile viewport the editor defaults to a plain `<textarea>`
 * so the on-screen keyboard and caret behave (the documented mobile rationale);
 * the toolbar's rich/plain toggle flips between the two on any device. All
 * framework-agnostic logic lives in `pptx-viewer-shared`; this SFC is the view
 * layer and `useNotesEditor` is the thin reactive wiring.
 *
 * Touch / focus correctness
 * -------------------------
 * Both surfaces are UNCONTROLLED: their content is seeded imperatively (once per
 * slide, keyed by slide id) and never re-bound while the user types. Rich edits
 * are debounced; plain edits commit on `change` / `blur`. This keeps the host's
 * per-keystroke history-aware reassignment from remounting the field mid-typing,
 * which on mobile would dismiss the keyboard and jump the caret.
 *
 * Props : `{ slide: PptxSlide | undefined }`
 * Emits : `update: [notes: string]` - the new plain-text notes.
 */
const props = defineProps<{
	slide: PptxSlide | undefined;
}>();

const emit = defineEmits<{
	update: [notes: string];
}>();

const { t } = useI18n();

const collapsed = ref(false);

const hasSlide = computed<boolean>(() => props.slide !== undefined);

const {
	richEditorRef,
	textareaRef,
	isRichEnabled,
	showLinkPopover,
	savedSelectionText,
	onRichInput,
	inlineCommand,
	paragraphCommand,
	onRichKeydown,
	onEditorClick,
	openLinkPopover,
	insertLink,
	closeLinkPopover,
	onPlainCommit,
	toggleRich,
	printNotes,
} = useNotesEditor(
	() => props.slide,
	(notes) => emit('update', notes),
);

/**
 * Show the rich surface only when a slide is selected; with no slide we fall
 * back to the disabled plain textarea (its "No slide selected" placeholder).
 */
const showRich = computed<boolean>(() => hasSlide.value && isRichEnabled.value);

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
			<span class="pptx-vue-notes-title select-none">{{ t('pptx.presenter.speakerNotes') }}</span>
			<span class="pptx-vue-notes-chevron text-xs text-muted-foreground" aria-hidden="true">{{
				collapsed ? '▸' : '▾'
			}}</span>
		</button>

		<div v-show="!collapsed" id="slide-notes-content" class="pptx-vue-notes-body px-3 pb-3">
			<NotesToolbar
				v-if="hasSlide"
				:is-rich-enabled="isRichEnabled"
				:show-link-popover="showLinkPopover"
				:saved-selection-text="savedSelectionText"
				@inline="inlineCommand"
				@toggle-bullet="paragraphCommand('bullet')"
				@toggle-numbered="paragraphCommand('numbered')"
				@indent="paragraphCommand('indent')"
				@outdent="paragraphCommand('outdent')"
				@link-button-click="openLinkPopover"
				@insert-link="insertLink"
				@close-link-popover="closeLinkPopover"
				@print="printNotes"
				@toggle-rich="toggleRich"
			/>

			<!-- Rich contentEditable surface (desktop default). Seeded imperatively
			     via innerHTML built by the shared sanitising serialiser. -->
			<div
				v-show="showRich"
				ref="richEditorRef"
				:contenteditable="hasSlide"
				role="textbox"
				aria-multiline="true"
				:aria-label="t('pptx.presenter.speakerNotes')"
				class="pptx-vue-notes-rich box-border min-h-20 w-full resize-y overflow-auto rounded-md border border-border/50 bg-muted/60 p-2 text-[0.8125rem] leading-relaxed text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
				@input="onRichInput"
				@keydown="onRichKeydown"
				@blur="onRichInput"
				@click="onEditorClick"
			/>

			<!-- Plain textarea fallback (mobile default / toggle / no slide). -->
			<textarea
				v-show="!showRich"
				ref="textareaRef"
				name="slide-notes"
				class="pptx-vue-notes-textarea box-border min-h-20 w-full resize-y rounded-md border border-border/50 bg-muted/60 p-2 text-[0.8125rem] leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
				:disabled="!hasSlide"
				:placeholder="hasSlide ? t('pptx.notes.addSpeakerNotes') : t('pptx.notes.noSlide')"
				:aria-label="t('pptx.presenter.speakerNotes')"
				spellcheck="true"
				@change="onPlainCommit"
				@blur="onPlainCommit"
			/>
		</div>
	</section>
</template>
