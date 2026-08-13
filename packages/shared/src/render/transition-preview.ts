/**
 * `transition-preview` - Transitions > Preview, as one behaviour every binding
 * calls instead of five different non-behaviours.
 *
 * WHY shared, and why it does not simply re-commit the transition: the button
 * was a no-op in vanilla, started the whole slide show in angular, and in
 * react/vue/svelte re-committed the slide's OWN transition, which writes the
 * values the slide already had. That last one is a no-op the user can see
 * nothing of, and no assertion can tell it apart from the vanilla version. What
 * PowerPoint's Preview does is REPLAY the transition on the slide being edited,
 * without touching the deck, so that is what this does.
 *
 * The replay is built out of the same `slide-transition-css` animation the
 * presentation overlay plays, so a preview cannot drift from the real thing.
 * Two layers are added INSIDE the stage element (never around it: the stage
 * carries the editor's `transform: scale(...)`, and a CSS animation that
 * animates `transform` on that element would drop the zoom for the length of
 * the preview, which is what a first attempt at this did):
 *
 *  1. a cover painted with the stage's own background, hiding the slide, and
 *  2. a static clone of the slide's content, animated with the transition's
 *     INCOMING animation, so the content arrives exactly as it would in a show.
 *
 * Both layers are inert (`aria-hidden`, `pointer-events: none`, and stripped of
 * the `data-element-id` markers the specs count) and are removed when the
 * animation ends. While a preview is running the stage carries
 * `data-pptx-transition-preview="<type>"`, which is the framework-neutral hook
 * the e2e suite asserts on: a Preview button wired to nothing never sets it.
 *
 * @module render/transition-preview
 */
import type { PptxSlideTransition } from 'pptx-viewer-core';

import { resolveSlideTransition, resolveTransitionDurationMs } from './slide-transition-css';
import { SLIDE_TRANSITION_KEYFRAMES } from './slide-transition-keyframes';

/** Marks the stage element for as long as a preview is playing. */
export const TRANSITION_PREVIEW_ATTR = 'data-pptx-transition-preview';

/** `id` of the one `<style>` element the preview injects per document. */
const KEYFRAMES_STYLE_ID = 'pptx-transition-preview-keyframes';

/** Class on both preview layers, so a stale one is always findable. */
const LAYER_CLASS = 'pptx-transition-preview-layer';

/**
 * The slide the user is editing.
 *
 * `aria-roledescription="slide"` is the region marker all five bindings emit
 * and every framework-neutral spec already selects on; thumbnails reuse it in
 * some bindings, and all five render the main canvas ahead of the rail, so the
 * FIRST match is the editing surface.
 */
export function findSlideStage(doc: Document): HTMLElement | null {
	return doc.querySelector<HTMLElement>('[aria-roledescription="slide"]');
}

function ensureKeyframes(doc: Document): void {
	if (doc.getElementById(KEYFRAMES_STYLE_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = KEYFRAMES_STYLE_ID;
	style.textContent = SLIDE_TRANSITION_KEYFRAMES;
	(doc.head ?? doc.body ?? doc.documentElement).appendChild(style);
}

/** Remove any layers (and marker) a previous preview left behind. */
function clearPreview(stage: HTMLElement): void {
	stage.removeAttribute(TRANSITION_PREVIEW_ATTR);
	for (const layer of stage.querySelectorAll(`.${LAYER_CLASS}`)) {
		layer.remove();
	}
}

function makeLayer(doc: Document, zIndex: number): HTMLElement {
	const layer = doc.createElement('div');
	layer.className = LAYER_CLASS;
	layer.setAttribute('aria-hidden', 'true');
	layer.style.position = 'absolute';
	layer.style.inset = '0';
	layer.style.overflow = 'hidden';
	layer.style.pointerEvents = 'none';
	layer.style.zIndex = String(zIndex);
	return layer;
}

/**
 * A copy of the stage's current content, safe to leave in the DOM for a moment.
 *
 * The `data-element-id` / `data-pptx-element` markers come off every node: they
 * are how the bindings' own hit-testing and the e2e suite count the elements on
 * a slide, and a clone that kept them would double every count for the length
 * of the preview.
 */
function cloneStageContent(doc: Document, stage: HTMLElement): HTMLElement {
	const holder = doc.createElement('div');
	holder.style.position = 'absolute';
	holder.style.inset = '0';
	for (const child of stage.children) {
		if (child.classList.contains(LAYER_CLASS)) {
			continue;
		}
		holder.appendChild(child.cloneNode(true));
	}
	for (const node of holder.querySelectorAll('[data-element-id], [data-pptx-element]')) {
		node.removeAttribute('data-element-id');
		node.removeAttribute('data-pptx-element');
	}
	return holder;
}

/**
 * Replay `transition` on the slide stage. Returns false when there is nothing
 * to play (no stage, no transition, or an instant one), so a caller can leave
 * the control inert rather than pretending.
 */
export function playSlideTransitionPreview(
	transition: PptxSlideTransition | undefined,
	doc: Document,
): boolean {
	const stage = findSlideStage(doc);
	if (!stage || !transition || !transition.type || transition.type === 'none') {
		return false;
	}
	const animations = resolveSlideTransition(transition);
	const durationMs = resolveTransitionDurationMs(transition);
	if (animations.incoming === 'none' || durationMs <= 0) {
		return false;
	}

	ensureKeyframes(doc);
	clearPreview(stage);

	// The stage is `position: relative` in every binding (it hosts absolutely
	// positioned elements), but a preview must not depend on that holding.
	if (doc.defaultView?.getComputedStyle(stage).position === 'static') {
		stage.style.position = 'relative';
	}

	const cover = makeLayer(doc, 40);
	cover.style.background = doc.defaultView?.getComputedStyle(stage).backgroundColor || '#ffffff';
	const incoming = makeLayer(doc, 41);
	incoming.appendChild(cloneStageContent(doc, stage));
	incoming.style.animation = animations.incoming;

	stage.setAttribute(TRANSITION_PREVIEW_ATTR, transition.type);
	stage.append(cover, incoming);

	const finish = (): void => {
		clearPreview(stage);
	};
	incoming.addEventListener('animationend', finish, { once: true });
	// Belt and braces: an animation that never fires `animationend` (a hidden
	// tab, a reduced-motion override) must not leave the slide covered.
	doc.defaultView?.setTimeout(finish, durationMs + 400);
	return true;
}
