import type { PptxElement } from 'pptx-viewer-core';
import type { AreaChart3DHandle, AreaChart3DSceneOptions } from 'pptx-viewer-shared';
import { buildAreaChart3DDataForElement, mountAreaChart3D } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { renderChartSvgElement } from './chart';
import { buildChart3DValueDragInteraction, seedChart3DSelectedPart } from './chart-3d-interaction';
import { createChart3DLoadingPlaceholder } from './chart-3d-loading';
import {
	registerChart3DTextStyleHandle,
	unregisterChart3DTextStyleHandle,
} from './chart-3d-text-style-registry';

/**
 * Opt-in interactive Three.js area3D-chart renderer, vanilla port of Vue's
 * `Area3DChartRenderer.vue` (gated on `context.areaChart3D`, threaded from
 * `PptxViewerOptions.areaChart3D`; see `chart.ts` for the dispatch and the
 * flat SVG path this replaces). Mirrors `bar-chart-3d.ts` exactly.
 *
 * Builds the pure per-series path + ribbon-fill layout from the shared
 * adapter (no `three` import), renders the existing SVG output synchronously
 * but immediately swaps its content for a lightweight spinner (so the flat 2D
 * chart never flashes on screen), then dynamically imports the OPTIONAL
 * `three` peer dependency (inside `mountAreaChart3D`) and swaps the spinner
 * for a mounted scene once the mount resolves. `three` unavailable, no
 * plottable grid, or a mount failure all restore the original SVG content
 * instead.
 *
 * A vertex marker is selectable and value-draggable, wired through
 * `chart-3d-interaction.ts` onto the SAME `context.onChartPartSelect` /
 * `context.onChartPointChange` commit path the flat 2D chart's on-canvas
 * editing uses. Active font-style emphasis (`context.presentationStates`) is
 * applied to the axis labels at mount and kept live via
 * `chart-3d-text-style-registry.ts`.
 */
export const renderAreaChart3DElement: ElementRenderer = (element, zIndex, context) => {
	const fallback = renderChartSvgElement(element, zIndex, context);
	if (element.type !== 'chart' || !fallback) {
		return fallback;
	}
	const options = buildAreaChart3DDataForElement(element, {
		width: element.width,
		height: element.height,
	});
	if (!options) {
		return fallback;
	}
	options.textStyle = context.presentationStates?.get(element.id)?.textStyle;

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
	options: AreaChart3DSceneOptions,
	svgContent: ChildNode[],
): Promise<void> {
	const host = createEl(context.document, 'div', 'pptxv-area-chart-3d-scene', {
		width: '100%',
		height: '100%',
		display: 'block',
	});
	const interaction = buildChart3DValueDragInteraction(element, context);
	const handle = await mountAreaChart3D(host, options, interaction);
	if (!handle.ok) {
		// `three` unavailable or the mount failed: restore the SVG rendered up
		// front, in place of the loading spinner.
		handle.dispose();
		fallback.replaceChildren(...svgContent);
		return;
	}
	fallback.replaceChildren(host);
	seedChart3DSelectedPart(element, context, handle);
	registerChart3DTextStyleHandle(context.document, element.id, handle);
	observeSceneRemoval(context.document, fallback, handle, element.id);
}

/** Dispose GPU resources when a later slide render removes this wrapper. */
function observeSceneRemoval(
	doc: Document,
	wrapper: HTMLElement | SVGElement,
	handle: AreaChart3DHandle,
	elementId: string,
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
		unregisterChart3DTextStyleHandle(doc, elementId, handle);
		handle.dispose();
	});
	observer.observe(doc, { childList: true, subtree: true });
}
