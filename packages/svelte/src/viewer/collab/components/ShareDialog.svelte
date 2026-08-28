<script lang="ts">
	/**
	 * ShareDialog: configure and start a real-time collaboration session (room
	 * id, display name, server URL), or stop an active one. Svelte port of the
	 * Vue `ShareDialog.vue`; form/config logic lives in `share-helpers.ts`. The
	 * active view (status, share link, connected-users list) mirrors React's
	 * `ShareDialogActiveView.tsx`, built on shared's `buildActiveSessionUsers`.
	 */
	import { buildActiveSessionUsers, buildCollaborationShareUrl, resolveTransportForServerUrl } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import { useViewerOptions } from '../../state/viewer-options-context';
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

	const {
		open,
		defaults,
		active,
		status,
		connectedCount,
		remotePresences,
		activeCollaboration,
		onstart,
		onstop,
		onclose,
	}: ShareDialogProps = $props();

	const t = useTranslator();
	const optionsState = useViewerOptions();

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
	const isJoinMode = $derived(mode === 'join');

	function setMode(targetMode: 'create' | 'join'): void {
		mode = targetMode;
	}

	function setInvitation(value: string): void {
		invitation = value;
	}

	function handleStart(): void {
		const config =
			mode === 'join'
				? buildJoinConfig({ invitation, userName, serverUrl })
				: buildShareConfig({ roomId, userName, serverUrl });
		if (config) {
			onstart(config);
		}
	}

	// ── Active-session view ──────────────────────────────────────────────────

	const activeIsPeerToPeer = $derived(
		resolveTransportForServerUrl(activeCollaboration?.serverUrl ?? '') === 'webrtc',
	);
	const activeShareUrl = $derived(
		activeCollaboration && typeof window !== 'undefined'
			? buildCollaborationShareUrl(activeCollaboration, {
					origin: window.location.origin,
					pathname: window.location.pathname,
				})
			: '',
	);
	const sessionUsers = $derived(
		activeCollaboration
			? buildActiveSessionUsers({
					localUserName: activeCollaboration.userName,
					localUserInitials: optionsState.options.general.userInitials,
					localUserColor: activeCollaboration.userColor,
					remoteUsers: remotePresences,
				})
			: [],
	);

	let copied = $state(false);
	function onCopyLink(): void {
		if (!activeShareUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
			return;
		}
		void navigator.clipboard.writeText(activeShareUrl).then(() => {
			copied = true;
			window.setTimeout(() => {
				copied = false;
			}, 2000);
			return undefined;
		});
	}
</script>

<ModalDialog
	{open}
	title={active ? t('pptx.share.collaborationActive') : t('pptx.toolbar.share')}
	{onclose}
