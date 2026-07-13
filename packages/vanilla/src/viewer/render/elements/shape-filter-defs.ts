import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { getDuotoneSvgFilter } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';

/** Hidden SVG definitions referenced by shape-level DAG effect filters. */
export function renderShapeFilterDefs(doc: Document, element: PptxElement): SVGSVGElement | null {
	if (!hasShapeProperties(element)) {
		return null;
	}
	const duotone = getDuotoneSvgFilter(element.shapeStyle, element.id);
	if (!duotone) {
		return null;
	}
	const svg = createSvgEl(doc, 'svg', { width: 0, height: 0, 'aria-hidden': 'true' });
	svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
	const defs = createSvgEl(doc, 'defs');
	defs.innerHTML = duotone.filterMarkup;
	svg.appendChild(defs);
	return svg;
}
