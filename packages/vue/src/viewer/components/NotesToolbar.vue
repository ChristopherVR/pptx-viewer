<script setup lang="ts">
import type {
	NotesInlineCommand,
	NotesParagraphCommand,
	NotesToolbarRequestEvent,
	NotesToolbarViewState,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * NotesToolbar: thin adapter around the shared `pptx-ui-notes-toolbar` element.
 *
 * The element owns the buttons, order, icons, roving focus, enabled state and
 * the hyperlink popover. This component maps panel state onto it and re-emits
 * its typed intents; the parent `NotesPanel` runs them through the shared notes
 * helpers (editor, selection edits, print and history stay native).
 */
const props = defineProps<{
	isRichEnabled: boolean;
}>();

const emit = defineEmits<{
	inline: [command: NotesInlineCommand];
	paragraph: [command: NotesParagraphCommand];
	insertLink: [url: string, displayText: string];
	print: [];
	toggleRich: [];
}>();

const { t } = useI18n();

const state = computed<NotesToolbarViewState>(() => ({
	rich: props.isRichEnabled,
	canFormat: props.isRichEnabled,
	showPrint: true,
	translate: t,
}));

function request(event: Event): void {
	const intent = (event as NotesToolbarRequestEvent).detail;
	switch (intent.kind) {
		case 'inline':
			emit('inline', intent.command);
			break;
		case 'paragraph':
			emit('paragraph', intent.command);
			break;
		case 'link':
			emit('insertLink', intent.url, intent.text);
			break;
		case 'print':
			emit('print');
			break;
		case 'toggle-rich':
			emit('toggleRich');
	}
}
</script>

<template>
	<pptx-ui-notes-toolbar
		class="pptx-vue-notes-toolbar"
		:state.prop="state"
		@notes-request="request"
	></pptx-ui-notes-toolbar>
</template>
