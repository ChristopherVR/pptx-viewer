<script lang="ts">
	/**
	 * AiMessageList: scrollable transcript of user / assistant turns. Assistant
	 * tool calls render as {@link AiToolCallCard}s inline between prose. Purely
	 * presentational; auto-scrolls to the newest message.
	 */
	import Bot from '@lucide/svelte/icons/bot';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import User from '@lucide/svelte/icons/user';
	import { toRenderableParts } from 'pptx-viewer-shared/ai';
	import type { PptxAiUIMessage } from 'pptx-viewer-shared/ai';

	import { useTranslator } from '../../../i18n/context';
	import AiToolCallCard from './AiToolCallCard.svelte';

	const {
		messages,
		isStreaming,
	}: {
		messages: PptxAiUIMessage[];
		isStreaming: boolean;
	} = $props();

	const t = useTranslator();

	// bind:this writes this (invisible to the linter's prefer-const analysis).
	// eslint-disable-next-line prefer-const
	let endEl = $state<HTMLDivElement | undefined>(undefined);
	$effect(() => {
		void messages;
		void isStreaming;
		endEl?.scrollIntoView({ block: 'end' });
	});
</script>

{#if messages.length === 0}
	<div class="pptx-svelte-ai-empty">
		<Sparkles size={26} aria-hidden="true" />
		<p class="pptx-svelte-ai-empty-title">{t('pptx.ai.emptyTitle')}</p>
		<p class="pptx-svelte-ai-empty-hint">{t('pptx.ai.emptyHint')}</p>
	</div>
{:else}
	<div class="pptx-svelte-ai-messages" role="log" aria-live="polite">
		{#each messages as message (message.id)}
			{@const isUser = message.role === 'user'}
			{@const parts = toRenderableParts(message)}
			{#if isUser || parts.length > 0}
				<div class="pptx-svelte-ai-msg">
					<div
						class="pptx-svelte-ai-avatar"
						class:is-user={isUser}
						aria-label={isUser ? t('pptx.ai.you') : t('pptx.ai.assistant')}
					>
						{#if isUser}<User size={14} aria-hidden="true" />{:else}<Bot
								size={14}
								aria-hidden="true"
							/>{/if}
					</div>
					<div class="pptx-svelte-ai-msg-body">
						{#each parts as part, i (part.kind === 'tool' ? part.toolCallId || i : i)}
							{#if part.kind === 'text'}
								<p class="pptx-svelte-ai-msg-text">{part.text}</p>
							{:else}
								<AiToolCallCard {part} />
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		{/each}
		{#if isStreaming}
			<div class="pptx-svelte-ai-thinking">
				<span class="pptx-svelte-ai-dots">
					<span></span><span></span><span></span>
				</span>
				{t('pptx.ai.thinking')}
			</div>
		{/if}
		<div bind:this={endEl}></div>
	</div>
{/if}

<style>
	.pptx-svelte-ai-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 0 24px;
		text-align: center;
		color: var(--pptx-primary, #a5b4fc);
	}

	.pptx-svelte-ai-empty-title {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-empty-hint {
		margin: 0;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-messages {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow-y: auto;
		padding: 12px;
	}

	.pptx-svelte-ai-msg {
		display: flex;
		gap: 8px;
	}

	.pptx-svelte-ai-avatar {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin-top: 2px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
		color: var(--pptx-primary, #a5b4fc);
	}

	.pptx-svelte-ai-avatar.is-user {
		background: var(--pptx-secondary, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-msg-body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pptx-svelte-ai-msg-text {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--pptx-card-foreground, #e2e8f0);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.pptx-svelte-ai-thinking {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-left: 32px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-dots {
		display: inline-flex;
		gap: 4px;
	}

	.pptx-svelte-ai-dots span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--pptx-muted-foreground, #94a3b8);
		animation: pptx-svelte-ai-bounce 1s infinite;
	}

	.pptx-svelte-ai-dots span:nth-child(1) {
		animation-delay: -0.2s;
	}

	.pptx-svelte-ai-dots span:nth-child(2) {
		animation-delay: -0.1s;
	}

	@keyframes pptx-svelte-ai-bounce {
		0%,
		80%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		40% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}
</style>
