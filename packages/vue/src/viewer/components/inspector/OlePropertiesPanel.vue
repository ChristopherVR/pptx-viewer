<script setup lang="ts">
/**
 * OlePropertiesPanel: read-only OLE object summary (type / file name / link
 * status), at parity with React's `ElementMiscPanels.tsx` OlePropertiesPanel.
 */
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import { getOleObjectTypeLabel } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ element: PptxElement }>();
const { t } = useI18n();

const ole = computed(() => props.element as OlePptxElement);
</script>

<template>
	<div class="space-y-1.5 text-[11px]">
		<div class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.ole.type') }}</span>
			<span class="truncate text-foreground">{{ getOleObjectTypeLabel(ole.oleObjectType) }}</span>
		</div>
		<div v-if="ole.fileName" class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.ole.fileName') }}</span>
			<span class="truncate text-foreground" :title="ole.fileName">{{ ole.fileName }}</span>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span class="text-muted-foreground">{{ t('pptx.ole.linkStatus') }}</span>
			<span
				class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
				:class="ole.isLinked ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'"
			>
				{{ ole.isLinked ? t('pptx.ole.linked') : t('pptx.ole.embedded') }}
			</span>
		</div>
	</div>
</template>
