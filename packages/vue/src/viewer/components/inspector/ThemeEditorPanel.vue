<script setup lang="ts">
import type { PptxTheme } from 'pptx-viewer-core';
import { themeEditorLabels } from 'pptx-viewer-shared';
import type { ThemeEditorApplyEvent, ThemeEditorEdit } from 'pptx-viewer-shared';
import { toRaw } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{ theme: PptxTheme | undefined; canEdit: boolean }>();
const emit = defineEmits<{ apply: [edit: ThemeEditorEdit]; close: [] }>();
const { t } = useI18n();
function apply(event: Event): void {
	emit('apply', (event as ThemeEditorApplyEvent).detail);
}
</script>

<template>
	<pptx-ui-theme-editor
		:theme.prop="toRaw(theme)"
		:labels.prop="themeEditorLabels(t)"
		:disabled.prop="!canEdit"
		@theme-editor-apply="apply"
		@theme-editor-close="emit('close')"
	/>
</template>
