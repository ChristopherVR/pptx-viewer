<script lang="ts">
	/**
	 * AiChatPanel: the right-hand AI assistant pane. Reached ONLY through the
	 * dynamic `{#await import('./components/ai/AiChatPanel.svelte')}` boundary in
	 * `PowerPointViewer.svelte`, so `@ai-sdk/svelte` + the optional `ai` SDK load
	 * lazily when the assistant is first opened.
	 *
	 * The panel owns the {@link SvelteAiChat} runes controller: it bootstraps the
	 * session on mount, guards availability, and lays out the transcript, staged
	 * proposals, an error banner, and the composer.
	 */
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import type { PptxAiBridge, PptxAiConfig, ToolCanvasTarget } from 'pptx-viewer-shared/ai';
	import { onMount, untrack } from 'svelte';

	import { useTranslator } from '../../../i18n/context';
	import type { AiPanelController } from '../../ai/ai-panel-controller.svelte';
	import { SvelteAiChat } from '../../ai/chat.svelte';
	import AiComposer from './AiComposer.svelte';
	import AiFocusBar from './AiFocusBar.svelte';
	import AiMessageList from './AiMessageList.svelte';
	import AiProposalCard from './AiProposalCard.svelte';

	const {
		bridge,
		config,
		aiPanel,
		onclose,
	}: {
		bridge: PptxAiBridge;
		config: PptxAiConfig;
		/** On-canvas scope controller (focus targets, picks, live-tool highlight). */
		aiPanel: AiPanelController;
		onclose: () => void;
	} = $props();

	const t = useTranslator();
	// Live "AI as a collaborator" focus: as each tool runs, navigate to and
	// highlight the slide / element(s) it touches so the canvas mirrors the
	// assistant in real time (and colour edits tween while it is active).
	function onToolTarget(target: ToolCanvasTarget | null): void {
		if (target && target.slideIndex !== undefined) {
			bridge.goToSlide(target.slideIndex);
		}
		aiPanel.flashToolTarget(target);
	}
	// The session is built once for the panel's lifetime (the bridge reads live
	// viewer state through getters, and `config` is stable), so capturing the
	// initial prop values here is intentional.
	const chat = untrack(() => new SvelteAiChat({ bridge, config, onToolTarget }));

	// Applying a suggestion briefly enables the canvas colour tween so the edit
	// fades in rather than snapping (proposals apply outside the tool loop).
	function applyProposal(id: string): void {
		aiPanel.flashToolTarget(null);
		chat.applyProposal(id);
	}
	function acceptAllProposals(): void {
		aiPanel.flashToolTarget(null);
		chat.acceptAllProposals();
	}

	onMount(() => {
		void chat.init();
	});
</script>

