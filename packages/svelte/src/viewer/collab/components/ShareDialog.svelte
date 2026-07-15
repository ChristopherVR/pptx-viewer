<script lang="ts">
	/**
	 * ShareDialog: configure and start a real-time collaboration session (room
	 * id, display name, server URL), or stop an active one. Svelte port of the
	 * Vue `ShareDialog.vue`; form/config logic lives in `share-helpers.ts`.
	 */
	import { useTranslator } from '../../../i18n/context';
	import ModalDialog from './ModalDialog.svelte';
	import type { ShareDialogProps } from './props';
	import {
		buildJoinConfig,
		buildShareConfig,
		canJoinShare,
		canStartShare,
		isPeerToPeerShare,
		seedShareFields,
	} from './share-helpers';

	const { open, defaults, active, onstart, onstop, onclose }: ShareDialogProps = $props();

	const t = useTranslator();

	let roomId = $state('');
	let userName = $state('');
	let serverUrl = $state('');
	let mode = $state<'create' | 'join'>('create');
	let invitation = $state('');

	// Re-seed the form from defaults whenever the dialog (re)opens.
	$effect(() => {
		if (open) {
			const seeded = seedShareFields(defaults);
			roomId = seeded.roomId;
			userName = seeded.userName;
			serverUrl = seeded.serverUrl;
		}
	});

	const canStart = $derived(canStartShare({ roomId, userName, serverUrl }));
	const canJoin = $derived(canJoinShare({ invitation, userName, serverUrl }));
	const isPeerToPeer = $derived(isPeerToPeerShare(serverUrl));

	function handleStart(): void {
		const config =
			mode === 'join'
				? buildJoinConfig({ invitation, userName, serverUrl })
				: buildShareConfig({ roomId, userName, serverUrl });
		if (config) {
			onstart(config);
		}
	}
</script>

<ModalDialog
	{open}
	title={active ? t('pptx.share.collaborationActive') : t('pptx.toolbar.share')}
	{onclose}
>
	{#if active}
		<div class="pptx-svelte-share-active">
			<p class="pptx-svelte-share-desc">{t('pptx.share.activeDescription')}</p>
			{#if isPeerToPeer}
				<p class="pptx-svelte-share-server-value">{t('pptx.share.p2pServerValue')}</p>
			{/if}
			<button type="button" class="pptx-svelte-share-stop" onclick={onstop}>
				{t('pptx.share.stopSharing')}
			</button>
		</div>
	{:else}
		<div class="pptx-svelte-share-form">
			<div class="pptx-svelte-share-tabs" role="tablist">
				<button type="button" role="tab" aria-selected={mode === 'create'} onclick={() => (mode = 'create')}>
					{t('pptx.share.createSession')}
				</button>
				<button type="button" role="tab" aria-selected={mode === 'join'} onclick={() => (mode = 'join')}>
					{t('pptx.share.joinSession')}
				</button>
			</div>
			<p class="pptx-svelte-share-desc">
				{t(mode === 'join' ? 'pptx.share.joinDescription' : 'pptx.share.formDescription')}
			</p>
			{#if mode === 'join'}
			<div class="pptx-svelte-share-field">
				<label for="pptx-svelte-share-invitation">{t('pptx.share.invitationLabel')}</label>
				<input
					id="pptx-svelte-share-invitation"
					type="text"
					bind:value={invitation}
					placeholder={t('pptx.share.invitationPlaceholder')}
				/>
				<p class="pptx-svelte-share-p2p-hint">{t('pptx.share.invitationHint')}</p>
			</div>
			{:else}
			<div class="pptx-svelte-share-field">
				<label for="pptx-svelte-share-room">{t('pptx.share.roomId')}</label>
				<input
					id="pptx-svelte-share-room"
					type="text"
					bind:value={roomId}
					placeholder={t('pptx.share.roomIdPlaceholder')}
				/>
			</div>
			{/if}
			<div class="pptx-svelte-share-field">
				<label for="pptx-svelte-share-name">{t('pptx.share.yourName')}</label>
				<input
					id="pptx-svelte-share-name"
					type="text"
					bind:value={userName}
					placeholder={t('pptx.share.yourNamePlaceholder')}
				/>
			</div>
			<div class="pptx-svelte-share-field">
				<label for="pptx-svelte-share-server">{t('pptx.share.serverUrl')}</label>
				<input
					id="pptx-svelte-share-server"
					type="text"
					bind:value={serverUrl}
					placeholder={t('pptx.share.serverPlaceholder')}
				/>
				{#if isPeerToPeer}
					<p class="pptx-svelte-share-p2p-hint">{t('pptx.share.p2pHint')}</p>
				{/if}
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<button type="button" class="pptx-svelte-share-btn" onclick={onclose}>
			{active ? t('pptx.share.close') : t('pptx.share.cancel')}
		</button>
		{#if !active}
			<button
				type="button"
				class="pptx-svelte-share-btn pptx-svelte-share-btn-primary"
				disabled={mode === 'join' ? !canJoin : !canStart}
				onclick={handleStart}
			>
				{t(mode === 'join' ? 'pptx.share.joinSession' : 'pptx.share.startSharing')}
			</button>
		{/if}
	{/snippet}
</ModalDialog>

<style>
	.pptx-svelte-share-active,
	.pptx-svelte-share-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.pptx-svelte-share-desc {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-share-server-value,
	.pptx-svelte-share-p2p-hint {
		margin: 0;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-share-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pptx-svelte-share-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		padding: 4px;
		border-radius: 8px;
		background: var(--pptx-muted, #1f2937);
	}

	.pptx-svelte-share-tabs button {
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		padding: 6px 10px;
		font: 500 12px/1.2 inherit;
		cursor: pointer;
	}

	.pptx-svelte-share-tabs button[aria-selected='true'] {
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-share-field label {
		font-size: 12px;
		font-weight: 500;
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-share-field input {
		width: 100%;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, #e2e8f0);
		padding: 6px 10px;
		font: inherit;
		font-size: 13px;
	}

	.pptx-svelte-share-field input:focus {
		outline: 1px solid var(--pptx-primary, #6366f1);
		outline-offset: -1px;
	}

	.pptx-svelte-share-stop {
		width: 100%;
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--pptx-radius, 6px);
		background: rgba(239, 68, 68, 0.1);
		color: #f87171;
		padding: 8px 12px;
		font: 500 12px/1 system-ui, sans-serif;
		cursor: pointer;
	}

	.pptx-svelte-share-stop:hover {
		background: rgba(239, 68, 68, 0.2);
	}

	.pptx-svelte-share-btn {
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #1f2937);
		color: var(--pptx-foreground, #f3f4f6);
		padding: 6px 16px;
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
	}

	.pptx-svelte-share-btn:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-share-btn-primary {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-share-btn-primary:hover {
		background: var(--pptx-primary, #6366f1);
		opacity: 0.9;
	}

	.pptx-svelte-share-btn-primary:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
</style>
