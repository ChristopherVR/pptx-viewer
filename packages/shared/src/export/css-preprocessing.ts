/**
 * CSS preprocessing for print/export fidelity, shared by every binding's export
 * pipeline. Pure DOM helpers (no framework imports).
 *
 * html2canvas has limited CSS support. These utilities pre-process problematic
 * CSS features before capture:
 *
 * - oklch/oklab/lch/lab/color() colours (handled separately by `canvas-export`)
 * - CSS custom properties (resolved to computed values)
 * - backdrop-filter / mix-blend-mode (replaced with fallbacks)
 * - complex CSS transforms that html2canvas struggles with
 * - modern CSS features (container queries, @layer, etc.)
 *
 * All functions operate on cloned DOM trees (never the live document) and are
 * designed to be called from html2canvas's `onclone` callback.
 */

import {
	flatten3dTransforms,
	flattenBackdropFilter,
	flattenMixBlendMode,
	removeUnsupportedFeatures,
} from './css-preprocessing-flatten';

export {
	parseBlurValue,
	flattenBackdropFilter,
	flattenMixBlendMode,
	has3dTransform,
	flatten3dTransform,
	flatten3dTransforms,
	removeUnsupportedFeatures,
} from './css-preprocessing-flatten';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Options for CSS preprocessing. */
export interface CssPreprocessingOptions {
	/** Resolve CSS custom properties to computed values. Default: true. */
	resolveCustomProperties?: boolean;
	/** Flatten backdrop-filter to background equivalents. Default: true. */
	flattenBackdropFilter?: boolean;
	/** Replace mix-blend-mode with opacity fallback. Default: true. */
	flattenMixBlendMode?: boolean;
	/** Flatten 3D transforms to 2D equivalents. Default: true. */
	flatten3dTransforms?: boolean;
	/** Remove CSS features unsupported by html2canvas. Default: true. */
	removeUnsupportedFeatures?: boolean;
}

/* ------------------------------------------------------------------ */
/*  CSS Custom Property Resolution                                     */
/* ------------------------------------------------------------------ */

/**
 * CSS properties that commonly reference custom properties (var()).
 * We resolve these to their computed values so html2canvas can
 * interpret them correctly.
 */
const VAR_DEPENDENT_PROPERTIES: readonly string[] = [
	'color',
	'background-color',
	'background',
	'background-image',
	'border-color',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'outline-color',
	'box-shadow',
	'text-shadow',
	'opacity',
	'font-size',
	'line-height',
	'letter-spacing',
	'border-radius',
	'padding',
	'margin',
	'gap',
	'width',
	'height',
	'max-width',
	'max-height',
	'min-width',
	'min-height',
	'fill',
	'stroke',
	'stop-color',
] as const;

/**
 * Resolve CSS custom properties (var()) to computed values on all
 * elements in the given subtree.
 *
 * html2canvas cannot evaluate var() references, so we resolve them
 * to their computed (concrete) values and set them as inline styles.
 */
export function resolveCustomProperties(root: HTMLElement): void {
	const elements = root.querySelectorAll('*');
	const view = root.ownerDocument?.defaultView ?? window;
	const resolve = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = view.getComputedStyle(htmlEl);

		for (const prop of VAR_DEPENDENT_PROPERTIES) {
			const inlineValue = htmlEl.style.getPropertyValue(prop);
			if (inlineValue && inlineValue.includes('var(')) {
				const computedValue = computed.getPropertyValue(prop);
				if (computedValue) {
					htmlEl.style.setProperty(prop, computedValue);
				}
			}
		}
	};

	resolve(root);
	elements.forEach(resolve);
}

/* ------------------------------------------------------------------ */
/*  Combined Preprocessing                                             */
/* ------------------------------------------------------------------ */

/**
 * Apply all CSS preprocessing steps to a cloned DOM subtree.
 *
 * This is designed to be called from html2canvas's `onclone` callback,
 * operating on the cloned document rather than the live DOM.
 *
 * @param root    - The root element of the cloned subtree.
 * @param options - Which preprocessing steps to apply.
 */
export function preprocessCssForCapture(
	root: HTMLElement,
	options: CssPreprocessingOptions = {},
): void {
	const {
		resolveCustomProperties: doResolve = true,
		flattenBackdropFilter: doFlattenBackdrop = true,
		flattenMixBlendMode: doFlattenBlend = true,
		flatten3dTransforms: doFlatten3d = true,
		removeUnsupportedFeatures: doRemoveUnsupported = true,
	} = options;

	if (doResolve) {
		resolveCustomProperties(root);
	}
	if (doFlattenBackdrop) {
		flattenBackdropFilter(root);
	}
	if (doFlattenBlend) {
		flattenMixBlendMode(root);
	}
	if (doFlatten3d) {
		flatten3dTransforms(root);
	}
	if (doRemoveUnsupported) {
		removeUnsupportedFeatures(root);
	}
}
