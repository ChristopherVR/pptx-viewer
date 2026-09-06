import {
	ANIMATION_KEYFRAMES_CSS,
	buildTextStyleOverrideCss,
	PRESENTATION_HIT_TEST_CSS,
	SLIDE_TRANSITION_KEYFRAMES_CSS,
} from 'pptx-viewer-shared';
import type { ElementAnimationState } from 'pptx-viewer-shared';

import { applyChart3DTextStyle } from '../render/elements/chart-3d-text-style-registry';

/** Marker attribute on the `<style>` child a text-style override patches in place. */
const TEXT_STYLE_OVERRIDE_ATTR = 'data-pptx-text-style-override';

/**
 * Create/update/remove `el`'s scoped font-style-emphasis override `<style>`
 * child (Bold Flash, Bold Reveal, Underline, Change Font Style/Size), which
 * OVERRIDES the runs' own inline bold/italic/underline/size since plain CSS
 * inheritance cannot reach them. See `animation-text-style-css.ts`.
 *
 * Also forwards the same descriptor to a mounted 3D chart/SmartArt3D scene's
 * own `setTextStyle` (via `chart-3d-text-style-registry.ts`): its axis labels
 * / node captions are canvas-drawn textures the CSS override above can never
 * reach, so the registry lookup is the robust path for those elements
 * regardless of whether the (harmless) CSS override also runs.
 */
function applyTextStyleOverride(
	el: HTMLElement,
	id: string,
	state: ElementAnimationState | undefined,
): void {
	applyChart3DTextStyle(el.ownerDocument, id, state?.textStyle);
	const css = buildTextStyleOverrideCss(id, state?.textStyle);
	let styleTag = el.querySelector<HTMLStyleElement>(`:scope > style[${TEXT_STYLE_OVERRIDE_ATTR}]`);
	if (!css) {
		styleTag?.remove();
		return;
	}
	if (!styleTag) {
		styleTag = el.ownerDocument.createElement('style');
		styleTag.setAttribute(TEXT_STYLE_OVERRIDE_ATTR, '');
		el.prepend(styleTag);
	}
	styleTag.textContent = css;
}

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
	// Plus the show's hit-testing rule: scenery is pointer-transparent so a click
	// reaches the action shape underneath it (or the show's own advance).
	style.textContent = `${ANIMATION_KEYFRAMES_CSS}\n${SLIDE_TRANSITION_KEYFRAMES_CSS}\n${PRESENTATION_HIT_TEST_CSS}`;
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
		applyTextStyleOverride(el, id, state);
	});

	// Staged text builds render one span per paragraph / word / letter, keyed
	// `data-anim-id` (`<elementId>::c0-3`) rather than `data-element-id`. They
	// need the same per-frame patch or the pieces stay at whatever state they
	// were first rendered with and the build never visibly runs.
	root.querySelectorAll<HTMLElement>('[data-anim-id]').forEach((el) => {
		const id = el.dataset.animId;
		if (!id) {
			return;
		}
		const state = states.get(id);
		el.style.animation = state?.cssAnimation ?? '';
		el.style.visibility = state?.visible === false ? 'hidden' : '';
	});
}
