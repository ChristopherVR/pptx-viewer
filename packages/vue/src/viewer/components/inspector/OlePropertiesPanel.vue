<script setup lang="ts">
/**
 * OlePropertiesPanel: OLE object summary (type / file name / link status)
 * plus the Object Name editor, at parity with React's `ElementMiscPanels.tsx`
 * OlePropertiesPanel.
 *
 * A browser cannot run the native application that owns an embedded OLE
 * object, so the object itself stays read-only. Its Object Name IS editable:
 * `p:oleObj/@name` (ECMA-376 SS13.3.4) already parses, saves, and syncs via
 * collaboration, and shared's `getOleDisplayName` / `getOleAriaLabel` already
 * read it, so this field was the only piece missing to make it a real,
 * round-tripping edit.
 */
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import { getOleObjectTypeLabel } from 'pptx-viewer-core';
import { buildOleObjectNamePatch } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ element: PptxElement; canEdit?: boolean }>();
const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();
const { t } = useI18n();

const ole = computed(() => props.element as OlePptxElement);

function onNameInput(event: Event): void {
	emit(
		'update',
		buildOleObjectNamePatch((event.target as HTMLInputElement).value) as Partial<PptxElement>,
	);
}
</script>

<template>
	<div class="space-y-1.5 text-[11px]">
		<label class="flex flex-col gap-1">
			<span class="text-muted-foreground">{{ t('pptx.ole.objectName') }}</span>
			<input
				type="text"
				class="w-full bg-muted border border-border rounded px-1.5 py-1 text-[11px]"
				:disabled="!props.canEdit"
				:value="ole.oleName ?? ''"
				:placeholder="t('pptx.ole.objectNamePlaceholder')"
				@input="onNameInput"
			/>
		</label>
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
