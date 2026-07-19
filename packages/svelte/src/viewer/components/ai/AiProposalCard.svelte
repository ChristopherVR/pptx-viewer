<script lang="ts">
	/**
	 * AiProposalCard: a single staged, not-yet-applied write from the assistant.
	 * Shows a short diff summary with Accept / Reject controls. Purely
	 * presentational; the accept/reject callbacks route through the proposal store.
	 */
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import type { ProposalView } from 'pptx-viewer-shared/ai';

	import { useTranslator } from '../../../i18n/context';

	const MAX_SUMMARY_LINES = 4;

	const {
		proposal,
		onaccept,
		onreject,
	}: {
		proposal: ProposalView;
		onaccept: (id: string) => void;
		onreject: (id: string) => void;
	} = $props();

	const t = useTranslator();

	const shown = $derived(proposal.summary.slice(0, MAX_SUMMARY_LINES));
	const extra = $derived(proposal.summary.length - shown.length);
</script>

<div class="pptx-svelte-ai-proposal" data-proposal-id={proposal.id}>
	<div class="pptx-svelte-ai-proposal-tag">{t('pptx.ai.proposedChange')}</div>
	<div class="pptx-svelte-ai-proposal-label">{proposal.label}</div>
	{#if shown.length > 0}
		<ul class="pptx-svelte-ai-proposal-summary">
			{#each shown as line, i (i)}
				<li title={line}>{line}</li>
			{/each}
			{#if extra > 0}
				<li class="pptx-svelte-ai-proposal-more">{t('pptx.ai.moreChanges', { count: extra })}</li>
			{/if}
		</ul>
	{/if}
	<div class="pptx-svelte-ai-proposal-actions">
		<button
			type="button"
			class="pptx-svelte-ai-proposal-btn is-accept"
			onclick={() => onaccept(proposal.id)}
		>
			<Check size={13} aria-hidden="true" />
			{t('pptx.ai.accept')}
		</button>
		<button
			type="button"
			class="pptx-svelte-ai-proposal-btn is-reject"
			onclick={() => onreject(proposal.id)}
		>
			<X size={13} aria-hidden="true" />
			{t('pptx.ai.reject')}
		</button>
	</div>
</div>

<style>
	.pptx-svelte-ai-proposal {
		border: 1px solid color-mix(in srgb, var(--pptx-primary, #6366f1) 40%, transparent);
		border-radius: var(--pptx-radius, 6px);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 6%, transparent);
		padding: 10px;
	}

	.pptx-svelte-ai-proposal-tag {
		margin-bottom: 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--pptx-primary, #a5b4fc);
	}

	.pptx-svelte-ai-proposal-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-proposal-summary {
		margin: 4px 0 0;
		padding-left: 16px;
		list-style: disc;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-proposal-summary li {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ai-proposal-more {
		font-style: italic;
	}

	.pptx-svelte-ai-proposal-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.pptx-svelte-ai-proposal-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-radius: 3px;
		border: 1px solid transparent;
		font: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}

	.pptx-svelte-ai-proposal-btn.is-accept {
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #fff);
	}

	.pptx-svelte-ai-proposal-btn.is-accept:hover {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 90%, #000);
	}

	.pptx-svelte-ai-proposal-btn.is-reject {
		background: transparent;
		border-color: var(--pptx-border, #33334d);
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-proposal-btn.is-reject:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
