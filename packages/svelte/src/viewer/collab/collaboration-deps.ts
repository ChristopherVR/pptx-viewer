/**
 * collaboration-deps.ts: the host-dependency seam for `CollaborationController`.
 * Split from `collaboration.svelte.ts` purely to keep that class within the
 * repo's file-size budget; no runtime code lives here.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig } from 'pptx-viewer-shared';

import type { CollabSessionFactory } from './collaboration-session';

export interface CollaborationDeps {
	/** Read the current local slides (broadcast granularly on change). */
	getSlides: () => PptxSlide[];
	/** Apply a remote peer's slide snapshot into the editable slides. */
	applyRemoteSlides: (slides: PptxSlide[]) => void;
	/** Live host `collaboration` config; watched to auto start/stop a session. */
	getConfig: () => CollaborationConfig | undefined;
	/** Return the loaded source bytes for elected-writer (role 'owner') write-back. */
	getSourceBytes?: () => Uint8Array | null;
	/** Slide canvas width/height (unscaled px), used to clamp incoming cursor coordinates. */
	getCanvasWidth?: () => number | undefined;
	getCanvasHeight?: () => number | undefined;
	/** Fired when a session starts (host observability). */
	onStart?: (config: CollaborationConfig) => void;
	/** Fired when a session stops (host observability). */
	onStop?: () => void;
	/** Session factory seam (defaults to the real yjs + transport wiring). */
	createSession?: CollabSessionFactory;
}
