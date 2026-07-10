import type { Model3DPptxElement } from 'pptx-viewer-core';
import { parseDataUrlToBytes } from 'pptx-viewer-core';
import { getContainerStyle, mountModel3D } from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';

/** Default MIME for GLB binaries when the element omits `modelMimeType`. */
const DEFAULT_MODEL_MIME = 'model/gltf-binary';

/**
 * Renderer for `model3d` (embedded GLB/GLTF) elements, vanilla port of Vue's
 * `Model3DRenderer.vue` / React's `Model3DRenderer.tsx`:
 *
 * - Poster image (`posterImage`, then the raster `imageData`) renders by
 *   default; without one, a labelled "3D Model" placeholder box (cube icon)
 *   renders instead, exactly like the other bindings.
 * - When the element carries the model binary (`modelData`), a "view in 3D"
 *   button mounts the shared framework-free vanilla-three controller
 *   (`mountModel3D`, which dynamically imports the OPTIONAL `three` peer
 *   dependency) on demand for interactive rotate/zoom. Vue/React mount the
 *   scene eagerly via their reactive lifecycles; the stateless vanilla
 *   renderer mounts on click so `three` is never touched for passive viewing.
 * - Graceful fallback: when `three` is unavailable or the model fails to load
 *   (`handle.ok === false`), the poster/placeholder stays and the affordance
 *   is removed, mirroring Vue's `showPoster` fallback.
 *
 * The `modelData` data URL becomes a blob (object) URL via core
 * `parseDataUrlToBytes` (never hand-rolled base64), revoked once the mount
 * attempt settles - the same lifecycle as Vue's `useModel3dScene`.
 */
export const renderModel3dElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'model3d') {
		return null;
	}
	const doc = context.document;
	const el = createEl(
		doc,
		'div',
		'pptxv-element pptxv-model3d',
		getContainerStyle(element, zIndex),
	);
	el.dataset.elementId = element.id;

	const label = context.t('pptx.model3d.label');
	const posterSrc = element.posterImage ?? element.imageData;
	const poster = posterSrc ? buildPoster(doc, posterSrc, label) : buildPlaceholder(doc, label);
	el.appendChild(poster);

	if (element.modelData) {
		el.appendChild(buildViewButton(doc, el, poster, element, context));
	}
	return el;
};

/** Poster image filling the element box (object-fit contain). */
function buildPoster(doc: Document, src: string, alt: string): HTMLElement {
	const img = createEl(doc, 'img', 'pptxv-model3d-poster', {
		width: '100%',
		height: '100%',
		objectFit: 'contain',
		pointerEvents: 'none',
		userSelect: 'none',
		display: 'block',
	});
	img.src = src;
	img.alt = alt;
	img.draggable = false;
	return img;
}

/** Labelled placeholder box (cube icon + "3D Model") when no poster exists. */
function buildPlaceholder(doc: Document, label: string): HTMLElement {
	const box = createEl(doc, 'div', 'pptxv-model3d-placeholder', {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: '11px',
		color: '#9ca3af',
		backgroundColor: '#f9fafb',
		border: '1px dashed #e5e7eb',
		borderRadius: '4px',
		boxSizing: 'border-box',
	});

	const icon = createSvgEl(doc, 'svg', {
		width: 24,
		height: 24,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 1.5,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
	});
	icon.setAttribute('class', 'pptxv-model3d-icon');
	icon.setAttribute('style', 'margin-bottom:4px;color:#d1d5db');
	icon.appendChild(
		createSvgEl(doc, 'path', {
			d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
		}),
	);
	icon.appendChild(createSvgEl(doc, 'polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }));
	icon.appendChild(createSvgEl(doc, 'line', { x1: 12, y1: 22.08, x2: 12, y2: 12 }));
	box.appendChild(icon);

	const text = createEl(doc, 'span', 'pptxv-model3d-label');
	text.textContent = label;
	box.appendChild(text);
	return box;
}

/**
 * Convert the base64 `modelData` data URL to a blob (object) URL the shared
 * GLTF loader can fetch. Returns undefined for missing / malformed data URLs.
 */
function modelDataToBlobUrl(
	dataUrl: string | undefined,
	mimeType: string | undefined,
): string | undefined {
	if (!dataUrl) {
		return undefined;
	}
	const parsed = parseDataUrlToBytes(dataUrl);
	if (!parsed) {
		return undefined;
	}
	// Copy into a fresh ArrayBuffer-backed view: `parseDataUrlToBytes` returns a
	// `Uint8Array<ArrayBufferLike>`, which TS does not accept as a `BlobPart`.
	const bytes = new Uint8Array(parsed.bytes);
	const blob = new Blob([bytes], { type: mimeType ?? DEFAULT_MODEL_MIME });
	return URL.createObjectURL(blob);
}

/** The on-demand "view in 3D" affordance overlaying the poster. */
function buildViewButton(
	doc: Document,
	root: HTMLElement,
	poster: HTMLElement,
	element: Model3DPptxElement,
	context: ElementRenderContext,
): HTMLElement {
	const button = createEl(doc, 'button', 'pptxv-model3d-view', {
		position: 'absolute',
		bottom: '4px',
		right: '4px',
		zIndex: 10,
		padding: '2px 8px',
		border: '1px solid rgba(0,0,0,0.18)',
		borderRadius: '4px',
		background: 'rgba(255,255,255,0.9)',
		color: '#1a1a1a',
		font: 'inherit',
		fontSize: '11px',
		lineHeight: 1.4,
		cursor: 'pointer',
		pointerEvents: 'auto',
	});
	button.type = 'button';
	const label = context.t('pptx.model3d.label');
	button.textContent = label;
	button.title = label;
	button.setAttribute('aria-label', label);

	// Swallow pointer interactions so the click never bubbles into host-level
	// element selection / drag handlers (same pattern as the OLE action bar).
	for (const type of ['pointerdown', 'mousedown'] as const) {
		button.addEventListener(type, (event) => event.stopPropagation());
	}

	button.addEventListener('click', (event) => {
		event.stopPropagation();
		if (button.disabled) {
			return;
		}
		button.disabled = true;

		const url = modelDataToBlobUrl(element.modelData, element.modelMimeType);
		if (!url) {
			button.remove();
			return;
		}

		// Absolutely positioned so the empty host never shifts the poster while
		// the model is still loading; the canvas is appended into it on success.
		const sceneHost = createEl(doc, 'div', 'pptxv-model3d-scene', {
			position: 'absolute',
			inset: 0,
			willChange: 'transform',
		});
		root.appendChild(sceneHost);

		void mountModel3D(sceneHost, url, {
			width: Math.max(1, element.width),
			height: Math.max(1, element.height),
			interactive: true,
		}).then((handle) => {
			URL.revokeObjectURL(url);
			if (handle.ok) {
				poster.remove();
				button.remove();
			} else {
				// three unavailable / model failed: keep the poster, drop the
				// affordance so the user is not offered a dead button again.
				sceneHost.remove();
				button.remove();
			}
			return undefined;
		});
	});
	return button;
}
