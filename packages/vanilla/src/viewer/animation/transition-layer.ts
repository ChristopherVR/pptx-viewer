/**
 * Build one non-fragmented transition layer: an absolutely-positioned,
 * clipped wrapper around a stage snapshot, carrying the resolved CSS
 * `animation` shorthand. Shared by the morph and non-morph paths in
 * `transition-overlay.ts` and by `morph-transition-layers.ts`'s crossfade
 * groups.
 */
export function buildLayer(
	doc: Document,
	stage: HTMLElement,
	zIndex: number,
	animation: string,
	state: 'outgoing' | 'incoming' | 'lifted',
): HTMLElement {
	const layer = doc.createElement('div');
	layer.className = 'pptxv-transition-layer';
	layer.dataset.pptxTransitionLayer = state;
	layer.style.position = 'absolute';
	// `inset`, not `top`/`left`: the stage inside scales with a CSS `transform`,
	// which never changes its laid-out box, so an auto-sized layer measures the
	// deck's NATIVE size (e.g. 1280x720) while the stage paints the display size
	// (1920x1080). With `overflow: hidden` that crops the transition to a
	// deck-sized top-left corner and the rest of the screen cuts straight to the
	// next slide. Pinning to the overlay puts the clip on the slide edge.
	layer.style.inset = '0';
	layer.style.overflow = 'hidden';
	layer.style.zIndex = String(zIndex);
	layer.style.willChange = 'transform, opacity, clip-path, filter';
	if (animation !== 'none') {
		layer.style.animation = animation;
	}
	layer.appendChild(stage);
	return layer;
}
