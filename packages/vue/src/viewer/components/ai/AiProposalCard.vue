<script setup lang="ts">
/**
 * AiProposalCard: a single staged, not-yet-applied write from the assistant.
 * Shows a short diff summary with Accept / Reject controls. Purely
 * presentational; the accept/reject callbacks route through the proposal store.
 */
import { Check, X } from 'lucide-vue-next';
import type { ProposalView } from 'pptx-viewer-shared/ai';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ proposal: ProposalView }>();
const emit = defineEmits<{ (e: 'accept' | 'reject', id: string): void }>();
const { t } = useI18n();

const MAX_SUMMARY_LINES = 4;
const shown = computed(() => props.proposal.summary.slice(0, MAX_SUMMARY_LINES));
const extra = computed(() => props.proposal.summary.length - shown.value.length);
</script>

<template>
	<div class="rounded-md border border-primary/40 bg-primary/5 p-2.5">
		<div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
			{{ t('pptx.ai.proposedChange') }}
		</div>
		<div class="text-[12px] font-medium text-foreground">{{ props.proposal.label }}</div>
		<ul v-if="shown.length > 0" class="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
			<li v-for="(line, i) in shown" :key="i" class="truncate" :title="line">{{ line }}</li>
			<li v-if="extra > 0" class="italic">{{ t('pptx.ai.moreChanges', { count: extra }) }}</li>
		</ul>
		<div class="mt-2 flex items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				@click="emit('accept', props.proposal.id)"
			>
				<Check class="w-3.5 h-3.5" />
				{{ t('pptx.ai.accept') }}
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
				@click="emit('reject', props.proposal.id)"
			>
				<X class="w-3.5 h-3.5" />
				{{ t('pptx.ai.reject') }}
			</button>
		</div>
	</div>
</template>
