<script lang="ts">
	/**
	 * AiErrorBanner: the assistant's inline failure notice, with a retry that
	 * simply clears the error so the composer is usable again. Split out of
	 * `AiChatPanel` to keep that file within the repo's file-size budget.
	 */
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import { useTranslator } from '../../../i18n/context';

	const { message, onretry }: { message: string; onretry: () => void } = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-ai-error" role="alert">
	<TriangleAlert size={14} aria-hidden="true" />
	<div class="pptx-svelte-ai-error-body">
		<div class="pptx-svelte-ai-error-title">{t('pptx.ai.errorPrefix')}</div>
		<div class="pptx-svelte-ai-error-msg" title={message}>{message}</div>
	</div>
	<button type="button" class="pptx-svelte-ai-error-retry" onclick={onretry}>
		{t('pptx.ai.retry')}
	</button>
</div>

<style>
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
</style>
