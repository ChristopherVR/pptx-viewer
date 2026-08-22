/**
 * DOM overlay nodes for the interactive 3D surface scene's axis labels
 * ({@link ./surface-chart-3d-scene.ts}). Three.js has no built-in text
 * rendering, so each label is a positioned `<div>` re-projected to screen
 * space every frame by the scene's render loop.
 *
 * @module surface-chart-3d-label-overlay
 */
import type { SurfaceLabel } from './surface-chart-3d-geom';

/** Create the DOM overlay nodes for the axis labels, returned with the layer. */
export function createLabelOverlay(
	doc: Document,
	labels: ReadonlyArray<SurfaceLabel>,
): { layer: HTMLDivElement; nodes: HTMLDivElement[] } {
	const layer = doc.createElement('div');
	Object.assign(layer.style, {
		position: 'absolute',
		inset: '0',
		pointerEvents: 'none',
		overflow: 'hidden',
	});

	const nodes = labels.map((label) => {
		const node = doc.createElement('div');
		node.textContent = label.text;
		const color = label.axis === 'value' ? '#999' : '#666';
		Object.assign(node.style, {
			position: 'absolute',
			fontSize: '9px',
			color,
			whiteSpace: 'nowrap',
			userSelect: 'none',
			transform: 'translate(-50%, -50%)',
			willChange: 'left, top',
		});
		if (label.axis === 'value') {
			node.style.writingMode = 'vertical-rl';
		}
		layer.appendChild(node);
		return node;
	});

	return { layer, nodes };
}
