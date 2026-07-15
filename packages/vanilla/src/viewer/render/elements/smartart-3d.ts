import type { PptxElement } from 'pptx-viewer-core';
import type { SmartArt3DModel } from 'pptx-viewer-shared';
import { buildSmartArt3DModel, computeSmartArtLayout, resolvePalette } from 'pptx-viewer-shared';
import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';

import { createEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { renderSmartArtSvg } from './smartart';

/**
 * Opt-in Three.js SmartArt renderer, vanilla port of Vue's
 * `SmartArt3DRenderer.vue` (gated on `context.smartArt3D`, threaded from
 * `PptxViewerOptions.smartArt3D`; see `smartart.ts` for the flat SVG path this
 * replaces). Inline node text editing (a Vue-only editor-mode affordance) is
 * not ported, matching the rest of the viewer-only vanilla SmartArt renderer.
 *
 * Builds the pure 3D model from the shared layout engine (no `three` import),
 * renders the existing SVG output synchronously as an immediate placeholder,
 * then lazily imports the vanilla scene runtime from
 * `pptx-viewer-shared/smartart-3d` and swaps it for a mounted canvas once the
 * import and mount resolve. `three` is an optional peer dependency: when it is
 * missing, the diagram has no meshes, or the mount throws, the SVG stays in
 * place, mirroring Vue's `useFallback` flag and Vanilla's own `model3d.ts`
 * graceful-degradation pattern (dynamic import + fallback, no hard `three`
 * dependency in this package).
 */
export const renderSmartArt3DElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'smartArt') {
		return null;
	}
	const fallback = renderSmartArtSvg(element, zIndex, context);
	const model = buildModel(element);
	if (!fallback || !model || model.meshes.length === 0) {
		return fallback;
	}

	void mountScene(element, context, fallback, model);
	return fallback;
};

/** Build the pure 3D model from the element's SmartArt data, or `null`. */
function buildModel(element: PptxElement): SmartArt3DModel | null {
	if (element.type !== 'smartArt') {
		return null;
	}
	const data = element.smartArtData;
	if (!data || data.nodes.length === 0) {
		return null;
	}
	const layout = computeSmartArtLayout(
		data.nodes,
		{ width: element.width, height: element.height },
		resolvePalette(data),
		data.style ?? 'flat',
		element.id,
		data.resolvedLayoutType,
		data.layout,
	);
	return buildSmartArt3DModel(layout, {
		background: data.chrome?.backgroundColor,
		spatial: true,
	});
}

/**
 * Lazily import the vanilla scene runtime and mount `model` onto a canvas
 * that replaces `fallback`'s contents on success. `fallback` is already
 * attached to the stage by the caller (`renderElement` returns synchronously
 * before this promise settles), so mutating it in place upgrades the element
 * without a full slide re-render.
 */
async function mountScene(
	element: PptxElement,
	context: ElementRenderContext,
	fallback: HTMLElement | SVGElement,
	model: SmartArt3DModel,
): Promise<void> {
	if (element.type !== 'smartArt') {
		return;
	}
	// Captured before any mutation so a failed mount can restore exactly what
	// was already painted, mirroring Vue's `useFallback` flipping back to
	// `true` inside its `catch`.
	const fallbackChildren = Array.from(fallback.childNodes);
	try {
		const { mountSmartArt3D } = await import('pptx-viewer-shared/smartart-3d');
		const canvas = createEl(context.document, 'canvas', 'pptxv-smartart-3d-canvas', {
			width: '100%',
			height: '100%',
			display: 'block',
		});
		fallback.replaceChildren(canvas);
		const handle = mountSmartArt3D(
			canvas,
			model,
			Math.max(1, element.width),
			Math.max(1, element.height),
			{},
		);
		observeSceneRemoval(context.document, fallback, handle);
	} catch {
		// `three` unavailable or the scene failed to mount: restore the SVG
		// fallback that was already painted synchronously.
		fallback.replaceChildren(...fallbackChildren);
	}
}

/** Dispose GPU resources when a later slide render removes this wrapper. */
function observeSceneRemoval(
	doc: Document,
	wrapper: HTMLElement | SVGElement,
	handle: SmartArt3DHandle,
): void {
	const MutationObserver = doc.defaultView?.MutationObserver;
	if (!wrapper.isConnected || !MutationObserver) {
		return;
	}
	const observer = new MutationObserver(() => {
		if (wrapper.isConnected) {
			return;
		}
		observer.disconnect();
		handle.dispose();
	});
	observer.observe(doc, { childList: true, subtree: true });
}
