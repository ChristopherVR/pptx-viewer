import { ANIMATION_KEYFRAMES_CSS, SLIDE_TRANSITION_KEYFRAMES_CSS } from 'pptx-viewer-shared';
import type { ElementAnimationState } from 'pptx-viewer-shared';

/** `<style>` id for the once-per-document static presentation keyframe block. */
const KEYFRAMES_ELEMENT_ID = 'pptx-vanilla-presentation-keyframes';
/** `<style>` id for the per-slide native-timeline (`p:timing`) keyframe block. */
const SLIDE_KEYFRAMES_ELEMENT_ID = 'pptx-vanilla-slide-keyframes';

/**
 * Inject the static entrance-animation and slide-transition `@keyframes` blocks
 * into a document's `<head>` exactly once. Both binding-agnostic keyframe sets
 * live in `pptx-viewer-shared`; the slide-transition overlays reference them by
 * name. Idempotent per document.
 */
export function ensurePresentationKeyframes(doc: Document): void {
	if (doc.getElementById(KEYFRAMES_ELEMENT_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = KEYFRAMES_ELEMENT_ID;
	style.textContent = `${ANIMATION_KEYFRAMES_CSS}\n${SLIDE_TRANSITION_KEYFRAMES_CSS}`;
	(doc.head ?? doc.documentElement).appendChild(style);
}

/**
 * Inject (or replace) the current slide's native-timeline `@keyframes` CSS, as
 * derived by the {@link PresentationAnimationController}. The controller's
 * `keyframesCss` is self-contained (it carries every rule its `cssAnimation`
 * shorthands reference, including `p:animClr` colour keyframes and staged
 * text-build sub-keyframes), so a single per-slide `<style>` element is swapped
 * on each slide entry. An empty string clears the block.
 */
export function injectSlideKeyframes(doc: Document, css: string): void {
	let style = doc.getElementById(SLIDE_KEYFRAMES_ELEMENT_ID) as HTMLStyleElement | null;
	if (!css) {
		style?.remove();
		return;
	}
	if (!style) {
		style = doc.createElement('style');
		style.id = SLIDE_KEYFRAMES_ELEMENT_ID;
		(doc.head ?? doc.documentElement).appendChild(style);
	}
	style.textContent = css;
}

/**
 * Apply each tracked element's native-animation state to its DOM wrapper under
 * `root`, keyed by `data-element-id`: the CSS-animation shorthand (entrance /
 * emphasis / exit / colour keyframes), visibility (entrance hide-until-revealed
 * / exit), and a pointer cursor on interactive / hover trigger shapes.
 *
 * Structural reveals (staged chart / SmartArt build, `p:animClr` fill / stroke
 * relinquish) are applied by RE-RENDERING the affected elements, not here; this
 * pass owns only the cheap per-node style patch, so running CSS animations are
 * never restarted by an unrelated element's state change. Mirrors the Vue
 * binding's `PresentationMode` `applyAnimationStyles`.
 */
export function applyElementAnimationStyles(
	root: HTMLElement,
	states: ReadonlyMap<string, ElementAnimationState>,
	interactiveTriggerShapeIds: ReadonlySet<string>,
	hoverTriggerShapeIds: ReadonlySet<string>,
): void {
	root.querySelectorAll<HTMLElement>('[data-element-id]').forEach((el) => {
		const id = el.dataset.elementId;
		if (!id) {
			return;
		}
		const state = states.get(id);
		el.style.animation = state?.cssAnimation ?? '';
		el.style.visibility = state?.visible === false ? 'hidden' : '';
		el.style.cursor =
			interactiveTriggerShapeIds.has(id) || hoverTriggerShapeIds.has(id) ? 'pointer' : '';
	});
}
