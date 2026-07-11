/**
 * collaboration-presence-effects.svelte.ts: publishes local active-slide and
 * selection changes into the collaboration session, and drives follow-mode
 * navigation when the local user is following a peer. Extracted from
 * `PowerPointViewer.svelte` (matching the `usePresentationEffects` /
 * `useViewerEffects` composable pattern already used there) to keep that
 * root component within the file-size budget.
 */
import type { CollaborationController } from './collaboration.svelte';

export interface CollaborationPresenceEffectsDeps {
	collab: CollaborationController;
	getCurrentSlide: () => number;
	getSelectedElementId: () => string | null;
	goTo: (index: number) => void;
}

export function useCollaborationPresenceEffects(deps: CollaborationPresenceEffectsDeps): void {
	// Publish local active-slide/selection changes.
	$effect(() => {
		if (deps.collab.active) {
			deps.collab.setActiveSlide(deps.getCurrentSlide());
		}
	});
	$effect(() => {
		if (deps.collab.active) {
			deps.collab.setSelection(deps.getSelectedElementId() ?? undefined, deps.getCurrentSlide());
		}
	});
	// Drive follow-mode navigation.
	$effect(() => {
		const followedId = deps.collab.followedClientId;
		if (followedId === null) {
			return;
		}
		const peer = deps.collab.remotePresences.find((p) => p.clientId === followedId);
		if (peer && peer.activeSlideIndex !== deps.getCurrentSlide()) {
			deps.goTo(peer.activeSlideIndex);
		}
	});
}
