<script setup lang="ts">
/**
 * AiConversation: the "ready" body of the AI panel. Wires the live session to
 * `useChat` (via {@link useAiConversation}) and lays out the focused-target bar,
 * the transcript, the staged-proposal review strip, an error banner, and the
 * composer.
 *
 * The focused-target bar (picks / pin / live selection) and the live
 * "AI as a collaborator" canvas focus are driven by the shared
 * {@link AiPanelController} threaded down from `PowerPointViewer`.
 */
import { TriangleAlert } from 'lucide-vue-next';
import type { PptxAiBridge, PptxAiChatSession, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAiConversation } from '../../composables/ai/useAiConversation';
import type { AiPanelController } from '../../composables/ai/useAiPanelController';
import AiComposer from './AiComposer.vue';
import AiFocusBar from './AiFocusBar.vue';
import AiMessageList from './AiMessageList.vue';
import AiProposalCard from './AiProposalCard.vue';

const props = defineProps<{
	session: PptxAiChatSession;
	config: PptxAiConfig;
	bridge: PptxAiBridge;
	aiPanel: AiPanelController;
}>();
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
} = useAiConversation(props.session, props.config, {
	// Live "AI as a collaborator" focus: as each tool runs, navigate to and
	// highlight the slide / element(s) it touches so the canvas mirrors the
	// assistant in real time (and colour edits tween while it is active).
	onToolTarget: (target) => {
		if (target && target.slideIndex !== undefined) {
			props.bridge.goToSlide(target.slideIndex);
		}
		props.aiPanel.flashToolTarget(target);
	},
});

// Applied-edit animation: when the AI apply path publishes a batch of changed
// elements, reveal that slide and hand the batch to the canvas overlay so the
// user watches the edit land (glide old->new, fade/scale in-out, glow).
const unsubscribeChanges = props.session.changeAnimator.subscribe((batch) => {
	if (batch) {
		props.bridge.goToSlide(batch.slideIndex);
	}
	props.aiPanel.showChangeBatch(batch);
});
onBeforeUnmount(() => unsubscribeChanges());

// Explicit picks win over a pin, which wins over the live selection.
const hasPicks = computed(() => props.aiPanel.pickTargets.value.length > 0);
const effectiveTargets = computed(() =>
	hasPicks.value
		? props.aiPanel.pickTargets.value
		: (props.aiPanel.pinnedFocus.value ?? props.aiPanel.liveFocusTargets.value),
);
const isPinned = computed(() => !hasPicks.value && props.aiPanel.pinnedFocus.value !== null);

// Applying a suggestion briefly enables the canvas colour tween so the edit
// fades in rather than snapping (proposals apply outside the tool loop).
function onApplyProposal(id: string): void {
	props.aiPanel.flashToolTarget(null);
	applyProposal(id);
}
function onAcceptAll(): void {
	props.aiPanel.flashToolTarget(null);
	acceptAllProposals();
}
</script>

<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<AiFocusBar
			:targets="effectiveTargets"
			:slides="props.bridge.getSlides()"
			:is-pinned="isPinned"
			:pick-mode="props.aiPanel.pickMode.value"
			:has-picks="hasPicks"
			@pin="props.aiPanel.pinFocus"
			@clear-pin="props.aiPanel.clearPinnedFocus"
			@start-pick="props.aiPanel.startPicking"
			@stop-pick="props.aiPanel.stopPicking"
			@clear-picks="props.aiPanel.clearPicks"
			@send-directive="send"
		/>

		<AiMessageList :messages="messages" :is-streaming="isStreaming" />

		<div
			v-if="error"
			class="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive"
		>
			<TriangleAlert class="mt-0.5 w-3.5 h-3.5 shrink-0" />
			<div class="min-w-0 flex-1">
				<div class="font-medium">{{ t('pptx.ai.errorPrefix') }}</div>
				<div class="max-h-24 overflow-y-auto break-words text-[11px] opacity-80">
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
					@click="onAcceptAll"
				>
					{{ t('pptx.ai.acceptAll') }}
				</button>
			</div>
			<AiProposalCard
				v-for="proposal in proposals"
				:key="proposal.id"
				:proposal="proposal"
				@accept="onApplyProposal"
				@reject="rejectProposal"
			/>
		</div>

		<AiComposer
			:is-streaming="isStreaming"
			:prefill-text="props.aiPanel.prefill.value.text"
			:prefill-nonce="props.aiPanel.prefill.value.nonce"
			@send="send"
			@stop="stop"
		/>
	</div>
</template>