>
	{#if active}
		<div class="pptx-svelte-share-active">
			<!-- Status -->
			<div class="pptx-svelte-share-status-row">
				<span
					class="pptx-svelte-share-status-dot"
					class:is-connected={status === 'connected'}
					class:is-connecting={status === 'connecting'}
				></span>
				<span class="pptx-svelte-share-status-text">{status}</span>
				<span class="pptx-svelte-share-count">
					{t('pptx.collaboration.userCount', { count: connectedCount })}
				</span>
			</div>

			<!-- Share URL -->
			{#if activeShareUrl}
				<div class="pptx-svelte-share-field">
					<label for="pptx-svelte-share-link">{t('pptx.share.shareLink')}</label>
					<div class="pptx-svelte-share-link-row">
						<div id="pptx-svelte-share-link" class="pptx-svelte-share-link-value">{activeShareUrl}</div>
						<button
							type="button"
							class="pptx-svelte-share-btn"
							title={t('pptx.share.copyLink')}
							onclick={onCopyLink}
						>
							{copied ? t('pptx.share.copied') : t('pptx.share.copyUrl')}
						</button>
					</div>
					<p class="pptx-svelte-share-p2p-hint">{t('pptx.share.shareHint')}</p>
				</div>
			{/if}

			<!-- Session details -->
			{#if activeCollaboration}
				<div class="pptx-svelte-share-details-row">
					<span>
						{t('pptx.share.room')}
						<code>{activeCollaboration.roomId}</code>
					</span>
					<span>
						{t('pptx.share.server')}
						<code>{activeIsPeerToPeer ? t('pptx.share.p2pServerValue') : activeCollaboration.serverUrl}</code>
					</span>
				</div>
			{:else if isPeerToPeer}
				<p class="pptx-svelte-share-server-value">{t('pptx.share.p2pServerValue')}</p>
			{/if}

			<!-- Connected users -->
			{#if sessionUsers.length > 0}
				<div class="pptx-svelte-share-field">
					<label for="pptx-svelte-share-users">{t('pptx.share.connectedUsers')}</label>
					<div id="pptx-svelte-share-users" class="pptx-svelte-share-users">
						{#each sessionUsers as user (user.id)}
							<div class="pptx-svelte-share-user">
								<span class="pptx-svelte-share-user-avatar" style={`background-color: ${user.color}`}>
									{#if user.avatarUrl}
										<img src={user.avatarUrl} alt="" />
									{:else}
										{user.initials}
									{/if}
								</span>
								<span class="pptx-svelte-share-user-name">{user.name}</span>
								<span class="pptx-svelte-share-user-tag">
									{user.isLocal ? t('pptx.share.you') : t('pptx.notes.slideN', { n: user.slideNumber ?? 1 })}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<button type="button" class="pptx-svelte-share-stop" onclick={onstop}>
				{t('pptx.share.stopSharing')}
			</button>
		</div>
	{:else}
		<div class="pptx-svelte-share-form">
			<div class="pptx-svelte-share-tabs" role="tablist">
				<button type="button" role="tab" aria-selected={mode === 'create'} onclick={() => setMode('create')}>
					{t('pptx.share.createSession')}
				</button>
				<button type="button" role="tab" aria-selected={mode === 'join'} onclick={() => setMode('join')}>
					{t('pptx.share.joinSession')}
				</button>
			</div>
			<p class="pptx-svelte-share-desc">
				{t(isJoinMode ? 'pptx.share.joinDescription' : 'pptx.share.formDescription')}
			</p>
			{#if isJoinMode}
			<div class="pptx-svelte-share-field">
				<label for="pptx-svelte-share-invitation">{t('pptx.share.invitationLabel')}</label>
				<input
					id="pptx-svelte-share-invitation"
					type="text"
					value={invitation}
					oninput={(event: Event) => setInvitation((event.target as HTMLInputElement).value)}
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
					disabled={isJoinMode ? !canJoin : !canStart}
					onclick={handleStart}
				>
					{t(isJoinMode ? 'pptx.share.joinSession' : 'pptx.share.startSharing')}
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

	.pptx-svelte-share-status-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pptx-svelte-share-status-dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
		background: #f87171;
	}

	.pptx-svelte-share-status-dot.is-connected {
		background: #4ade80;
	}

	.pptx-svelte-share-status-dot.is-connecting {
		background: #facc15;
	}

	.pptx-svelte-share-status-text {
		font-size: 13px;
		font-weight: 500;
		text-transform: capitalize;
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-share-count {
		margin-left: auto;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-share-link-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pptx-svelte-share-link-value {
		flex: 1;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		padding: 6px 10px;
		color: var(--pptx-foreground, #e2e8f0);
		font-family: monospace;
		font-size: 11px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-share-details-row {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-share-details-row code {
		color: var(--pptx-foreground, #e2e8f0);
		font-family: monospace;
	}

	.pptx-svelte-share-users {
		max-height: 140px;
		overflow-y: auto;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
	}

	.pptx-svelte-share-user {
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
		padding: 6px 10px;
	}

	.pptx-svelte-share-user:last-child {
		border-bottom: 0;
	}

	.pptx-svelte-share-user-avatar {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 9999px;
		overflow: hidden;
		color: #ffffff;
		font-size: 9px;
		font-weight: 600;
	}

	.pptx-svelte-share-user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pptx-svelte-share-user-name {
		overflow: hidden;
		font-size: 12px;
		color: var(--pptx-foreground, #e2e8f0);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-share-user-tag {
		margin-left: auto;
		font-size: 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
		white-space: nowrap;
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
