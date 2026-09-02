<script lang="ts">
	/**
	 * File > Options > AI: a technical section that exports the full chat history,
	 * including every tool call's input/output, as a downloadable JSON or Markdown
	 * log for debugging. Rendered only when the host enables the `ai` prop.
	 */
	import Bug from '@lucide/svelte/icons/bug';
	import Download from '@lucide/svelte/icons/download';
	import { downloadBlob } from 'pptx-viewer-shared';
	import { collectStoredChats, createChatHistoryStore, exportAiChatLogs } from 'pptx-viewer-shared/ai';
	import type { AiLogFormat, PptxAiChatStore } from 'pptx-viewer-shared/ai';
	import { untrack } from 'svelte';

	import { useTranslator } from '../../../i18n/context';

	const { store }: { store?: PptxAiChatStore } = $props();

	const t = useTranslator();
	// The store is fixed for the section's lifetime (host passes one or none), so
	// capturing it once at init is intentional.
	const activeStore = untrack(() => store ?? createChatHistoryStore());

	let chatCount = $state<number | null>(null);
	// bind:checked writes this (invisible to the linter's prefer-const analysis).
	// eslint-disable-next-line prefer-const
	let detailed = $state(true);
	let busy = $state(false);
	let doneCount = $state<number | null>(null);

	$effect(() => {
		let cancelled = false;
		void (async (): Promise<void> => {
			try {
				const chats = await activeStore.listChats();
				if (!cancelled) {
					chatCount = chats.length;
				}
			} catch {
				if (!cancelled) {
					chatCount = 0;
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function handleExport(format: AiLogFormat): Promise<void> {
		busy = true;
		try {
			const chats = await collectStoredChats(activeStore);
			doneCount = exportAiChatLogs(chats, { format, detailed }, (filename, content, mime) => {
				downloadBlob(new Blob([content], { type: mime }), filename);
			});
		} catch {
			doneCount = 0;
		} finally {
			busy = false;
		}
	}
</script>

<div class="pptx-svelte-ai-settings">
	<div class="pptx-svelte-ai-settings-banner">
		<Bug size={16} class="pptx-svelte-ai-settings-ic" aria-hidden="true" />
		<div>
			<p class="pptx-svelte-ai-settings-title">{t('pptx.ai.settingsSectionTitle')}</p>
			<p class="pptx-svelte-ai-settings-hint">{t('pptx.ai.exportLogsHint')}</p>
		</div>
	</div>

	<p class="pptx-svelte-ai-settings-count">
		{chatCount === null
			? t('pptx.ai.exportLogsCounting')
			: t('pptx.ai.exportLogsStoredCount', { count: chatCount })}
	</p>

	<label class="pptx-svelte-ai-settings-detailed">
		<input type="checkbox" bind:checked={detailed} />
		{t('pptx.ai.exportLogsDetailed')}
	</label>

	<div class="pptx-svelte-ai-settings-actions">
		<button type="button" onclick={() => void handleExport('json')} disabled={busy}>
			<Download size={14} aria-hidden="true" />
			{t('pptx.ai.exportLogsJson')}
		</button>
		<button type="button" onclick={() => void handleExport('markdown')} disabled={busy}>
			<Download size={14} aria-hidden="true" />
			{t('pptx.ai.exportLogsMarkdown')}
		</button>
	</div>

	{#if doneCount !== null}
		<p class="pptx-svelte-ai-settings-done" role="status">
			{doneCount > 0
				? t('pptx.ai.exportLogsDone', { count: doneCount })
				: t('pptx.ai.noChatsToExport')}
		</p>
	{/if}
</div>

<style>
	.pptx-svelte-ai-settings {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.pptx-svelte-ai-settings-banner {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px;
		border: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 60%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--pptx-muted, #2a2a3d) 30%, transparent);
	}

	:global(.pptx-svelte-ai-settings-ic) {
		margin-top: 2px;
		flex-shrink: 0;
		color: var(--pptx-primary, #c43b32);
	}

	.pptx-svelte-ai-settings-title {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-settings-hint {
		margin: 4px 0 0;
		font-size: 11.5px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-settings-count {
		margin: 0;
		font-size: 11.5px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-settings-detailed {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-settings-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.pptx-svelte-ai-settings-actions button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: 6px;
		background: transparent;
		color: var(--pptx-foreground, #e2e8f0);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.pptx-svelte-ai-settings-actions button:hover:not(:disabled) {
		background: var(--pptx-muted, #2a2a3d);
	}

	.pptx-svelte-ai-settings-actions button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.pptx-svelte-ai-settings-done {
		margin: 0;
		font-size: 11.5px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
