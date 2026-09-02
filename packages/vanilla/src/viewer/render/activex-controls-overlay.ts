import type { PptxActiveXControl } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { getActiveXControlOverlayView } from 'pptx-viewer-shared';

import { createEl } from './dom';

/**
 * ActiveX controls (`p:controls > p:control`) cannot run inside a viewer.
 * Draw each one's static fallback picture when core resolved one, otherwise
 * a labelled placeholder badge, so the slide shows where the control lives
 * instead of a blank gap (React-only before this; the other bindings drew
 * nothing). Split out of `slide-stage.ts` to keep it inside the file-size
 * budget; see {@link getActiveXControlOverlayView} for the shared geometry
 * decision this maps onto DOM.
 */
export function buildActiveXControlsOverlay(
	doc: Document,
	controls: readonly PptxActiveXControl[],
	canvasSize: CanvasSize,
): HTMLElement {
	const overlay = createEl(doc, 'div', 'pptxv-activex-overlay', {
		position: 'absolute',
		inset: '0',
		pointerEvents: 'none',
		zIndex: '40',
	});
	controls.forEach((control, index) => {
		const view = getActiveXControlOverlayView(control, canvasSize, index);
		const style = {
			position: 'absolute',
			left: `${view.left}px`,
			top: `${view.top}px`,
			width: `${view.width}px`,
			height: `${view.height}px`,
		};
		if (view.className === 'image' && view.imageUrl) {
			const img = createEl(doc, 'img', 'pptxv-activex-overlay-image', style);
			img.src = view.imageUrl;
			img.alt = view.label;
			img.title = `ActiveX control: ${view.label}`;
			overlay.appendChild(img);
			return;
		}
		const badge = createEl(doc, 'div', 'pptxv-activex-overlay-placeholder', style);
		badge.title = `ActiveX control: ${view.label} (interactive controls are not supported in the viewer)`;
		badge.textContent = view.label;
		overlay.appendChild(badge);
	});
	return overlay;
}
