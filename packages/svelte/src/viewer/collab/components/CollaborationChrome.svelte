<script lang="ts">
	/**
	 * CollaborationChrome: composes the follow-mode bar, connection status pill,
	 * and the Share/Broadcast dialogs into a single mount point. Extracted out
	 * of `PowerPointViewer.svelte` (which wires several other unrelated
	 * concerns already) to keep that file within the repo's file-size budget;
	 * this component owns no state of its own beyond what it's handed.
	 */
	import type { CollaborationConfig } from 'pptx-viewer-shared';

	import type { CollaborationController } from '../collaboration.svelte';
	import type { CollaborationDialogsState, ShareDefaultsInput } from '../collaboration-dialogs.svelte';
	import BroadcastDialog from './BroadcastDialog.svelte';
	import CollaborationStatusIndicator from './CollaborationStatusIndicator.svelte';
	import FollowModeBar from './FollowModeBar.svelte';
	import ShareDialog from './ShareDialog.svelte';

	const {
		collab,
		dialogs,
		shareDefaults,
		showOverlay,
		collaboration,
	}: {
		collab: CollaborationController;
		dialogs: CollaborationDialogsState;
		shareDefaults?: ShareDefaultsInput;
		/** Show the floating follow-bar/status overlay (active session + chrome visible). */
		showOverlay: boolean;
		/** The host's live `collaboration` prop, used to retry after a connection error. */
		collaboration: CollaborationConfig | undefined;
	} = $props();
</script>

{#if showOverlay}
	<div class="pptx-svelte-collab-overlay">
		<FollowModeBar
			presences={collab.remotePresences}
			followedClientId={collab.followedClientId}
			onfollow={(clientId) => collab.followUser(clientId)}
		/>
		<div class="pptx-svelte-collab-status-pill">
			<CollaborationStatusIndicator
				status={collab.status}
				connectedCount={dialogs.connectedCount}
				onretry={() => dialogs.retry(collaboration)}
			/>
		</div>
	</div>
{/if}
<ShareDialog
	open={dialogs.shareOpen}
	defaults={shareDefaults}
	active={collab.active}
	onstart={dialogs.onShareStart}
	onstop={dialogs.onShareStop}
	onclose={() => (dialogs.shareOpen = false)}
/>
<BroadcastDialog
	open={dialogs.broadcastOpen}
	defaults={{ serverUrl: shareDefaults?.serverUrl }}
	active={collab.active}
	viewerUrl={dialogs.broadcastViewerUrl}
	onstart={dialogs.onBroadcastStart}
	onstop={dialogs.onBroadcastStop}
	onclose={() => (dialogs.broadcastOpen = false)}
/>

<style>
	.pptx-svelte-collab-overlay {
		position: absolute;
		right: 8px;
		bottom: 8px;
		left: 8px;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;
		pointer-events: none;
	}

	.pptx-svelte-collab-overlay :global(.pptx-svelte-follow-bar) {
		pointer-events: auto;
	}

	.pptx-svelte-collab-status-pill {
		flex-shrink: 0;
		pointer-events: auto;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 9999px;
		background: color-mix(in srgb, var(--pptx-background, #11111b) 90%, transparent);
		padding: 4px 10px;
		backdrop-filter: blur(4px);
	}
</style>
