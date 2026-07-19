<script setup lang="ts">
/**
 * AiConversation: the "ready" body of the AI panel. Wires the live session to
 * `useChat` (via {@link useAiConversation}) and lays out the transcript, the
 * staged-proposal review strip, an error banner, and the composer.
 */
import { TriangleAlert } from 'lucide-vue-next';
import type { PptxAiChatSession, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useI18n } from 'vue-i18n';

import { useAiConversation } from '../../composables/ai/useAiConversation';
import AiComposer from './AiComposer.vue';
import AiMessageList from './AiMessageList.vue';
import AiProposalCard from './AiProposalCard.vue';

const props = defineProps<{ session: PptxAiChatSession; config: PptxAiConfig }>();
const { t } = useI18n();

const {
	messages,
	error,
	isStreaming,
	proposals,
	send,
	stop,
	clearError,
	applyProposal,
	rejectProposal,
	acceptAllProposals,
} = useAiConversation(props.session, props.config);
</script>

<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<AiMessageList :messages="messages" :is-streaming="isStreaming" />

		<div
			v-if="error"
			class="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive"
		>
			<TriangleAlert class="mt-0.5 w-3.5 h-3.5 shrink-0" />
			<div class="min-w-0 flex-1">
				<div class="font-medium">{{ t('pptx.ai.errorPrefix') }}</div>
				<div class="truncate text-[11px] opacity-80" :title="error.message">
					{{ error.message }}
				</div>
			</div>
			<button
				type="button"
				class="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] underline-offset-2 hover:underline"
				@click="clearError"
			>
				{{ t('pptx.ai.retry') }}
			</button>
		</div>

		<div
			v-if="proposals.length > 0"
			class="max-h-[38%] space-y-2 overflow-y-auto border-t border-border bg-background px-3 py-2"
		>
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					{{ t('pptx.ai.pendingChanges', { count: proposals.length }) }}
				</span>
				<button
					v-if="proposals.length > 1"
					type="button"
					class="rounded-sm bg-primary/90 px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary"
					@click="acceptAllProposals"
				>
					{{ t('pptx.ai.acceptAll') }}
				</button>
			</div>
			<AiProposalCard
				v-for="proposal in proposals"
				:key="proposal.id"
				:proposal="proposal"
				@accept="applyProposal"
				@reject="rejectProposal"
			/>
		</div>

		<AiComposer :is-streaming="isStreaming" @send="send" @stop="stop" />
	</div>
</template>
