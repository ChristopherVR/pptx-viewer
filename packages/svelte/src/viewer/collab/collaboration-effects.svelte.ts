/**
 * The three `$effect`s the collaboration controller registers on construction,
 * lifted out of `collaboration.svelte.ts` to keep that file inside the repo's
 * 300 LOC ceiling. They are pure wiring: every piece of state they touch is
 * reached through the {@link CollaborationEffectsHost} callbacks, so this module
 * holds no state of its own.
 */

import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { registerCollaborationTeardown } from 'pptx-viewer-shared';

export interface CollaborationEffectsHost {
	getConfig: () => CollaborationConfig | undefined;
	getSlides: () => PptxSlide[];
	syncConfig: (config: CollaborationConfig | undefined) => void;
	isPublishable: () => boolean;
	flushLocalSlides: (slides: PptxSlide[]) => void;
	stop: () => void;
	rejoin: () => void;
}

/**
 * Register the controller's effects. Call from the constructor, inside the
 * component's reactive scope.
 */
export function registerCollaborationEffects(host: CollaborationEffectsHost): void {
	// Auto start/stop when the host supplies (or clears) a config. Compared by
	// reference so re-emitting the same object does not restart the session.
	$effect(() => {
		host.syncConfig(host.getConfig());
	});

	// Broadcast local slide edits granularly. Reading the active flag re-runs the
	// effect on (de)activation; the gate + role checks live in the flush.
	$effect(() => {
		const slides = host.getSlides();
		if (host.isPublishable()) {
			host.flushLocalSlides(slides);
		}
	});

	// Component destruction is not the only way a session ends: a tab close, a
	// navigation, or an embedding page detaching the viewer's iframe destroys the
	// document without running any Svelte cleanup, leaving a ghost peer in
	// everyone else's presence list. Leave the room from `pagehide` too; the
	// effect's return value unregisters the listeners on destroy.
	$effect(() => registerCollaborationTeardown({ leave: host.stop, rejoin: host.rejoin }));
}
