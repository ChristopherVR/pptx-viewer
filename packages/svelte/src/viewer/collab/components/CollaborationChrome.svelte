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
	/*
	 * Anchored to the TOP centre, matching every other binding: React renders
	 * its follow bar in a `fixed inset-x-0 top-2 z-[1100]` centring wrapper, and
	 * Angular and Vanilla pin theirs to `top: 8px; left: 50%`. Svelte used to
	 * anchor it to the bottom, which on a phone painted it straight over the
	 * 64px `MobileActionSheets` action bar (same z-index, and the collab chrome
	 * renders after it), swallowing those five tap targets. Anchoring to the top
	 * both frees the bottom bar and puts the bar where the other four bindings
	 * already put it.
	 */
	.pptx-svelte-collab-overlay {
		position: absolute;
		top: calc(8px + env(safe-area-inset-top, 0px));
		right: 8px;
		left: 8px;
		z-index: 51;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 8px;
		pointer-events: none;
	}

	.pptx-svelte-collab-overlay :global(.pptx-svelte-follow-bar) {
		pointer-events: auto;
	}
</style>