<aside class="pptx-svelte-ai-panel" data-pptx-ai-panel aria-label={t('pptx.ai.title')}>
	<div class="pptx-svelte-ai-header">
		<Sparkles size={16} class="pptx-svelte-ai-header-icon" aria-hidden="true" />
		<span class="pptx-svelte-ai-title">{t('pptx.ai.title')}</span>
		<button
			type="button"
			class="pptx-svelte-ai-close"
			onclick={onclose}
			title={t('pptx.ai.close')}
			aria-label={t('pptx.ai.close')}
		>
			<X size={16} aria-hidden="true" />
		</button>
	</div>

	{#if chat.initState === 'checking'}
		<div class="pptx-svelte-ai-state">
			<LoaderCircle size={20} class="pptx-svelte-ai-spin" aria-hidden="true" />
		</div>
	{:else if chat.initState === 'unavailable' || chat.initState === 'error'}
		<div class="pptx-svelte-ai-state">
			<TriangleAlert size={24} aria-hidden="true" />
			<p class="pptx-svelte-ai-state-title">{t('pptx.ai.unavailableTitle')}</p>
			<p class="pptx-svelte-ai-state-hint">
				{chat.initError?.message ?? t('pptx.ai.unavailableHint')}
			</p>
		</div>
	{:else if chat.initState === 'ready'}
		<div class="pptx-svelte-ai-body">
			<AiFocusBar
				targets={aiPanel.effectiveTargets}
				slides={bridge.getSlides()}
				isPinned={aiPanel.isPinned}
				hasPicks={aiPanel.hasPicks}
				pickMode={aiPanel.pickMode}
				onpin={() => aiPanel.pinFocus()}
				onclearpin={() => aiPanel.clearPinnedFocus()}
				onsenddirective={(text) => chat.send(text)}
				onstartpick={() => aiPanel.startPicking()}
				onstoppick={() => aiPanel.stopPicking()}
				onclearpicks={() => aiPanel.clearPicks()}
			/>

			<AiMessageList messages={chat.messages} isStreaming={chat.isStreaming} />

			{#if chat.error}
				<div class="pptx-svelte-ai-error" role="alert">
					<TriangleAlert size={14} aria-hidden="true" />
					<div class="pptx-svelte-ai-error-body">
						<div class="pptx-svelte-ai-error-title">{t('pptx.ai.errorPrefix')}</div>
						<div class="pptx-svelte-ai-error-msg" title={chat.error.message}>{chat.error.message}</div>
					</div>
					<button type="button" class="pptx-svelte-ai-error-retry" onclick={() => chat.clearError()}>
						{t('pptx.ai.retry')}
					</button>
				</div>
			{/if}

			{#if chat.proposals.length > 0}
				<div class="pptx-svelte-ai-proposals">
					<div class="pptx-svelte-ai-proposals-head">
						<span class="pptx-svelte-ai-proposals-title">
							{t('pptx.ai.pendingChanges', { count: chat.proposals.length })}
						</span>
						{#if chat.proposals.length > 1}
							<button
								type="button"
								class="pptx-svelte-ai-accept-all"
								onclick={acceptAllProposals}
							>
								{t('pptx.ai.acceptAll')}
							</button>
						{/if}
					</div>
					{#each chat.proposals as proposal (proposal.id)}
						<AiProposalCard
							{proposal}
							onaccept={applyProposal}
							onreject={(id) => chat.rejectProposal(id)}
						/>
					{/each}
				</div>
			{/if}

			<AiComposer
				isStreaming={chat.isStreaming}
				onsend={(text) => chat.send(text)}
				onstop={() => chat.stop()}
				prefillText={aiPanel.prefill.text}
				prefillNonce={aiPanel.prefill.nonce}
			/>
		</div>
	{/if}
</aside>

<style>
	.pptx-svelte-ai-panel {
		display: flex;
		flex-direction: column;
		width: 320px;
		max-width: 100%;
		height: 100%;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1a1a2e);
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}

	:global(.pptx-svelte-ai-header-icon) {
		color: var(--pptx-primary, #a5b4fc);
	}

	.pptx-svelte-ai-title {
		font-size: 13px;
		font-weight: 600;
	}

	.pptx-svelte-ai-close {
		margin-left: auto;
		display: inline-flex;
		padding: 4px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}

	.pptx-svelte-ai-close:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-ai-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 0 24px;
		text-align: center;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-state-title {
		margin: 0;
		font-size: 13px;
		font-weight: 500;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-state-hint {
		margin: 0;
		font-size: 12px;
	}

	.pptx-svelte-ai-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pptx-svelte-ai-error {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin: 0 12px 8px;
		padding: 6px 10px;
		border: 1px solid color-mix(in srgb, var(--pptx-destructive, #ef4444) 40%, transparent);
		border-radius: var(--pptx-radius, 6px);
		background: color-mix(in srgb, var(--pptx-destructive, #ef4444) 6%, transparent);
		color: var(--pptx-destructive, #fca5a5);
		font-size: 12px;
	}

	.pptx-svelte-ai-error-body {
		min-width: 0;
		flex: 1;
	}

	.pptx-svelte-ai-error-title {
		font-weight: 600;
	}

	.pptx-svelte-ai-error-msg {
		font-size: 11px;
		opacity: 0.8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ai-error-retry {
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 11px;
		text-decoration: underline;
		cursor: pointer;
	}

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

	:global(.pptx-svelte-ai-spin) {
		animation: pptx-svelte-ai-panel-spin 0.8s linear infinite;
	}

	@keyframes pptx-svelte-ai-panel-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
