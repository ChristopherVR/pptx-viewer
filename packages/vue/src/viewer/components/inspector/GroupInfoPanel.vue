<script setup lang="ts">
/**
 * GroupInfoPanel: read-only child-count summary for a selected group, at
 * parity with React's `ElementMiscPanels.tsx` GroupInfoPanel.
 */
import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ element: PptxElement }>();
const { t } = useI18n();

const childCount = computed(() => {
	const group = props.element as GroupPptxElement;
	return Array.isArray(group.children) ? group.children.length : undefined;
});
</script>

<template>
	<div class="text-[11px] text-muted-foreground">
		{{
			childCount !== undefined
				? t('pptx.group.childCount', { count: childCount as number })
				: t('pptx.group.groupedElement')
		}}
	</div>
</template>
