/**
 * Eyedropper colour sampler.
 *
 * The native EyeDropper API wrapper and the `EyedropperResult` type are shared
 * across every binding, so they are re-exported from `pptx-viewer-shared`
 * (`render/eyedropper`). React keeps its own `sampleColorFromSlide` below: it
 * takes an explicit slide element and bounds-checks against it, a different
 * signature from the shared coordinate-only fallback.
 */

import type { EyedropperResult } from 'pptx-viewer-shared';

export type { EyedropperResult } from 'pptx-viewer-shared';
export { openNativeEyeDropper } from 'pptx-viewer-shared';

/**
 * Sample the colour of a pixel from a rendered slide element.
 *
 * @param slideElement - The DOM element containing the rendered slide.
 * @param clientX - Pointer X in client coordinates.
 * @param clientY - Pointer Y in client coordinates.
 * @returns The sampled colour, or null if sampling failed.
 */
export function sampleColorFromSlide(
	slideElement: HTMLElement,
	clientX: number,
	clientY: number,
): EyedropperResult | null {
	const rect = slideElement.getBoundingClientRect();
	const x = Math.round(clientX - rect.left);
	const y = Math.round(clientY - rect.top);

	if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
		return null;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}

	// Try to find a canvas element within the slide for direct sampling
	const existingCanvas = slideElement.querySelector('canvas');
	if (existingCanvas) {
		try {
			const srcCtx = existingCanvas.getContext('2d');
			if (srcCtx) {
				const scaleX = existingCanvas.width / existingCanvas.clientWidth;
				const scaleY = existingCanvas.height / existingCanvas.clientHeight;
				const canvasRect = existingCanvas.getBoundingClientRect();
				const cx = Math.round((clientX - canvasRect.left) * scaleX);
				const cy = Math.round((clientY - canvasRect.top) * scaleY);
				const pixel = srcCtx.getImageData(cx, cy, 1, 1).data;
				return pixelToResult(pixel);
			}
		} catch {
			// Cross-origin or tainted canvas; fall through
		}
	}

	// Fallback: sample the background colour from the element at the pointer
	const targetEl = document.elementFromPoint(clientX, clientY);
	if (targetEl instanceof HTMLElement) {
		const computed = getComputedStyle(targetEl);
		const bgColor = computed.backgroundColor;
		if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
			return parseRgbaString(bgColor);
		}
		// Try fill for SVG elements
		const fill = computed.fill;
		if (fill && fill !== 'none' && fill !== 'transparent') {
			return parseRgbaString(fill);
		}
		// Try color
		const color = computed.color;
		if (color) {
			return parseRgbaString(color);
		}
	}

	return null;
}

function pixelToResult(data: Uint8ClampedArray): EyedropperResult {
	const r = data[0];
	const g = data[1];
	const b = data[2];
	return {
		r,
		g,
		b,
		hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
	};
}

function parseRgbaString(str: string): EyedropperResult | null {
	const match = str.match(/rgba?\(\s*(?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)/u);
	if (!match?.groups) {
		return null;
	}
	const r = parseInt(match.groups.r, 10);
	const g = parseInt(match.groups.g, 10);
	const b = parseInt(match.groups.b, 10);
	return {
		r,
		g,
		b,
		hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
	};
}
