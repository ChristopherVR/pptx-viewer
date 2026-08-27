import type { BarChart3DHandle, BarChart3DSceneOptions } from 'pptx-viewer-shared';
import { buildBarChart3DDataForElement, mountBarChart3D } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { renderChartSvgElement } from './chart';

/**
 * Opt-in interactive Three.js bar3D-chart renderer, vanilla port of Vue's
 * `BarChart3DRenderer.vue` (gated on `context.barChart3D`, threaded from
 * `PptxViewerOptions.barChart3D`; see `chart.ts` for the dispatch and the
 * flat SVG path this replaces). Marks are not selectable/draggable in this
 * mode: a box mesh has no 2D screen geometry to hit-test against. Mirrors
 * `surface-chart-3d.ts` exactly.
 *
 * Builds the pure grid from the shared adapter (no `three` import), renders
 * the existing SVG output synchronously as an immediate placeholder, then
 * dynamically imports the OPTIONAL `three` peer dependency (inside
 * `mountBarChart3D`) and swaps it for a mounted scene once the mount
 * resolves. `three` unavailable, no plottable grid, horizontal 3-D Bar, or a
 * mount failure all leave the SVG in place, mirroring `smartart-3d.ts`'s
 * paint-then-upgrade-in-place pattern.
 */
export const renderBarChart3DElement: ElementRenderer = (element, zIndex, context) => {
	const fallback = renderChartSvgElement(element, zIndex, context);
	if (element.type !== 'chart' || !fallback) {
		return fallback;
	}
	const options = buildBarChart3DDataForElement(element, {
		width: element.width,
		height: element.height,
	});
	if (!options) {
		return fallback;
	}

	void mountScene(context, fallback, options);
	return fallback;
};

/**
 * Mount the shared scene into a fresh host, swapping it in for `fallback`'s
 * contents on success. `fallback` is already attached to the stage by the
 * caller (`renderElement` returns synchronously before this promise
 * settles), so mutating it in place upgrades the element without a full
 * slide re-render.
 */
async function mountScene(
	context: ElementRenderContext,
	fallback: HTMLElement | SVGElement,
	options: BarChart3DSceneOptions,
): Promise<void> {
	const host = createEl(context.document, 'div', 'pptxv-bar-chart-3d-scene', {
		width: '100%',
		height: '100%',
		display: 'block',
	});
	const handle = await mountBarChart3D(host, options);
	if (!handle.ok) {
		// `three` unavailable or the mount failed: the SVG fallback already
		// painted synchronously is untouched, so there is nothing to restore.
		handle.dispose();
		return;
	}
	fallback.replaceChildren(host);
	observeSceneRemoval(context.document, fallback, handle);
}

/** Dispose GPU resources when a later slide render removes this wrapper. */
function observeSceneRemoval(
	doc: Document,
	wrapper: HTMLElement | SVGElement,
	handle: BarChart3DHandle,
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
