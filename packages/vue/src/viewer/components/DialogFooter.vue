<script setup lang="ts">
/**
 * DialogFooter: thin adapter around the shared `pptx-ui-dialog-footer`, the
 * Cancel / OK / primary row at the bottom of a dialog. The dialog shell
 * (`ModalDialog`) keeps the backdrop, focus trap and dismissal; this re-emits
 * the activated action id.
 */
import type { DialogFooterAction, DialogFooterRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';

const props = defineProps<{ actions: readonly DialogFooterAction[] }>();
const emit = defineEmits<{ action: [id: string] }>();
const state = computed(() => ({ actions: props.actions }));
</script>

<template>
	<pptx-ui-dialog-footer
		:state.prop="state"
		@dialog-footer-request="emit('action', ($event as DialogFooterRequestEvent).detail.id)"
	/>
</template>
