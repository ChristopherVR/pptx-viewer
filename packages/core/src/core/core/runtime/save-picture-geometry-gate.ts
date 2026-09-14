import type { PptxElement, XmlObject } from '../../types';

/**
 * Decide whether an element's editable geometry (`shapeType`, custom paths)
 * may be written into its own `p:spPr` on save.
 *
 * A picture placeholder commonly carries only a transform on the slide and
 * inherits its clipping mask (`a:custGeom` or a non-rect `a:prstGeom`) from
 * the layout placeholder. The loader resolves that inherited geometry into the
 * element so the canvas can paint the mask, but writing it back onto the
 * slide-owned `<p:pic>` turns a layout-bound mask into an explicit local shape
 * that PowerPoint then paints on its own terms, distorting the picture. So a
 * picture that had no geometry of its own keeps having none. Pictures that
 * were authored with local geometry (PowerPoint always writes
 * `<a:prstGeom prst="rect"/>` on an ordinary `p:pic`, and the SDK picture
 * factory does the same) and every other shape-bearing element go through the
 * geometry writer unchanged.
 *
 * `spPr` must be the element's OWN pre-merge node (the writer patches
 * `rawXml['p:spPr']`, never the layout-merged copy the parser inspected).
 */
export function shouldWritePictureGeometry(el: PptxElement, spPr: XmlObject): boolean {
	if (el.type !== 'picture' && el.type !== 'image') {
		return true;
	}
	return Boolean(spPr['a:prstGeom'] || spPr['a:custGeom']);
}
