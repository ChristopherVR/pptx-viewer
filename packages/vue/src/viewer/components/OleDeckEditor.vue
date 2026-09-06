<script setup lang="ts">
/**
 * Editable full text-element list for `OleEditorDialog`'s "deck" (nested
 * presentation) content tab: every slide, every text-bearing shape. Vue
 * port of React's `OleDeckEditor` (`OleEditorDialogTabs.tsx`).
 */
import type { OleNestedDeckSlideDetail, OleNestedDeckTextElement } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	slides: OleNestedDeckSlideDetail[] | undefined;
}>();

const emit = defineEmits<{
	(e: 'edit', slideIndex: number, elementId: string, text: string): void;
}>();

const { t } = useI18n();

function onBlur(slideIndex: number, element: OleNestedDeckTextElement, event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	if (value !== element.text) {
		emit('edit', slideIndex, element.elementId, value);
	}
}
</script>

<template>
	<p v-if="!props.slides || props.slides.length === 0" class="text-xs text-muted-foreground">
		{{ t('pptx.ole.editDialog.deckEmpty') }}
	</p>
	<div v-else class="space-y-3">
		<div v-for="slide in props.slides" :key="slide.index" class="space-y-1.5">
			<span class="text-xs font-medium text-muted-foreground">{{
				t('pptx.ole.editDialog.deckSlideLabel', { number: slide.index + 1 })
			}}</span>
			<p v-if="slide.elements.length === 0" class="text-xs italic text-muted-foreground">
				{{ t('pptx.ole.editDialog.deckEmpty') }}
			</p>
			<input
				v-for="element in slide.elements"
				:key="element.elementId"
				type="text"
				:value="element.text"
				class="w-full rounded border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
				@blur="onBlur(slide.index, element, $event)"
			/>
		</div>
	</div>
</template>
