<script lang="ts">
	/**
	 * CollaborationStatusIndicator: a small status pill showing the connection
	 * state and connected-participant count. Presentational only: the host
	 * (`PowerPointViewer.svelte`) supplies the reactive `status`/`connectedCount`
	 * from `CollaborationController` and listens for `onretry` in the error
	 * state. Svelte port of the Vue `CollaborationStatusIndicator.vue`.
	 */
	import type { ConnectionStatus } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { CollaborationStatusIndicatorProps } from './props';

	const { status, connectedCount, onretry }: CollaborationStatusIndicatorProps = $props();

	const t = useTranslator();

	interface StatusStyle {
		dotClass: string;
		textClass: string;
		labelKey: string;
	}

	const STATUS_STYLES: Record<ConnectionStatus, StatusStyle> = {
		connected: {
			dotClass: 'pptx-svelte-collab-status-dot-connected',
			textClass: 'pptx-svelte-collab-status-text-connected',
			labelKey: 'pptx.collaboration.status.connected',
		},
		connecting: {
			dotClass: 'pptx-svelte-collab-status-dot-connecting',
			textClass: 'pptx-svelte-collab-status-text-connecting',
			labelKey: 'pptx.collaboration.status.connecting',
		},
		disconnected: {
			dotClass: 'pptx-svelte-collab-status-dot-disconnected',
			textClass: 'pptx-svelte-collab-status-text-disconnected',
			labelKey: 'pptx.collaboration.status.disconnected',
		},
		error: {
			dotClass: 'pptx-svelte-collab-status-dot-error',
			textClass: 'pptx-svelte-collab-status-text-error',
			labelKey: 'pptx.collaboration.status.error',
		},
	};

	const style = $derived(STATUS_STYLES[status]);
	const text = $derived(
		status === 'connected'
			? connectedCount === 1
				? t('pptx.collaboration.onePersonHere')
				: t('pptx.collaboration.peopleHere', { count: connectedCount })
			: t(style.labelKey),
	);
	const ariaLabel = $derived(
		t('pptx.collaboration.statusAriaLabel', { status: t(style.labelKey), count: connectedCount }),
	);
</script>

<div
	class="pptx-svelte-collab-status"
	role="status"
	data-testid="collaboration-status"
	aria-label={ariaLabel}
>
	<span class={`pptx-svelte-collab-status-dot ${style.dotClass}`} aria-hidden="true"></span>
	<span class={`pptx-svelte-collab-status-text ${style.textClass}`}>{text}</span>
	{#if status === 'error'}
		<button
			type="button"
			class="pptx-svelte-collab-status-retry"
			aria-label={t('pptx.collaboration.retry')}
			onclick={onretry}
		>
			{t('pptx.collaboration.retry')}
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-collab-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: system-ui, sans-serif;
	}

	.pptx-svelte-collab-status-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 9999px;
	}

	.pptx-svelte-collab-status-dot-connected {
		background: #4ade80;
	}

	.pptx-svelte-collab-status-dot-connecting {
		background: #facc15;
		animation: pptx-svelte-collab-status-pulse 1.4s ease-in-out infinite;
	}

	.pptx-svelte-collab-status-dot-disconnected {
		background: #6b7280;
	}

	.pptx-svelte-collab-status-dot-error {
		background: #f87171;
	}

	.pptx-svelte-collab-status-text {
		font-size: 10px;
	}

	.pptx-svelte-collab-status-text-connected {
		color: #4ade80;
	}

	.pptx-svelte-collab-status-text-connecting {
		color: #facc15;
	}

	.pptx-svelte-collab-status-text-disconnected {
		color: #6b7280;
	}

	.pptx-svelte-collab-status-text-error {
		color: #f87171;
	}

	.pptx-svelte-collab-status-retry {
		border: none;
		background: transparent;
		padding: 0;
		font-size: 10px;
		color: #60a5fa;
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.pptx-svelte-collab-status-retry:hover {
		color: #93c5fd;
	}

	@keyframes pptx-svelte-collab-status-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
