<script lang="ts">
	/**
	 * FollowModeBar: lists the active remote peers and lets the local user
	 * follow one of them (mirroring that peer's active slide) or stop
	 * following. Presentational: owns no Yjs/network logic. Svelte port of the
	 * Vue `FollowModeBar.vue`.
	 */
	import type { SanitizedPresence } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { FollowModeBarProps } from './props';

	const { presences, followedClientId, onfollow }: FollowModeBarProps = $props();

	const t = useTranslator();

	/** First-letter / two-char initials for the avatar chip. */
	function initials(name: string): string {
		const parts = name.trim().split(/\s+/u);
		if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return name.slice(0, 2).toUpperCase() || '?';
	}

	const followedPeer = $derived<SanitizedPresence | null>(
		followedClientId === null
			? null
			: (presences.find((p) => p.clientId === followedClientId) ?? null),
	);

	function toggleFollow(clientId: number): void {
		onfollow(followedClientId === clientId ? null : clientId);
	}

	function stopFollowing(): void {
		onfollow(null);
	}
</script>

{#if presences.length > 0}
	<div class="pptx-svelte-follow-bar" data-export-ignore="true">
		<span class="pptx-svelte-follow-status">
			{#if followedPeer}
				{t('pptx.followMode.following')}
				<strong class="pptx-svelte-follow-name-strong">{followedPeer.userName}</strong>
				<button
					type="button"
					class="pptx-svelte-follow-stop"
					title={t('pptx.followMode.stopFollowing')}
					onclick={stopFollowing}
				>
					{t('pptx.followMode.stop')}
				</button>
			{:else}
				{t('pptx.followMode.followCollaborator')}
			{/if}
		</span>
		<ul class="pptx-svelte-follow-list">
			{#each presences as peer (peer.clientId)}
				<li>
					<button
						type="button"
						class="pptx-svelte-follow-peer"
						class:pptx-svelte-follow-peer-active={peer.clientId === followedClientId}
						data-client-id={peer.clientId}
						aria-pressed={peer.clientId === followedClientId}
						title={
							peer.clientId === followedClientId
								? t('pptx.followMode.stopFollowingUser', { name: peer.userName })
								: t('pptx.followMode.followUser', { name: peer.userName })
						}
						onclick={() => toggleFollow(peer.clientId)}
					>
						<span
							class="pptx-svelte-follow-avatar"
							style={`background-color: ${peer.userColor}`}
						>
							{initials(peer.userName)}
						</span>
						<span class="pptx-svelte-follow-name">{peer.userName}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.pptx-svelte-follow-bar {
		display: flex;
		max-width: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 8px;
		padding: 6px 10px;
		background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 95%, transparent);
		color: var(--pptx-foreground, #e2e8f0);
		font-family: system-ui, sans-serif;
		font-size: 12px;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 25%);
	}

	.pptx-svelte-follow-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-follow-name-strong {
		color: var(--pptx-foreground, #e2e8f0);
	}

	.pptx-svelte-follow-stop {
		cursor: pointer;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 6px;
		background: transparent;
		color: var(--pptx-foreground, #e2e8f0);
		padding: 2px 8px;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-follow-stop:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-follow-list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pptx-svelte-follow-peer {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		border: 1px solid transparent;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--pptx-muted, #1f2937) 60%, transparent);
		color: var(--pptx-foreground, #e2e8f0);
		padding: 2px 8px 2px 2px;
		font: inherit;
	}

	.pptx-svelte-follow-peer:hover {
		background: var(--pptx-muted, #1f2937);
	}

	.pptx-svelte-follow-peer-active {
		border-color: var(--pptx-primary, #6366f1);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 30%, transparent);
	}

	.pptx-svelte-follow-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 9999px;
		color: #ffffff;
		font-size: 10px;
		font-weight: 600;
		line-height: 1;
	}

	.pptx-svelte-follow-name {
		max-width: 120px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
