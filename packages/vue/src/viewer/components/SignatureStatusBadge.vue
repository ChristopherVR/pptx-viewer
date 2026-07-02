<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
import { computed } from 'vue';

/**
 * SignatureStatusBadge: a small chrome badge indicating the document is
 * digitally signed. Vue port of the React `SignatureStatusBadge.tsx`. Renders
 * nothing when there are no signatures; emits `click` to open the signatures
 * panel/dialog.
 */
const props = defineProps<{
	hasSignatures: boolean;
	signatureCount: number;
}>();

const emit = defineEmits<{
	click: [];
}>();

const visible = computed(() => props.hasSignatures && props.signatureCount > 0);
</script>

<template>
	<button
		v-if="visible"
		type="button"
		class="inline-flex items-center gap-1 rounded-md border border-green-700/40 bg-green-900/30 px-2 py-0.5 text-[11px] font-medium text-green-300 transition-colors hover:bg-green-900/50"
		:title="`${props.signatureCount} digital signature(s)`"
		@click="emit('click')"
	>
		<ShieldCheck class="h-3.5 w-3.5" />
		<span>Signed</span>
	</button>
</template>
