<script lang="ts">
	/**
	 * AiComposer: the message input row (textarea + send / stop button). Enter
	 * sends, Shift+Enter inserts a newline. Purely presentational.
	 */
	import Send from '@lucide/svelte/icons/send';
	import Square from '@lucide/svelte/icons/square';

	import { useTranslator } from '../../../i18n/context';

	const {
		isStreaming,
		onsend,
		onstop,
	}: {
		isStreaming: boolean;
		onsend: (text: string) => void;
		onstop: () => void;
	} = $props();

	const t = useTranslator();

	let value = $state('');
	const canSend = $derived(value.trim().length > 0);

	function submit(): void {
		const trimmed = value.trim();
		if (trimmed.length === 0 || isStreaming) {
			return;
		}
		onsend(trimmed);
		value = '';
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}
</script>

<div class="pptx-svelte-ai-composer">
	<div class="pptx-svelte-ai-composer-box">
		<textarea
			class="pptx-svelte-ai-input"
			bind:value
			onkeydown={onKeydown}
			rows="1"
			placeholder={t('pptx.ai.placeholder')}
			aria-label={t('pptx.ai.placeholder')}
		></textarea>
		{#if isStreaming}
			<button
				type="button"
				class="pptx-svelte-ai-send"
				onclick={onstop}
				title={t('pptx.ai.stop')}
				aria-label={t('pptx.ai.stop')}
			>
				<Square size={16} aria-hidden="true" />
			</button>
		{:else}
			<button
				type="button"
				class="pptx-svelte-ai-send"
				class:is-ready={canSend}
				onclick={submit}
				disabled={!canSend}
				title={t('pptx.ai.send')}
				aria-label={t('pptx.ai.send')}
			>
				<Send size={16} aria-hidden="true" />
			</button>
		{/if}
	</div>
</div>

<style>
	.pptx-svelte-ai-composer {
		border-top: 1px solid var(--pptx-border, #33334d);
		padding: 8px;
	}

	.pptx-svelte-ai-composer-box {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		padding: 6px 8px;
		border: 1px solid var(--pptx-input, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
	}

	.pptx-svelte-ai-composer-box:focus-within {
		border-color: var(--pptx-ring, #818cf8);
	}

	.pptx-svelte-ai-input {
		flex: 1;
		min-height: 24px;
		max-height: 128px;
		resize: none;
		border: none;
		background: transparent;
		color: var(--pptx-card-foreground, #e2e8f0);
		font: inherit;
		font-size: 13px;
		outline: none;
	}

	.pptx-svelte-ai-input::placeholder {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-send {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}

	.pptx-svelte-ai-send:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-ai-send.is-ready {
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #fff);
	}

	.pptx-svelte-ai-send.is-ready:hover {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 90%, #000);
	}

	.pptx-svelte-ai-send:disabled {
		cursor: default;
		opacity: 0.5;
	}
</style>
