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
		mobileBarVisible = false,
	}: {
		collab: CollaborationController;
		dialogs: CollaborationDialogsState;
		shareDefaults?: ShareDefaultsInput;
		/** Show the floating follow-bar overlay (active session + chrome visible). */
		showOverlay: boolean;
		/**
		 * True while the phone bottom action bar is mounted, so the follow bar
		 * can stack above it instead of covering it.
		 */
		mobileBarVisible?: boolean;
	} = $props();
</script>

{#if showOverlay}
	<div class="pptx-svelte-collab-overlay" class:has-mobile-bar={mobileBarVisible}>
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
		bottom: calc(8px + env(safe-area-inset-bottom, 0px));
		left: 8px;
		z-index: 51;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;
		pointer-events: none;
	}

	.pptx-svelte-collab-overlay :global(.pptx-svelte-follow-bar) {
		pointer-events: auto;
	}

	/*
	 * Phone layout: `MobileActionSheets` pins its 64px action bar (plus the iOS
	 * home-indicator inset it pads itself with) to the bottom edge, and the
	 * collab chrome renders after it, so a bottom-anchored follow bar painted
	 * straight over it. Stack the follow bar above the bar instead, the way
	 * React keeps the two apart by pinning its own follow bar clear of the
	 * bottom action bar entirely.
	 */
	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-collab-overlay.has-mobile-bar {
			bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		}
	}
</style>
