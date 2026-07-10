import type { PptxSlideTransition } from 'pptx-viewer-core';
import { resolveSlideTransition, resolveTransitionDurationMs } from 'pptx-viewer-shared';

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
	overlay.style.position = 'absolute';
	overlay.style.inset = '0';
	overlay.style.overflow = 'hidden';
	overlay.style.pointerEvents = 'none';
	overlay.style.zIndex = '30';

	const outLayer = buildLayer(doc, outgoing, resolved.outgoingOnTop ? 2 : 1, resolved.outgoing);
	const inLayer = buildLayer(doc, incoming, resolved.outgoingOnTop ? 1 : 2, resolved.incoming);
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
): HTMLElement {
	const layer = doc.createElement('div');
	layer.className = 'pptxv-transition-layer';
	layer.style.position = 'absolute';
	layer.style.top = '0';
	layer.style.left = '0';
	layer.style.overflow = 'hidden';
	layer.style.zIndex = String(zIndex);
	layer.style.willChange = 'transform, opacity, clip-path, filter';
	if (animation !== 'none') {
		layer.style.animation = animation;
	}
	layer.appendChild(stage);
	return layer;
}
