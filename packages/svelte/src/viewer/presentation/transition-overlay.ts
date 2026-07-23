import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import type { Component } from 'svelte';

import PresentationTransitionOverlayComponent from './PresentationTransitionOverlay.svelte';

/** Props for {@link PresentationTransitionOverlay}. */
export interface PresentationTransitionOverlayProps {
	outgoingSlide: PptxSlide | undefined;
	incomingSlide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	scale?: number;
	transition: PptxSlideTransition | undefined;
	ondone: () => void;
}

/**
 * Explicitly-typed public export of the transition overlay.
 *
 * Same rationale as `viewer/components/typed-exports.ts`: a raw `.svelte`
 * re-export from a barrel leaves an unresolvable `.svelte` specifier in the
 * emitted declarations (no `.svelte.d.ts` is produced), which breaks the
 * post-build Rollup declaration bundling on CI.
 */
export const PresentationTransitionOverlay: Component<PresentationTransitionOverlayProps> =
	PresentationTransitionOverlayComponent as unknown as Component<PresentationTransitionOverlayProps>;
