<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { getNonVisualDescriptionFields } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * AccessibilityPanel: alt text / title editor for a plain shape, text box or
 * connector, at parity with React's `AccessibilityTextSection`.
 *
 * A picture's own alt text field lives in `ImagePanel`; this covers the
 * three element kinds that only started modelling `altText` / `title` once
 * core parsed `p:cNvPr/@descr` / `@title` on `p:sp` / `p:cxnSp` (see
 * `PptxNonVisualDescription`). `getNonVisualDescriptionFields` (shared)
 * decides which fields apply so this component stays a thin view.
 */
const props = defineProps<{
	element: PptxElement;
	canEdit?: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const fields = computed(() => getNonVisualDescriptionFields(props.element));

function onAltTextInput(event: Event): void {
	emit('update', { altText: (event.target as HTMLTextAreaElement).value } as Partial<PptxElement>);
}

function onTitleInput(event: Event): void {
	emit('update', { title: (event.target as HTMLInputElement).value } as Partial<PptxElement>);
}
</script>

<template>
	<div
		v-if="fields.showAltText || fields.showTitle"
		class="pptx-vue-accessibility-panel flex flex-col gap-2 text-[11px]"
		data-pptx-accessibility-text
	>
		<label v-if="fields.showAltText" class="flex flex-col gap-1">
			<span class="text-muted-foreground">{{ t('pptx.elementAccessibility.altText') }}</span>
			<textarea
				rows="2"
				:disabled="!props.canEdit"
				class="w-full bg-muted border border-border rounded px-1.5 py-1 resize-none text-[11px]"
				:value="fields.altText"
				:placeholder="t('pptx.elementAccessibility.altTextPlaceholder')"
				@input="onAltTextInput"
			></textarea>
		</label>

		<label v-if="fields.showTitle" class="flex flex-col gap-1">
			<span class="text-muted-foreground">{{ t('pptx.elementAccessibility.title') }}</span>
			<input
				type="text"
				:disabled="!props.canEdit"
				class="w-full bg-muted border border-border rounded px-1.5 py-1 text-[11px]"
				:value="fields.title"
				:placeholder="t('pptx.elementAccessibility.titlePlaceholder')"
				@input="onTitleInput"
			/>
		</label>
	</div>
</template>
