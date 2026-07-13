import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { build3DExtrusionData, getComputedFillStyle } from 'pptx-viewer-shared';

import { createEl } from '../dom';

/** Build CSS 3D side faces for a shape carrying `a:sp3d` extrusion depth. */
export function renderExtrusionOverlay(doc: Document, element: PptxElement): HTMLElement | null {
	if (!hasShapeProperties(element)) {
		return null;
	}
	const fill = getComputedFillStyle(element)?.backgroundColor;
	const data = build3DExtrusionData(
		element.shapeStyle?.shape3d,
		element.shapeStyle?.scene3d,
		fill,
		element.width,
		element.height,
	);
	if (!data.hasExtrusion || data.panels.length === 0) {
		return null;
	}
	const wrapper = createEl(doc, 'div', 'pptxv-extrusion-3d', toCss(data.wrapperStyle));
	wrapper.setAttribute('aria-hidden', 'true');
	for (const panel of data.panels) {
		wrapper.appendChild(
			createEl(
				doc,
				'div',
				`pptxv-extrusion-3d-panel pptxv-extrusion-3d-panel--${panel.side}`,
				toCss(panel.style),
			),
		);
	}
	if (data.materialOverlay) {
		wrapper.appendChild(
			createEl(doc, 'div', 'pptxv-extrusion-3d-material', {
				position: 'absolute',
				inset: 0,
				backgroundImage: data.materialOverlay,
				pointerEvents: 'none',
				borderRadius: 'inherit',
				transform: String(data.frontFaceStyle.transform ?? ''),
			}),
		);
	}
	return wrapper;
}

function toCss(style: Record<string, string | number>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(style).map(([key, value]) => [
			key,
			typeof value === 'number' ? `${value}px` : value,
		]),
	);
}
