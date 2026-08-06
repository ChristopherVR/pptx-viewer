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
	import { useAiChatHistory } from '../../ai/ai-chat-history.svelte';
	import type { AiPanelController } from '../../ai/ai-panel-controller.svelte';
	import { SvelteAiChat } from '../../ai/chat.svelte';
	import AiComposer from './AiComposer.svelte';
	import AiErrorBanner from './AiErrorBanner.svelte';
	import AiFocusBar from './AiFocusBar.svelte';
	import AiHistoryMenu from './AiHistoryMenu.svelte';
	import AiMessageList from './AiMessageList.svelte';
	import AiPendingChanges from './AiPendingChanges.svelte';

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

	// Applied-edit animation: once the session is ready, subscribe to its change
	// animator so that when the AI apply path publishes a batch of changed
	// elements we reveal that slide and hand the batch to the canvas overlay (the
	// user watches the edit land: glide old->new, fade/scale in-out, glow). The
	// effect re-runs when `chat.session` becomes available and cleans up on teardown.
	$effect(() => {
		const session = chat.session;
		if (!session) {
			return;
		}
		return session.changeAnimator.subscribe((batch) => {
			if (batch) {
				bridge.goToSlide(batch.slideIndex);
			}
			aiPanel.showChangeBatch(batch);
		});
	});

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

	// Chat history: debounced per-deck persistence + the "Chats" resume menu
	// (shared controller; the export in File > Options > AI reads the same store).
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const history = useAiChatHistory({
		// The bridge is created once for the panel's lifetime (it reads live viewer
		// state through getters), so capturing it here is intentional.
		// svelte-ignore state_referenced_locally
		bridge,
		getMessages: () => chat.messages,
		setMessages: (messages) => chat.setMessages(messages),
		getUntitledLabel: () => t('pptx.ai.untitledChat'),
	});

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
			<AiHistoryMenu
				chats={history.chats}
				activeChatId={history.activeChatId}
				canClear={chat.messages.length > 0}
				onresume={(id) => void history.resumeChat(id)}
				ondelete={(id) => void history.deleteChat(id)}
				onnewchat={() => history.newChat()}
				onclearchat={() => history.clearCurrent()}
			/>

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
				<AiErrorBanner message={chat.error.message} onretry={() => chat.clearError()} />
			{/if}

			{#if chat.proposals.length > 0}
				<AiPendingChanges
					proposals={chat.proposals}
					onaccept={applyProposal}
					onacceptall={acceptAllProposals}
					onreject={(id) => chat.rejectProposal(id)}
				/>
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
		min-height: 0;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1a1a2e);
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	/*
	 * Mobile (<768px): render as a bottom sheet instead of a full-height side
	 * panel. Use a fixed 75dvh height so it reads as a proper, roomy sheet (not a
	 * squished strip), span the full width, drop the left border for a top border,
	 * and round the top corners so it rises from the bottom edge (the dock is
	 * bottom-anchored in PowerPointViewer). This keeps the canvas above the sheet
	 * visible + tappable. Matches the React fix.
	 */
	@media (max-width: 767px) {
		.pptx-svelte-ai-panel {
			width: 100%;
			height: 75dvh;
			border-left: none;
			border-top: 1px solid var(--pptx-border, #33334d);
			border-top-left-radius: 12px;
			border-top-right-radius: 12px;
		}
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

	:global(.pptx-svelte-ai-spin) {
		animation: pptx-svelte-ai-panel-spin 0.8s linear infinite;
	}

	@keyframes pptx-svelte-ai-panel-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
