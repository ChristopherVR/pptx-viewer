<script lang="ts">
	/**
	 * AiPendingChanges: the staged-proposal tray under the transcript, with the
	 * "accept all" shortcut that only appears once more than one change is
	 * waiting. Split out of `AiChatPanel` to keep that file within the repo's
	 * file-size budget; every action routes back to the chat's proposal store.
	 */
	import type { ProposalView } from 'pptx-viewer-shared/ai';

	import { useTranslator } from '../../../i18n/context';
	import AiProposalCard from './AiProposalCard.svelte';

	const {
		proposals,
		onaccept,
		onacceptall,
		onreject,
	}: {
		proposals: readonly ProposalView[];
		onaccept: (id: string) => void;
		onacceptall: () => void;
		onreject: (id: string) => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-ai-proposals">
	<div class="pptx-svelte-ai-proposals-head">
		<span class="pptx-svelte-ai-proposals-title">
			{t('pptx.ai.pendingChanges', { count: proposals.length })}
		</span>
		{#if proposals.length > 1}
			<button type="button" class="pptx-svelte-ai-accept-all" onclick={onacceptall}>
				{t('pptx.ai.acceptAll')}
			</button>
		{/if}
	</div>
	{#each proposals as proposal (proposal.id)}
		<AiProposalCard {proposal} {onaccept} {onreject} />
	{/each}
</div>

<style>
	.pptx-svelte-ai-proposals {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 38%;
		overflow-y: auto;
		padding: 8px 12px;
		border-top: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-background, #11111b);
	}

	.pptx-svelte-ai-proposals-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pptx-svelte-ai-proposals-title {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-accept-all {
		padding: 2px 8px;
		border: none;
		border-radius: 3px;
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #fff);
		font: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}
</style>
