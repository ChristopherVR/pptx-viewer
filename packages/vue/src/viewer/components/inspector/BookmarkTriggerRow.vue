<script setup lang="ts">
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import {
	bookmarkTriggerPatch,
	listMediaBookmarkOptions,
	selectedBookmarkOptionValue,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * The "On bookmark" trigger's bookmark picker: every (media element, bookmark)
 * pair on the slide, from shared's `listMediaBookmarkOptions`.
 */
const props = defineProps<{
	animation: PptxElementAnimation;
	elements: readonly PptxElement[];
}>();
const emit = defineEmits<{
	patch: [patch: Partial<PptxElementAnimation>];
}>();
const { t } = useI18n();

const options = computed(() => listMediaBookmarkOptions(props.elements));

function onChange(event: Event): void {
	const target = event.target as HTMLSelectElement | null;
	emit('patch', bookmarkTriggerPatch(target?.value ?? ''));
}
</script>

<template>
	<label
		>{{ t('pptx.animation.trigger.bookmarkLabel') }}
		<pptx-ui-select
			data-pptx-animation-bookmark-picker
			:aria-label="t('pptx.animation.trigger.bookmarkLabel')"
			:value="selectedBookmarkOptionValue(animation)"
			:disabled="options.length === 0 || undefined"
			@change="onChange"
		>
			<option value="">
				{{
					t(
						options.length === 0
							? 'pptx.animation.trigger.noBookmarks'
							: 'pptx.animation.trigger.selectBookmark',
					)
				}}
			</option>
			<option v-for="option in options" :key="option.value" :value="option.value">
				{{ option.label }}
			</option>
		</pptx-ui-select>
	</label>
</template>
