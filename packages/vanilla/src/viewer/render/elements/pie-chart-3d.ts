import type { PptxElement } from 'pptx-viewer-core';
import type { PieChart3DHandle, PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { buildPieChart3DDataForElement, mountPieChart3D } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { renderChartSvgElement } from './chart';
import { buildChart3DValueDragInteraction, seedChart3DSelectedPart } from './chart-3d-interaction';
import { createChart3DLoadingPlaceholder } from './chart-3d-loading';

/**
 * Opt-in interactive Three.js pie3D-chart renderer, vanilla port of Vue's
 * `PieChart3DRenderer.vue` (gated on `context.pieChart3D`, threaded from
 * `PptxViewerOptions.pieChart3D`; see `chart.ts` for the dispatch and the
 * flat SVG path this replaces). Mirrors `bar-chart-3d.ts` exactly.
 *
 * Builds the pure wedge-mesh scene from the shared adapter (no `three`
 * import), renders the existing SVG output synchronously but immediately
 * swaps its content for a lightweight spinner (so the flat 2D chart never
 * flashes on screen), then dynamically imports the OPTIONAL `three` peer
 * dependency (inside `mountPieChart3D`) and swaps the spinner for a mounted
 * scene once the mount resolves. `three` unavailable, no plottable series, or
 * a mount failure all restore the original SVG content instead.
 *
 * A wedge is selectable and drag-to-value (dragging sweeps its trailing edge
 * around the pie's centre, exactly like the flat SVG pie/doughnut's own
 * on-canvas editing), wired through `chart-3d-interaction.ts`'s
 * `buildChart3DValueDragInteraction` onto the SAME `context.onChartPartSelect`
 * / `context.onChartPointChange` commit path every other interactive 3D chart
 * kind uses. Unlike the other 3D chart kinds, pie3D draws no axis labels, so
 * there is no font-style-emphasis surface to wire (see shared's
 * `PieChart3DHandle`, which has no `setTextStyle`).
 */
export const renderPieChart3DElement: ElementRenderer = (element, zIndex, context) => {
	const fallback = renderChartSvgElement(element, zIndex, context);
	if (element.type !== 'chart' || !fallback) {
		return fallback;
	}
	const options = buildPieChart3DDataForElement(element, {
		width: element.width,
		height: element.height,
	});
	if (!options) {
		return fallback;
	}

	const svgContent = Array.from(fallback.childNodes);
	fallback.replaceChildren(createChart3DLoadingPlaceholder(context));

	void mountScene(element, context, fallback, options, svgContent);
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
	element: PptxElement,
	context: ElementRenderContext,
	fallback: HTMLElement | SVGElement,
	options: PieChart3DSceneOptions,
	svgContent: ChildNode[],
): Promise<void> {
	const host = createEl(context.document, 'div', 'pptxv-pie-chart-3d-scene', {
		width: '100%',
		height: '100%',
		display: 'block',
	});
	const interaction = buildChart3DValueDragInteraction(element, context);
	const handle = await mountPieChart3D(host, options, interaction);
	if (!handle.ok) {
		// `three` unavailable or the mount failed: restore the SVG rendered up
		// front, in place of the loading spinner.
		handle.dispose();
		fallback.replaceChildren(...svgContent);
		return;
	}
	fallback.replaceChildren(host);
	seedChart3DSelectedPart(element, context, handle);
	observeSceneRemoval(context.document, fallback, handle);
}

/** Dispose GPU resources when a later slide render removes this wrapper. */
function observeSceneRemoval(
	doc: Document,
	wrapper: HTMLElement | SVGElement,
	handle: PieChart3DHandle,
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
