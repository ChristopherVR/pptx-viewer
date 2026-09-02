<script setup lang="ts">
/**
 * ReadOnlyBanner: shown above the canvas when the loaded deck recommends
 * opening read-only (`p:modifyVerifier` or "Mark as Final"). Mirrors the
 * existing Protected View banner's look; the recommendation itself is a pure
 * shared decision (`readOnlyRecommendation`, `pptx-viewer-shared`) computed by
 * `useReadOnlyRecommendation`, this component only renders it.
 */
import { Lock } from 'lucide-vue-next';
import type { ReadOnlyRecommendationKind } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	kind: ReadOnlyRecommendationKind;
	messageKey: string;
}>();

const emit = defineEmits<{
	'edit-anyway': [];
	dismiss: [];
}>();

const { t } = useI18n();
</script>

<template>
	<div
		v-if="props.kind"
		class="pptx-vue-readonly-banner flex items-center gap-3 border-b border-amber-700/30 bg-amber-900/20 px-4 py-2"
		role="status"
		data-testid="pptx-readonly-banner"
		:data-kind="props.kind"
	>
		<Lock class="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
		<p class="flex-1 text-xs text-amber-200">
			<strong>{{ t('pptx.readOnly.bannerTitle') }}</strong
			>: {{ t(props.messageKey) }}
		</p>
		<button
			type="button"
			data-testid="pptx-readonly-edit-anyway"
			class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30"
			@click="emit('edit-anyway')"
		>
			{{ t('pptx.readOnly.editAnyway') }}
		</button>
		<button
			type="button"
			data-testid="pptx-readonly-dismiss"
			class="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-200/80 transition-colors hover:bg-amber-700/20"
			@click="emit('dismiss')"
		>
			{{ t('pptx.readOnly.dismiss') }}
		</button>
	</div>
</template>
