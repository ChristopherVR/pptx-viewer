<script lang="ts">
	/**
	 * AccountPage: File > Account's real content (replacing the old generic
	 * stub shared with Options). Four sections: a local-only display profile
	 * (persisted via `pptx-viewer-shared`'s `saveViewerProfile`), a
	 * storage/privacy panel backed by the IndexedDB autosave/recovery store,
	 * app info, and a disabled-by-default sign-in hook point for hosts that
	 * want to wire a real auth flow (`accountAuth`).
	 */
	import { onMount } from 'svelte';
	import {
		AVATAR_COLOR_SWATCHES,
		clearAllLocalViewerData,
		DEFAULT_VIEWER_PROFILE,
		formatBackstageSize,
		getLocalStorageUsageSummary,
		readStoredViewerPrefs,
		resolveProfileInitial,
		saveViewerProfile,
	} from 'pptx-viewer-shared';
	import type { AccountAuthConfig, LocalStorageUsageSummary, ViewerProfile } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';

	const { accountAuth }: { accountAuth?: AccountAuthConfig } = $props();
	const t = useTranslator();

	// This global is injected at build time from this package's own
	// `package.json` version (see `vite.config.ts`); the `typeof` guard keeps
	// it safe to reference under Vitest, which doesn't define it.
	const appVersion =
		typeof __PPTX_SVELTE_VIEWER_VERSION__ === 'string' ? __PPTX_SVELTE_VIEWER_VERSION__ : 'dev';

	let profile = $state<ViewerProfile>(readStoredViewerPrefs().profile ?? { ...DEFAULT_VIEWER_PROFILE });
	let usage = $state<LocalStorageUsageSummary | undefined>(undefined);
	let cleared = $state(false);

	async function refreshUsage(): Promise<void> {
		usage = await getLocalStorageUsageSummary();
	}
	onMount(() => {
		void refreshUsage();
	});

	function commitProfile(next: ViewerProfile): void {
		profile = next;
		saveViewerProfile(next);
	}

	function onNameInput(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		commitProfile({ ...profile, displayName: value });
	}

	function onPickColor(color: string): void {
		commitProfile({ ...profile, avatarColor: color });
	}

	async function onClearData(): Promise<void> {
		if (!window.confirm(t('pptx.account.storage.clearConfirm'))) {
			return;
		}
		await clearAllLocalViewerData();
		cleared = true;
		profile = { ...DEFAULT_VIEWER_PROFILE };
		await refreshUsage();
	}
</script>

<div class="pptx-svelte-account">
	<section class="card">
		<h2>{t('pptx.account.profile.title')}</h2>
		<div class="profile-row">
			<span class="avatar" style={`background:${profile.avatarColor}`}>{resolveProfileInitial(profile)}</span>
			<label class="name-field">
				<span>{t('pptx.account.profile.nameLabel')}</span>
				<input
					type="text"
					value={profile.displayName}
					placeholder={t('pptx.account.profile.namePlaceholder')}
					oninput={onNameInput}
				/>
			</label>
		</div>
		<span class="swatches-label">{t('pptx.account.profile.avatarColorLabel')}</span>
		<div class="swatch-row" role="group" aria-label={t('pptx.account.profile.avatarColorLabel')}>
			{#each AVATAR_COLOR_SWATCHES as color (color)}
				<button
					type="button"
					class:active={color === profile.avatarColor}
					style={`background:${color}`}
					aria-label={color}
					aria-pressed={color === profile.avatarColor}
					onclick={() => onPickColor(color)}
				></button>
			{/each}
		</div>
	</section>

	<section class="card">
		<h2>{t('pptx.account.storage.title')}</h2>
		{#if usage}
			<p>
				{usage.presentationCount > 0
					? t('pptx.account.storage.usage', {
							count: usage.presentationCount,
							size: formatBackstageSize(usage.totalBytes),
						})
					: t('pptx.account.storage.usageEmpty')}
			</p>
		{/if}
		<button type="button" class="secondary" onclick={() => void onClearData()}>
			{t('pptx.account.storage.clear')}
		</button>
		{#if cleared}<p class="notice">{t('pptx.account.storage.clearedNotice')}</p>{/if}
		<p class="muted">{t('pptx.account.storage.privacyBlurb')}</p>
	</section>

	<section class="card">
		<h2>{t('pptx.account.about.title')}</h2>
		<p>pptx-svelte-viewer</p>
		<p class="muted">{t('pptx.account.about.version', { version: appVersion })}</p>
	</section>

	{#if accountAuth?.enabled}
		<section class="card">
			<h2>{t('pptx.account.signIn.title')}</h2>
			{#if accountAuth.signedInUser}
				<p>{t('pptx.account.signIn.signedInAs', { name: accountAuth.signedInUser.name })}</p>
			{:else}
				<p>{t('pptx.account.signIn.description')}</p>
				<button type="button" class="primary" onclick={() => accountAuth?.onSignIn()}>
					{t('pptx.account.signIn.button')}
				</button>
			{/if}
		</section>
	{/if}
</div>

<style>
	.pptx-svelte-account {
		display: flex;
		max-width: 760px;
		flex-direction: column;
		gap: 20px;
		margin-top: 32px;
	}

	.card {
		padding: 24px 28px;
		border: 1px solid var(--pptx-border, #ddd);
		background: var(--pptx-card, #fff);
		color: var(--pptx-card-foreground, #242424);
	}

	h2 {
		margin: 0 0 16px;
		font-size: 15px;
	}

	p {
		margin: 0 0 12px;
		line-height: 1.6;
	}

	.muted {
		color: var(--pptx-muted-foreground, #666);
		font-size: 12px;
	}

	.notice {
		color: var(--pptx-primary, #c43e1c);
		font-size: 12px;
	}

	.profile-row {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}

	.avatar {
		display: grid;
		width: 48px;
		height: 48px;
		flex: none;
		place-items: center;
		border-radius: 50%;
		color: #fff;
		font-size: 18px;
		font-weight: 600;
	}

	.name-field {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #666);
	}

	.name-field input {
		height: 36px;
		padding: 0 12px;
		border: 1px solid var(--pptx-input, #888);
		background: var(--pptx-card, #fff);
		color: var(--pptx-card-foreground, #242424);
		font-size: 13px;
	}

	.name-field input:focus {
		border-color: var(--pptx-ring, #c43e1c);
		outline: none;
	}

	.swatches-label {
		display: block;
		margin-bottom: 8px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #666);
	}

	.swatch-row {
		display: flex;
		gap: 8px;
	}

	.swatch-row button {
		width: 24px;
		height: 24px;
		border: 2px solid transparent;
		border-radius: 50%;
		cursor: pointer;
	}

	.swatch-row button.active {
		border-color: var(--pptx-foreground, #242424);
	}

	.secondary,
	.primary {
		padding: 8px 16px;
		border: 1px solid var(--pptx-border, #ddd);
		background: var(--pptx-secondary, #f5eee9);
		color: inherit;
		font-size: 12px;
	}

	.primary {
		border: 0;
		background: var(--pptx-primary, #c43e1c);
		color: var(--pptx-primary-foreground, #fff);
		font-weight: 600;
	}
</style>
