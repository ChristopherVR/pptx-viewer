import {
	getComputedImageStyle,
	getContainerStyle,
	getImageColorWashStyle,
	getImageFitStyle,
	getImageOverflow,
	getImageSrc,
	resolveColorChangedImageSource,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl, setSvgAttrs } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `image` / `picture` elements: an absolutely positioned box with
 * an `<img>` under the shared fill/crop fit, the shared computed CSS filter, and
 * any SVG `<filter>` defs required by duotone / artistic image effects.
 */
export const renderImageElement: ElementRenderer = (element, zIndex, context) => {
	const doc = context.document;
	// The clip is load-bearing, not cosmetic: a cropped picture is rendered by
	// scaling the source up and translating the cropped-away part out of the
	// frame, so without it the discarded region paints over its neighbours.
	const el = createEl(doc, 'div', 'pptxv-element pptxv-image', {
		...getContainerStyle(element, zIndex),
		overflow: getImageOverflow(element),
	});
	el.dataset.elementId = element.id;

	const src = getImageSrc(element, new Map(context.mediaDataUrls));
	if (!src) {
		return el;
	}

	const fx = getComputedImageStyle(element);

	// SVG <filter> defs so the `url(#...)` references in `fx.filter` resolve.
	for (const f of fx.svgFilters) {
		const svg = createSvgEl(doc, 'svg', { width: 0, height: 0, 'aria-hidden': 'true' });
		svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
		const defs = createSvgEl(doc, 'defs');
		const filter = createSvgEl(doc, 'filter');
		setSvgAttrs(filter, { id: f.id, 'color-interpolation-filters': 'sRGB' });
		// `f.markup` is shared-generated SVG filter-primitive markup (no user input).
		filter.innerHTML = f.markup;
		defs.appendChild(filter);
		svg.appendChild(defs);
		el.appendChild(svg);
	}

	const img = createEl(doc, 'img', undefined, {
		...getImageFitStyle(element),
		display: 'block',
	});
	img.src = src;
	img.alt = '';
	if (fx.filter) {
		img.style.filter = fx.filter;
	}
	if (fx.opacity !== undefined) {
		img.style.opacity = String(fx.opacity);
	}
	el.appendChild(img);
	if (element.type === 'image' || element.type === 'picture') {
		const clrChange = element.imageEffects?.clrChange;
		if (clrChange) {
			void resolveColorChangedImageSource(src, clrChange).then((resolved) => {
				if (img.src === src || img.getAttribute('src') === src) {
					img.src = resolved;
				}
				return undefined;
			});
		}
		const wash = getImageColorWashStyle(element.imageEffects?.colorWash);
		if (wash) {
			el.appendChild(
				createEl(doc, 'div', 'pptxv-image-color-wash', {
					position: 'absolute',
					inset: '0',
					pointerEvents: 'none',
					backgroundColor: wash.backgroundColor,
					opacity: String(wash.opacity),
				}),
			);
		}
	}

	return el;
};
