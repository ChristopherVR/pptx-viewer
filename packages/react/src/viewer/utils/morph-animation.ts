/**
 * Morph animation surface for React.
 *
 * The pure CSS-keyframe generators now live in `pptx-viewer-shared`
 * (`render/morph-animation`) and are re-exported here. The only genuinely
 * view/DOM-bound pieces (injecting and cleaning up the generated `<style>`
 * keyframes in the document) stay in this binding.
 *
 * @module utils/morph-animation
 */
import type { MorphAnimationStyle } from 'pptx-viewer-shared';

export {
	buildColorInterpolationProps,
	buildStrokeInterpolationProps,
	generateMorphAnimations,
	generateUnmatchedFadeOutAnimations,
	generateUnmatchedFadeInAnimations,
	generateTextMorphAnimations,
	generateFullMorphTransition,
} from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Inject morph keyframes into the document (DOM-bound; stays in React)
// ---------------------------------------------------------------------------

let morphStyleElement: HTMLStyleElement | null = null;

/**
 * Inject morph keyframe CSS into the document's `<head>`.
 * Removes any previously injected morph styles first.
 *
 * @param animations - The animation style descriptors whose keyframes to inject.
 */
export function injectMorphKeyframes(animations: MorphAnimationStyle[]): void {
	if (morphStyleElement) {
		morphStyleElement.remove();
		morphStyleElement = null;
	}

	if (animations.length === 0) {
		return;
	}

	const css = animations.map((a) => a.keyframes).join('\n');
	morphStyleElement = document.createElement('style');
	morphStyleElement.textContent = css;
	document.head.appendChild(morphStyleElement);
}

/**
 * Remove any previously injected morph keyframe styles from the document.
 */
export function cleanupMorphKeyframes(): void {
	if (morphStyleElement) {
		morphStyleElement.remove();
		morphStyleElement = null;
	}
}
