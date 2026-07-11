<script lang="ts">
	/**
	 * BroadcastDialog: start/stop a one-way live broadcast (presenter drives
	 * slide navigation, viewers follow along via a shareable link). Svelte port
	 * of the Vue `BroadcastDialog.vue`. Only owns the start/stop UI; the host
	 * (`PowerPointViewer.svelte`) opens the actual collaboration session in
	 * response to `onstart` and supplies the resolved `viewerUrl` while active.
	 * Room-id generation, validity, and config assembly reuse the shared,
	 * framework-agnostic `pptx-viewer-shared` broadcast helpers directly (no
	 * local reimplementation).
	 */
	import {
		canUseClipboard,
		DEFAULT_BROADCAST_SERVER_URL,
		buildBroadcastConfig,
		canStartBroadcast,
		resolveTransportForServerUrl,
		seedBroadcastFields,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import ModalDialog from './ModalDialog.svelte';
	import type { BroadcastDialogProps } from './props';

	const { open, defaults, active, viewerUrl, onstart, onstop, onclose }: BroadcastDialogProps =
		$props();

	const t = useTranslator();

	let roomId = $state('');
	let serverUrl = $state(DEFAULT_BROADCAST_SERVER_URL);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	// Seed the form whenever the dialog opens for a fresh (non-active) broadcast.
	$effect(() => {
		if (open && !active) {
			const seeded = seedBroadcastFields(defaults);
			roomId = seeded.roomId;
			serverUrl = seeded.serverUrl;
			copied = false;
		}
	});

	const canStart = $derived(canStartBroadcast({ roomId, serverUrl }));
	const isPeerToPeer = $derived(resolveTransportForServerUrl(serverUrl) === 'webrtc');
	const title = $derived(active ? t('pptx.broadcast.broadcastingTitle') : t('pptx.broadcast.startTitle'));
	const canCopy = $derived(typeof navigator !== 'undefined' && canUseClipboard(navigator));

	function handleStart(): void {
		const config = buildBroadcastConfig({ roomId, serverUrl });
		if (config) {
			onstart(config);
		}
	}

	function onCopyLink(): void {
		if (!viewerUrl || !canCopy) {
			return;
		}
		void navigator.clipboard.writeText(viewerUrl).then(() => {
			copied = true;
			if (copyTimer !== null) {
				clearTimeout(copyTimer);
			}
			copyTimer = setTimeout(() => {
				copied = false;
			}, 2000);
			return undefined;
		});
	}
</script>

<ModalDialog {open} {title} {onclose}>
	{#if active}
		<div class="pptx-svelte-broadcast">
			<p class="pptx-svelte-broadcast-desc">{t('pptx.broadcast.liveDesc')}</p>
			<div class="pptx-svelte-broadcast-field">
				<label for="pptx-svelte-broadcast-viewer-url">{t('pptx.broadcast.viewerLink')}</label>
				<div class="pptx-svelte-broadcast-link-row">
					<input
						id="pptx-svelte-broadcast-viewer-url"
						type="text"
						readonly
						value={viewerUrl ?? ''}
						onfocus={(event) => (event.target as HTMLInputElement).select()}
					/>
					<button
						type="button"
						class="pptx-svelte-broadcast-btn"
						disabled={!canCopy || !viewerUrl}
						onclick={onCopyLink}
					>
						{copied ? t('pptx.share.copied') : t('pptx.broadcast.copyLinkBtn')}
					</button>
				</div>
				<p class="pptx-svelte-broadcast-hint">{t('pptx.broadcast.viewerHint')}</p>
				{#if isPeerToPeer}
					<p class="pptx-svelte-broadcast-server-value">{t('pptx.broadcast.p2pServerValue')}</p>
				{/if}
			</div>
			<button type="button" class="pptx-svelte-broadcast-stop" onclick={onstop}>
				{t('pptx.broadcast.stopBroadcast')}
			</button>
		</div>
	{:else}
		<div class="pptx-svelte-broadcast">
			<p class="pptx-svelte-broadcast-desc">{t('pptx.broadcast.idleDesc')}</p>
			<div class="pptx-svelte-broadcast-field">
				<label for="pptx-svelte-broadcast-room-id">{t('pptx.broadcast.roomId')}</label>
				<input
					id="pptx-svelte-broadcast-room-id"
					type="text"
					bind:value={roomId}
					placeholder={t('pptx.broadcast.roomIdPlaceholder')}
				/>
			</div>
			<div class="pptx-svelte-broadcast-field">
				<label for="pptx-svelte-broadcast-server-url">{t('pptx.broadcast.serverUrl')}</label>
				<input
					id="pptx-svelte-broadcast-server-url"
					type="text"
					bind:value={serverUrl}
					placeholder={t('pptx.broadcast.serverUrlPlaceholder')}
				/>
				{#if isPeerToPeer}
					<p class="pptx-svelte-broadcast-p2p-hint">{t('pptx.broadcast.p2pHint')}</p>
				{/if}
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<button type="button" class="pptx-svelte-broadcast-btn" onclick={onclose}>
			{t('pptx.common.close')}
		</button>
		{#if !active}
			<button
				type="button"
				class="pptx-svelte-broadcast-btn pptx-svelte-broadcast-btn-primary"
				disabled={!canStart}
				onclick={handleStart}
			>
				{t('pptx.broadcast.startBroadcast')}
			</button>
		{/if}
	{/snippet}
</ModalDialog>

<style>
	.pptx-svelte-broadcast {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.pptx-svelte-broadcast-desc {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-broadcast-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pptx-svelte-broadcast-field label {
		font-size: 12px;
		font-weight: 500;
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-broadcast-field input {
		width: 100%;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, #e2e8f0);
		padding: 6px 10px;
		font: inherit;
		font-size: 13px;
	}

	.pptx-svelte-broadcast-field input:focus {
		outline: 1px solid var(--pptx-primary, #6366f1);
		outline-offset: -1px;
	}

	.pptx-svelte-broadcast-link-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pptx-svelte-broadcast-link-row input {
		flex: 1;
		min-width: 0;
	}

	.pptx-svelte-broadcast-hint,
	.pptx-svelte-broadcast-server-value,
	.pptx-svelte-broadcast-p2p-hint {
		margin: 0;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-broadcast-stop {
		width: 100%;
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--pptx-radius, 6px);
		background: rgba(239, 68, 68, 0.1);
		color: #f87171;
		padding: 8px 12px;
		font: 500 12px/1 system-ui, sans-serif;
		cursor: pointer;
	}

	.pptx-svelte-broadcast-stop:hover {
		background: rgba(239, 68, 68, 0.2);
	}

	.pptx-svelte-broadcast-btn {
		flex-shrink: 0;
		white-space: nowrap;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #1f2937);
		color: var(--pptx-foreground, #f3f4f6);
		padding: 6px 12px;
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
	}

	.pptx-svelte-broadcast-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-broadcast-btn:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.pptx-svelte-broadcast-btn-primary {
		border: none;
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-broadcast-btn-primary:hover:not(:disabled) {
		background: var(--pptx-primary, #6366f1);
		opacity: 0.9;
	}
</style>
