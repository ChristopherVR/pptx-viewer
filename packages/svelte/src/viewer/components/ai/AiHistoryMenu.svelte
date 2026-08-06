<script lang="ts">
	/**
	 * AiHistoryMenu: the AI panel's chat-history affordance. Renders the toolbar
	 * row ("Chats" toggle + new-chat / clear-chat icon buttons) and, when open,
	 * the dropdown listing saved chats (newest first) with resume + delete, a
	 * "New chat" action, and a caption making clear history lives in this
	 * browser. All persistence lives in `useAiChatHistory`; this component only
	 * calls back. Mirrors the React binding's AiHistoryMenu / AiHistoryList.
	 */
	import History from '@lucide/svelte/icons/history';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { PptxAiChatSummary } from 'pptx-viewer-shared/ai';

	import { useTranslator } from '../../../i18n/context';

	const {
		chats,
		activeChatId,
		canClear,
		onresume,
		ondelete,
		onnewchat,
		onclearchat,
	}: {
		chats: PptxAiChatSummary[];
		activeChatId: string;
		canClear: boolean;
		onresume: (id: string) => void;
		ondelete: (id: string) => void;
		onnewchat: () => void;
		onclearchat: () => void;
	} = $props();

	const t = useTranslator();
	let open = $state(false);
	let rootEl: HTMLElement | undefined = $state();

	// Close on outside click (the toggle itself is inside rootEl, so it toggles).
	function onDocMouseDown(event: MouseEvent): void {
		if (open && rootEl && !rootEl.contains(event.target as Node)) {
			open = false;
		}
	}
	$effect(() => {
		document.addEventListener('mousedown', onDocMouseDown);
		return () => document.removeEventListener('mousedown', onDocMouseDown);
	});
</script>

<div class="pptx-svelte-ai-history" bind:this={rootEl}>
	<div class="pptx-svelte-ai-history-bar">
		<button type="button" class="pptx-svelte-ai-chats-btn" onclick={() => (open = !open)}>
			<History size={14} aria-hidden="true" />
			{t('pptx.ai.chats')}
		</button>
		<div class="pptx-svelte-ai-history-actions">
			<button
				type="button"
				class="pptx-svelte-ai-history-icon-btn"
				title={t('pptx.ai.newChat')}
				aria-label={t('pptx.ai.newChat')}
				onclick={() => onnewchat()}
			>
				<MessageSquarePlus size={14} aria-hidden="true" />
			</button>
			<button
				type="button"
				class="pptx-svelte-ai-history-icon-btn"
				title={t('pptx.ai.clearChat')}
				aria-label={t('pptx.ai.clearChat')}
				disabled={!canClear}
				onclick={() => onclearchat()}
			>
				<Trash2 size={14} aria-hidden="true" />
			</button>
		</div>
	</div>

	{#if open}
		<div class="pptx-svelte-ai-history-menu">
			<div class="pptx-svelte-ai-history-head">
				<span class="pptx-svelte-ai-history-title">{t('pptx.ai.historyTitle')}</span>
				<button
					type="button"
					class="pptx-svelte-ai-history-new"
					onclick={() => {
						onnewchat();
						open = false;
					}}
				>
					<Plus size={12} aria-hidden="true" />
					{t('pptx.ai.newChat')}
				</button>
			</div>
			{#if chats.length === 0}
				<p class="pptx-svelte-ai-history-empty">{t('pptx.ai.historyEmpty')}</p>
			{:else}
				<ul class="pptx-svelte-ai-history-list">
					{#each chats as chat (chat.id)}
						<li class="pptx-svelte-ai-history-row">
							<button
								type="button"
								class="pptx-svelte-ai-history-resume"
								class:is-active={chat.id === activeChatId}
								onclick={() => {
									onresume(chat.id);
									open = false;
								}}
							>
								<MessageSquare size={14} aria-hidden="true" />
								<span class="pptx-svelte-ai-history-text">
									<span class="pptx-svelte-ai-history-name">
										{chat.title || t('pptx.ai.untitledChat')}
									</span>
									<span class="pptx-svelte-ai-history-meta">
										{t('pptx.ai.messageCount', { count: chat.messageCount })}
									</span>
								</span>
							</button>
							<button
								type="button"
								class="pptx-svelte-ai-history-delete"
								title={t('pptx.ai.deleteChat')}
								aria-label={t('pptx.ai.deleteChat')}
								onclick={() => ondelete(chat.id)}
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="pptx-svelte-ai-history-hint">{t('pptx.ai.historyHint')}</p>
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-ai-history { position: relative; flex: none; }
	.pptx-svelte-ai-history-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}
	.pptx-svelte-ai-chats-btn,
	.pptx-svelte-ai-history-icon-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 6px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 12px;
		cursor: pointer;
	}
	.pptx-svelte-ai-history-actions { margin-left: auto; display: flex; align-items: center; gap: 2px; }
	.pptx-svelte-ai-history-icon-btn { padding: 4px; }
	.pptx-svelte-ai-chats-btn:hover,
	.pptx-svelte-ai-history-icon-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
	.pptx-svelte-ai-history-icon-btn:disabled { opacity: 0.4; cursor: default; }
	.pptx-svelte-ai-history-menu {
		position: absolute;
		right: 8px;
		top: calc(100% + 4px);
		z-index: 40;
		width: 256px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 6px;
		background: var(--pptx-popover, var(--pptx-card, #1a1a2e));
		color: var(--pptx-card-foreground, #e2e8f0);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
	}
	.pptx-svelte-ai-history-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}
	.pptx-svelte-ai-history-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
	.pptx-svelte-ai-history-new {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border: none;
		border-radius: 3px;
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #f8fafc);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}
	.pptx-svelte-ai-history-empty {
		margin: 0;
		padding: 16px 12px;
		text-align: center;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
	.pptx-svelte-ai-history-list { margin: 0; padding: 4px 0; list-style: none; max-height: 256px; overflow-y: auto; }
	.pptx-svelte-ai-history-row { display: flex; align-items: center; gap: 4px; padding: 0 4px; }
	.pptx-svelte-ai-history-resume {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: flex-start;
		gap: 8px;
		padding: 6px 8px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		text-align: left;
		cursor: pointer;
	}
	.pptx-svelte-ai-history-resume:hover { background: var(--pptx-accent, #33334d); }
	.pptx-svelte-ai-history-resume.is-active {
		background: color-mix(in srgb, var(--pptx-accent, #33334d) 60%, transparent);
	}
	.pptx-svelte-ai-history-text { display: flex; min-width: 0; flex: 1; flex-direction: column; }
	.pptx-svelte-ai-history-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-weight: 500;
		color: var(--pptx-card-foreground, #e2e8f0);
	}
	.pptx-svelte-ai-history-meta { font-size: 10px; color: var(--pptx-muted-foreground, #94a3b8); }
	.pptx-svelte-ai-history-delete {
		display: inline-flex;
		flex: none;
		padding: 4px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}
	.pptx-svelte-ai-history-delete:hover {
		background: color-mix(in srgb, var(--pptx-destructive, #ef4444) 10%, transparent);
		color: var(--pptx-destructive, #ef4444);
	}
	.pptx-svelte-ai-history-hint {
		margin: 0;
		padding: 6px 10px;
		border-top: 1px solid var(--pptx-border, #33334d);
		font-size: 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
