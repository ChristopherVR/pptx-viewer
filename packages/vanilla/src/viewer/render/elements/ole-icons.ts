import type { ResolvedOleType } from 'pptx-viewer-shared';
import { getOleIconShapes } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';

/**
 * Type-specific OLE placeholder icons, vanilla port of the inline SVG icons in
 * Vue's `OleRenderer.vue` (Excel grid, Word document, PDF, Visio diagram,
 * MathType `f(x)`, and a generic linked-objects glyph). The shape data lives
 * in `pptx-viewer-shared` (`getOleIconShapes`); this module only maps each
 * {@link OleIconShape} onto its `<rect>`/`<line>`/`<text>` DOM primitive.
 */

/** Build the 36x36 placeholder icon `<svg>` for a resolved OLE type. */
export function buildOleIcon(doc: Document, type: ResolvedOleType, color: string): SVGSVGElement {
	const svg = createSvgEl(doc, 'svg', {
		width: 36,
		height: 36,
		viewBox: '0 0 24 24',
		fill: 'none',
		'aria-hidden': 'true',
	});
	for (const shape of getOleIconShapes(type)) {
		const node = createSvgEl(doc, shape.tag, shape.attrs);
		if (shape.tag === 'text') {
			node.setAttribute('fill', color);
			node.textContent = shape.text ?? '';
		} else {
			node.setAttribute('stroke', color);
		}
		svg.appendChild(node);
	}
	return svg;
}
