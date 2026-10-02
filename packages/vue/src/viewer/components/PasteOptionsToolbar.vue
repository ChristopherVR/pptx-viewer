<script setup lang="ts">
/**
 * PasteOptionsToolbar: the small icon-strip PowerPoint anchors to the
 * bottom-right corner of a just-pasted element, offering the same four
 * formats as the Paste Special dialog as a one-click follow-up. Dismissed by
 * any subsequent pointerdown or keydown. Vue adapter around the shared
 * `pptx-ui-paste-options`: this measures the pasted element and the element
 * renders, positions and dismisses the strip.
 */
import type { PasteOptionsRequestEvent, PasteSpecialFormat } from 'pptx-viewer-shared';
import { findCanvasElementNode } from 'pptx-viewer-shared';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
	/** The just-pasted element's id, or null when the toolbar should be hidden. */
	elementId: string | null;
}>();

const emit = defineEmits<{
	choose: [format: PasteSpecialFormat];
	dismiss: [];
}>();

const rect = ref<{ left: number; top: number } | null>(null);

watch(
	() => props.elementId,
	async (id) => {
		rect.value = null;
		if (!id) {
			return;
		}
		await nextTick();
		const node = findCanvasElementNode(document, id, { canvasOnly: true });
		const box = node?.getBoundingClientRect();
		rect.value = box ? { left: box.right, top: box.bottom } : null;
	},
	{ immediate: true },
);

const state = computed(() => ({
	left: rect.value?.left ?? 0,
	top: rect.value?.top ?? 0,
	translate: t,
}));
</script>

<template>
	<pptx-ui-paste-options
		v-if="props.elementId && rect"
		:state.prop="state"
		@paste-options-request="emit('choose', ($event as PasteOptionsRequestEvent).detail.format)"
		@paste-options-dismiss="emit('dismiss')"
	/>
</template>
