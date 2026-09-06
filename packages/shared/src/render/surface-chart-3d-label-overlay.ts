/**
 * DOM overlay nodes for the interactive 3D chart scenes' axis labels
 * ({@link ./bar-chart-3d-scene.ts}, {@link ./line-chart-3d-scene.ts},
 * {@link ./area-chart-3d-scene.ts}, {@link ./surface-chart-3d-scene.ts}).
 * Three.js has no built-in text rendering, so each label is a positioned
 * `<div>` re-projected to screen space every frame by the scene's render
 * loop.
 *
 * Also carries the font-style emphasis override
 * ({@link TextStyleAnimationDescriptor}, `animation-text-style-resolve.ts`):
 * bold/italic/underline/size/colour are applied DIRECTLY to each label's
 * inline style here, rather than relying on the scoped `[data-element-id]
 * [style]` CSS rule `buildTextStyleOverrideCss` emits for every other DOM
 * text surface. That CSS rule WOULD also reach these divs in principle (they
 * carry their own inline `style`, and the RAF loop only ever touches
 * `display`/`left`/`top`, never the emphasis properties), but relying on it
 * would silently depend on every binding nesting the scene's container
 * exactly under the element's `data-element-id` wrapper - baking the style
 * in here makes it correct by construction, independent of that DOM shape.
 *
 * @module surface-chart-3d-label-overlay
 */
import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type { SurfaceLabel } from './surface-chart-3d-geom';

/** A mounted label overlay: append `layer`, call `applyTextStyle` initially and on emphasis changes. */
export interface LabelOverlay {
	layer: HTMLDivElement;
	nodes: HTMLDivElement[];
	/** Apply (or clear, when `undefined`) a text-style emphasis override across every label. */
	applyTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
}

/** Base (un-emphasised) font size, in CSS px; `fontScale` multiplies this, matching every other text surface's relative-size convention. */
const BASE_FONT_SIZE_PX = 9;

/** Create the DOM overlay nodes for the axis labels, returned with the layer. */
export function createLabelOverlay(
	doc: Document,
	labels: ReadonlyArray<SurfaceLabel>,
): LabelOverlay {
	const layer = doc.createElement('div');
	Object.assign(layer.style, {
		position: 'absolute',
		inset: '0',
		pointerEvents: 'none',
		overflow: 'hidden',
	});

	const entries = labels.map((label) => {
		const node = doc.createElement('div');
		node.textContent = label.text;
		const baseColor = label.axis === 'value' ? '#999' : '#666';
		Object.assign(node.style, {
			position: 'absolute',
			fontSize: `${BASE_FONT_SIZE_PX}px`,
			color: baseColor,
			whiteSpace: 'nowrap',
			userSelect: 'none',
			transform: 'translate(-50%, -50%)',
			willChange: 'left, top',
		});
		if (label.axis === 'value') {
			node.style.writingMode = 'vertical-rl';
		}
		layer.appendChild(node);
		return { node, baseColor };
	});

	function applyTextStyle(style: TextStyleAnimationDescriptor | undefined): void {
		for (const { node, baseColor } of entries) {
			node.style.fontWeight = style?.bold === undefined ? '' : style.bold ? 'bold' : 'normal';
			node.style.fontStyle = style?.italic === undefined ? '' : style.italic ? 'italic' : 'normal';
			node.style.textDecorationLine =
				style?.underline === undefined ? '' : style.underline ? 'underline' : 'none';
			const scale =
				typeof style?.fontScale === 'number' &&
				Number.isFinite(style.fontScale) &&
				style.fontScale > 0
					? style.fontScale
					: 1;
			node.style.fontSize = `${BASE_FONT_SIZE_PX * scale}px`;
			node.style.color = style?.color ?? baseColor;
		}
	}

	return { layer, nodes: entries.map((e) => e.node), applyTextStyle };
}
