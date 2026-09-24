import type { PptxElement } from 'pptx-viewer-core';
import type {
	Chart3DSelectionBridge,
	ChartPartRef,
	PptxThreeViewElement,
	Rendering3DFlags,
	TextStyleAnimationDescriptor,
	ThreeViewSpec,
} from 'pptx-viewer-shared';
import {
	applyChart3DDrag,
	applyChart3DSelect,
	canDrillDown,
	defineThreeViewElement,
	formatAxisValue,
	THREE_VIEW_EVENTS,
	THREE_VIEW_TAG,
} from 'pptx-viewer-shared';

import type { ElementRenderContext } from '../types';

/**
 * three-view: the Vanilla binding's glue for `<pptx-three-view>`, the shared
 * custom element that hosts every three.js scene (3D chart, 3D SmartArt)
 * through one WebGL context (see `packages/shared/src/three-view/`).
 *
 * A renderer builds its normal SVG wrapper first, then
 * {@link mountThreeViewInto} moves that wrapper's content into a new
 * `<pptx-three-view>` as the element's slotted 2D fallback (shown while the
 * scene loads, and kept when `three` is missing or the scene fails). The
 * element owns the lazy `three` load, sizing, visibility and disposal, so
 * nothing here needs a MutationObserver or a handle registry.
 *
 * @module three-view
 */

/** The six resolved flags, read off the render context. */
export function rendering3DFlagsOf(context: ElementRenderContext): Rendering3DFlags {
	return {
		smartArt3D: context.smartArt3D,
		surfaceChart3D: context.surfaceChart3D,
		barChart3D: context.barChart3D,
		lineChart3D: context.lineChart3D,
		areaChart3D: context.areaChart3D,
		pieChart3D: context.pieChart3D,
	};
}

export interface ThreeViewMountOptions {
	spec: ThreeViewSpec;
	interactive: boolean;
	selectedPart?: ChartPartRef | null;
	textStyle?: TextStyleAnimationDescriptor;
}

/**
 * Move `wrapper`'s children into a new `<pptx-three-view>` (their fallback
 * slot) and append the view to `wrapper`. Returns the view.
 */
export function mountThreeViewInto(
	doc: Document,
	wrapper: HTMLElement | SVGElement,
	options: ThreeViewMountOptions,
): PptxThreeViewElement {
	defineThreeViewElement(doc.defaultView?.customElements);
	const view = doc.createElement(THREE_VIEW_TAG) as PptxThreeViewElement;
	view.append(...Array.from(wrapper.childNodes));
	view.spec = options.spec;
	view.interactive = options.interactive;
	view.selectedPart = options.selectedPart ?? null;
	view.textStyle = options.textStyle;
	wrapper.appendChild(view);
	return view;
}

/**
 * Whether a chart's 3D marks are selectable/draggable here: the SAME gate
 * `chart-editable.ts` applies to the flat 2D marks (authoring canvas, editing
 * wired up, drilldown not locked by `noDrilldown`).
 */
export function isChart3DEditable(element: PptxElement, context: ElementRenderContext): boolean {
	return (
		element.type === 'chart' &&
		Boolean(context.interactive) &&
		Boolean(context.onChartPointChange) &&
		canDrillDown(element)
	);
}

/** The persisted chart-part selection when it belongs to `element`. */
export function selectedChartPartOf(
	element: PptxElement,
	context: ElementRenderContext,
): ChartPartRef | null {
	return context.chartPartSelection?.elementId === element.id
		? context.chartPartSelection.part
		: null;
}

/**
 * Route a chart view's select/drag events onto the SAME
 * `context.onChartPartSelect` / `context.onChartPointChange` path the flat 2D
 * chart's on-canvas editing uses, through the shared `applyChart3DSelect` /
 * `applyChart3DDrag`, and show the mid-drag value badge the 2D drag shows.
 */
export function wireChartThreeViewEvents(
	view: PptxThreeViewElement,
	element: PptxElement,
	context: ElementRenderContext,
	badgeHost: HTMLElement | SVGElement,
): void {
	if (element.type !== 'chart') {
		return;
	}
	let badge: HTMLElement | null = null;
	const bridge: Chart3DSelectionBridge = {
		elementId: element.id,
		chartData: element.chartData,
		canSelect: isChart3DEditable(element, context),
		selectedElementId: context.chartPartSelection?.elementId ?? null,
		// There is no "clear chart part selection" hook: an empty-space click
		// leaves the selection alone, exactly like the 2D chart.
		setSelection: (selection) => {
			if (selection) {
				view.selectedPart = selection.part;
				context.onChartPartSelect?.(element, selection.part);
			}
		},
		setDragValue: (value) => {
			if (value === null) {
				badge?.remove();
				badge = null;
				return;
			}
			if (!badge) {
				badge = badgeHost.ownerDocument.createElement('div');
				badge.className = 'pptxv-chart-drag-badge';
				badgeHost.appendChild(badge);
			}
			badge.textContent = formatAxisValue(value);
		},
		commitChartData: (next) => context.onChartPointChange?.(element, next),
	};
	view.addEventListener(THREE_VIEW_EVENTS.select, (event) =>
		applyChart3DSelect(bridge, (event as CustomEvent<{ part: ChartPartRef | null }>).detail.part),
	);
	view.addEventListener(THREE_VIEW_EVENTS.drag, (event) =>
		applyChart3DDrag(bridge, (event as CustomEvent).detail),
	);
}

/**
 * Forward an animation text-style descriptor to every `<pptx-three-view>`
 * under `el`: its canvas-drawn labels/captions are out of reach of the CSS
 * override the rest of the element gets.
 */
export function applyThreeViewTextStyle(
	el: ParentNode,
	style: TextStyleAnimationDescriptor | undefined,
): void {
	for (const view of el.querySelectorAll<PptxThreeViewElement>(THREE_VIEW_TAG)) {
		view.textStyle = style;
	}
}
