<script setup lang="ts">
/**
 * Editable paragraph list for `OleEditorDialog`'s "document" content tab.
 * Vue port of React's `OleDocumentEditor` (`OleEditorDialogTabs.tsx`).
 */
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	paragraphs: string[] | undefined;
}>();

const emit = defineEmits<{
	(e: 'edit', index: number, text: string): void;
}>();

const { t } = useI18n();

function onBlur(index: number, original: string, event: Event): void {
	const value = (event.target as HTMLTextAreaElement).value;
	if (value !== original) {
		emit('edit', index, value);
	}
}
</script>

<template>
	<p
		v-if="!props.paragraphs || props.paragraphs.length === 0"
		class="text-xs text-muted-foreground"
	>
		{{ t('pptx.ole.editDialog.emptyDocument') }}
	</p>
	<div v-else class="space-y-2">
		<textarea
			v-for="(paragraph, index) in props.paragraphs"
			:key="index"
			:value="paragraph"
			rows="2"
			class="w-full resize-y rounded border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
			@blur="onBlur(index, paragraph, $event)"
		/>
	</div>
</template>
