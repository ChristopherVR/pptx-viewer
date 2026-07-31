import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	buildMorphScopedCss,
	buildMorphTransitionPlan,
	morphOptionToMode,
	resolveSlideTransition,
	resolveTransitionDurationMs,
} from 'pptx-viewer-shared';

import { ensurePresentationKeyframes } from './animation-dom';

export interface TransitionOverlayParams {
	doc: Document;
	/** The stage host the overlay is layered into (position: relative). */
	stageWrap: HTMLElement;
	/** The detached outgoing (previous) stage node, re-attached as a snapshot. */
	outgoing: HTMLElement;
	/** A fully-visible clone of the incoming (new) stage node. */
	incoming: HTMLElement;
	/** The incoming slide's transition definition. */
	transition: PptxSlideTransition;
	/** The outgoing slide model. Required to play a Morph transition. */
	outgoingSlide?: PptxSlide;
	/** The incoming slide model. Required to play a Morph transition. */
	incomingSlide?: PptxSlide;
	/** Called once the transition duration elapses (or the overlay is cancelled). */
	onDone: () => void;
}

/**
 * Play a slide-change transition in presentation mode by stacking the outgoing
 * snapshot and the incoming clone as two absolutely-positioned layers over the
 * stage, each driven by the shared `resolveSlideTransition` CSS `animation`
 * shorthand. After the resolved duration the overlay removes itself and calls
 * `onDone`.
 *
 * Returns a cancel function that tears the overlay down immediately (used when
 * the stage is rebuilt again before the transition finishes).
 */
export function playTransitionOverlay(params: TransitionOverlayParams): () => void {
	const { doc, stageWrap, outgoing, incoming, transition } = params;
	ensurePresentationKeyframes(doc);

	const resolved = resolveSlideTransition(transition);
	const durationMs = resolveTransitionDurationMs(transition);

	const overlay = doc.createElement('div');
	overlay.className = 'pptxv-transition-overlay';
	overlay.dataset.pptxTransitionOverlay = '';
	overlay.style.position = 'absolute';
	overlay.style.inset = '0';
	overlay.style.overflow = 'hidden';
	overlay.style.pointerEvents = 'none';
	overlay.style.zIndex = '30';

	// Morph moves individual shapes between the two slides instead of wiping the
	// whole surface. When a plan is available the layers stay unanimated (a
	// layer-wide animation would drag every shape as one block), the incoming
	// layer plays per-element keyframes, and every shape in the outgoing snapshot
	// glides onto its counterpart - dissolving into it when its appearance
	// changed, or fading out in place when it has none.
	const morphPlan =
		transition.type === 'morph'
			? buildMorphTransitionPlan(
					params.outgoingSlide,
					params.incomingSlide,
					durationMs,
					morphOptionToMode(transition.morphOption),
				)
			: undefined;

	const outLayer = buildLayer(
		doc,
		outgoing,
		morphPlan ? 2 : resolved.outgoingOnTop ? 2 : 1,
		morphPlan ? 'none' : resolved.outgoing,
		'outgoing',
	);
	const inLayer = buildLayer(
		doc,
		incoming,
		morphPlan ? 1 : resolved.outgoingOnTop ? 1 : 2,
		morphPlan ? 'none' : resolved.incoming,
		'incoming',
	);

	if (morphPlan) {
		inLayer.dataset.pptxMorphIncoming = 'true';
		outLayer.dataset.pptxMorphOutgoing = 'true';
		// The departing snapshot only carries the morphing shapes and sits ABOVE
		// the incoming slide, so it must not keep the outgoing slide's own
		// background: `getSlideBackgroundStyle` always resolves to an OPAQUE fill,
		// which would cover the whole morph with a flat slab for its duration.
		outgoing.style.background = 'none';
		outgoing.style.backgroundColor = 'transparent';
		const keep = new Set(morphPlan.outgoingElements.map((element) => element.id));
		for (const node of outgoing.querySelectorAll<HTMLElement>('[data-element-id]')) {
			const id = node.dataset.elementId;
			if (id !== undefined && !keep.has(id)) {
				node.remove();
			}
		}
		const style = doc.createElement('style');
		style.textContent = [
			buildMorphScopedCss(morphPlan, 'data-pptx-morph-incoming', 'incoming'),
			buildMorphScopedCss(morphPlan, 'data-pptx-morph-outgoing', 'outgoing'),
		].join('\n');
		overlay.appendChild(style);
	}

	overlay.append(outLayer, inLayer);
	stageWrap.appendChild(overlay);

	let done = false;
	const finish = (): void => {
		if (done) {
			return;
		}
		done = true;
		clearTimeout(timer);
		overlay.remove();
		params.onDone();
	};

	// A small buffer past the animation duration lets the CSS `forwards` fill
	// settle before the host reveals the static incoming stage underneath.
	const timer = setTimeout(finish, Math.max(0, durationMs) + 50);

	return finish;
}

function buildLayer(
	doc: Document,
	stage: HTMLElement,
	zIndex: number,
	animation: string,
	state: 'outgoing' | 'incoming',
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
