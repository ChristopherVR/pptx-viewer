/**
 * 3D (scene3d/sp3d) serialisation for fabricated SmartArt cached drawing
 * shapes (`ppt/diagrams/drawingN.xml`, `dsp:sp`).
 *
 * The write-side counterpart of `smartart-drawing-shape-3d` (the parser).
 * When an edited SmartArt drawing is regenerated (`drawingDirty`), each
 * shape's parsed `scene3d` / `shape3d` must be written back onto its
 * `dsp:spPr`, or a bevel / scene quick style silently flattens to 2D on
 * reopen. Reuses the SAME `a:scene3d` / `a:sp3d` serialisers an ordinary
 * shape's `p:spPr` goes through (`save-shape-effects`), so no 3D writing
 * logic is duplicated. The text-body extrusion (`text3d`) goes through the
 * shared `applyTextBodySp3d` writer from `smartart-fabrication-text`.
 *
 * @module pptx-runtime/smartart-fabrication-3d
 */
import { XMLBuilder } from 'fast-xml-parser';

import type { PptxSmartArtDrawingShape, XmlObject } from '../../types';
import { writeScene3d, writeShape3d } from './save-shape-effects';

const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	suppressEmptyNode: true,
	format: false,
});

/**
 * Build the trailing `<a:scene3d>` + `<a:sp3d>` `spPr` children for a
 * drawing shape, in `CT_ShapeProperties` sequence order (after `a:ln` /
 * `a:effectLst`). Returns an empty string for a flat shape.
 */
export function drawingShape3dXml(
	shape: Pick<PptxSmartArtDrawingShape, 'scene3d' | 'shape3d'>,
): string {
	const spPr: XmlObject = {};
	writeScene3d(spPr, shape);
	writeShape3d(spPr, shape);
	return Object.keys(spPr).length > 0 ? builder.build(spPr) : '';
}
