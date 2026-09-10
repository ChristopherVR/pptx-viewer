import type { FragmentedLayer, TransitionFragment } from 'pptx-viewer-shared';

/**
 * Build one transition layer (outgoing or incoming) as N clipped clones of the
 * stage node - the Vanilla mapping of the seven multi-fragment cinematic
 * transitions (`vortex`, `honeycomb`, `glitter`, `shred`, `fracture`,
 * `curtains`, `airplane`; see `slide-transition-fragments.ts` in
 * pptx-viewer-shared for the COM measurement and the pure decision function
 * this maps).
 *
 * Every fragment is `position: absolute` + `clip-path` + a shared
 * `@keyframes` animation (already injected via `ensurePresentationKeyframes`)
 * parameterised by CSS custom properties, so the whole set stays
 * transform/opacity-only and GPU-composited with no per-frame JS. Mirrors the
 * React binding's `FragmentedTransitionLayer.tsx`.
 *
 * Unlike `buildLayer` in `transition-overlay.ts` (which consumes the single
 * `stage` node directly), this clones `stage` once per fragment: N
 * independently-animated copies need N independent DOM subtrees.
 */
export function buildFragmentedLayer(
	doc: Document,
	stage: HTMLElement,
	layer: FragmentedLayer,
	zIndex: number,
	state: 'outgoing' | 'incoming',
): HTMLElement {
	const container = doc.createElement('div');
	container.className = 'pptxv-transition-layer';
	container.dataset.pptxTransitionLayer = state;
	container.dataset.pptxTransitionFragments = layer.keyframesName;
	container.style.position = 'absolute';
	container.style.inset = '0';
	container.style.overflow = 'hidden';
	container.style.pointerEvents = 'none';
	container.style.zIndex = String(zIndex);

	for (const fragment of layer.fragments) {
		container.appendChild(buildFragment(doc, stage, layer, fragment));
	}
	return container;
}

function buildFragment(
	doc: Document,
	stage: HTMLElement,
	layer: FragmentedLayer,
	fragment: TransitionFragment,
): HTMLElement {
	const el = doc.createElement('div');
	el.dataset.pptxTransitionFragment = fragment.id;
	el.style.position = 'absolute';
	el.style.inset = '0';
	el.style.clipPath = fragment.clipPath;
	el.style.transformOrigin = fragment.transformOrigin;
	el.style.animationName = layer.keyframesName;
	el.style.animationDuration = `${layer.durationMs}ms`;
	el.style.animationTimingFunction = layer.easing;
	el.style.animationDelay = `${fragment.delayMs}ms`;
	el.style.animationFillMode = 'forwards';
	el.style.willChange = 'transform, opacity';
	for (const [key, value] of Object.entries(fragment.vars)) {
		el.style.setProperty(key, value);
	}
	el.appendChild(stage.cloneNode(true) as HTMLElement);
	return el;
}
