import type { LineChart3DHandle, LineChart3DSceneOptions } from 'pptx-viewer-shared';
import { buildLineChart3DDataForElement, mountLineChart3D } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { renderChartSvgElement } from './chart';
import { createChart3DLoadingPlaceholder } from './chart-3d-loading';

/**
 * Opt-in interactive Three.js line3D-chart renderer, vanilla port of Vue's
 * `Line3DChartRenderer.vue` (gated on `context.lineChart3D`, threaded from
 * `PptxViewerOptions.lineChart3D`; see `chart.ts` for the dispatch and the
 * flat SVG path this replaces). Marks are not selectable/draggable in this
 * mode: a tube-path mesh has no 2D screen geometry to hit-test against.
 * Mirrors `bar-chart-3d.ts` exactly.
 *
 * Builds the pure per-series path layout from the shared adapter (no `three`
 * import), renders the existing SVG output synchronously but immediately
 * swaps its content for a lightweight spinner (so the flat 2D chart never
 * flashes on screen), then dynamically imports the OPTIONAL `three` peer
 * dependency (inside `mountLineChart3D`) and swaps the spinner for a mounted
 * scene once the mount resolves. `three` unavailable, no plottable grid, or a
 * mount failure all restore the original SVG content instead.
 */
export const renderLineChart3DElement: ElementRenderer = (element, zIndex, context) => {
	const fallback = renderChartSvgElement(element, zIndex, context);
	if (element.type !== 'chart' || !fallback) {
		return fallback;
	}
	const options = buildLineChart3DDataForElement(element, {
		width: element.width,
		height: element.height,
	});
	if (!options) {
		return fallback;
	}

	const svgContent = Array.from(fallback.childNodes);
	fallback.replaceChildren(createChart3DLoadingPlaceholder(context));

	void mountScene(context, fallback, options, svgContent);
	return fallback;
};

/**
 * Mount the shared scene into a fresh host, swapping it in for `fallback`'s
 * contents on success, or restoring the original SVG content on failure.
 * `fallback` is already attached to the stage by the caller (`renderElement`
 * returns synchronously before this promise settles), so mutating it in
 * place upgrades the element without a full slide re-render.
 */
async function mountScene(
	context: ElementRenderContext,
	fallback: HTMLElement | SVGElement,
	options: LineChart3DSceneOptions,
	svgContent: ChildNode[],
): Promise<void> {
	const host = createEl(context.document, 'div', 'pptxv-line-chart-3d-scene', {
		width: '100%',
		height: '100%',
		display: 'block',
	});
	const handle = await mountLineChart3D(host, options);
	if (!handle.ok) {
		// `three` unavailable or the mount failed: restore the SVG rendered up
		// front, in place of the loading spinner.
		handle.dispose();
		fallback.replaceChildren(...svgContent);
		return;
	}
	fallback.replaceChildren(host);
	observeSceneRemoval(context.document, fallback, handle);
}

/** Dispose GPU resources when a later slide render removes this wrapper. */
function observeSceneRemoval(
	doc: Document,
	wrapper: HTMLElement | SVGElement,
	handle: LineChart3DHandle,
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
