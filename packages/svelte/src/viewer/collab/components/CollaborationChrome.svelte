<script lang="ts">
	/**
	 * CollaborationChrome: composes the follow-mode bar, connection status pill,
	 * and the Share/Broadcast dialogs into a single mount point. Extracted out
	 * of `PowerPointViewer.svelte` (which wires several other unrelated
	 * concerns already) to keep that file within the repo's file-size budget;
	 * this component owns no state of its own beyond what it's handed.
	 */
	import type { CollaborationController } from '../collaboration.svelte';
	import type { CollaborationDialogsState, ShareDefaultsInput } from '../collaboration-dialogs.svelte';
	import BroadcastDialog from './BroadcastDialog.svelte';
	import FollowModeBar from './FollowModeBar.svelte';
	import ShareDialog from './ShareDialog.svelte';

	const {
		collab,
		dialogs,
		shareDefaults,
		showOverlay,
	}: {
		collab: CollaborationController;
		dialogs: CollaborationDialogsState;
		shareDefaults?: ShareDefaultsInput;
		/** Show the floating follow-bar overlay (active session + chrome visible). */
		showOverlay: boolean;
	} = $props();
</script>

{#if showOverlay}
	<div class="pptx-svelte-collab-overlay">
		<FollowModeBar
			presences={collab.remotePresences}
			followedClientId={collab.followedClientId}
			onfollow={(clientId) => collab.followUser(clientId)}
		/>
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
</style>
