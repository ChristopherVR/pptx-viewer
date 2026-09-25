/**
 * Per-label 3D (`dgm:styleLbl/dgm:scene3d`, `dgm:sp3d`, `dgm:txPr/a:sp3d`)
 * of a SmartArt quick style (`ppt/diagrams/quickStyleN.xml`).
 *
 * PowerPoint bakes each label's 3D onto every cached drawing shape
 * (`dsp:spPr/a:scene3d|a:sp3d`, `dsp:txBody/a:bodyPr/a:sp3d`), so a diagram
 * whose cached drawing is intact never needs this. A STRUCTURAL edit (add,
 * remove or reorder a node) throws the cached drawing away, though, and the
 * regenerated shapes have no cached 3D to copy: they re-resolve it from these
 * labels, keyed by each shape's style label, the same way PowerPoint does
 * when it re-lays out a diagram (see `applySmartArtQuickStyle3d`).
 *
 * Reuses the SAME parsers an ordinary shape's `p:spPr/a:scene3d|a:sp3d` and a
 * text body's `a:bodyPr/a:sp3d` go through, so no 3D parsing is duplicated.
 *
 * @module pptx-runtime/smartart-style-label-3d
 */
import type { PptxSmartArtQuickStyleLabel, TextStyle, XmlObject } from '../../types';
import { parseTextBodySp3d } from '../../utils/text-body-sp3d';
import { parsePptx3DScene, parsePptx3DShape } from '../builders/shape-style-3d-helpers';

type LocalName = (key: string) => string;
type ParseColor = (node: XmlObject | undefined) => string | undefined;

/** The 3D fields a quick-style label carries. */
export type SmartArtStyleLabel3d = Pick<
	PptxSmartArtQuickStyleLabel,
	'scene3d' | 'shape3d' | 'text3d'
>;

/** A label's direct child element by local name, when it is an element with content. */
function childObject(raw: XmlObject, name: string, localName: LocalName): XmlObject | undefined {
	const key = Object.keys(raw).find((candidate) => localName(candidate) === name);
	const value = key ? raw[key] : undefined;
	const node = Array.isArray(value) ? value[0] : value;
	return node && typeof node === 'object' ? (node as XmlObject) : undefined;
}

/**
 * Parse one `dgm:styleLbl`'s 3D. An empty `<dgm:sp3d/>` / `<dgm:txPr/>` (the
 * flat quick styles) yields nothing, so a flat label stays flat.
 */
export function parseSmartArtStyleLabel3d(
	raw: XmlObject,
	localName: LocalName,
	parseColor: ParseColor,
): SmartArtStyleLabel3d | undefined {
	const result: SmartArtStyleLabel3d = {};

	const scene = childObject(raw, 'scene3d', localName);
	if (scene) {
		result.scene3d = parsePptx3DScene(scene);
	}

	const sp3d = childObject(raw, 'sp3d', localName);
	if (sp3d && Object.keys(sp3d).length > 0) {
		result.shape3d = parsePptx3DShape(sp3d, parseColor);
	}

	const txPr = childObject(raw, 'txPr', localName);
	if (txPr) {
		const textStyle: TextStyle = {};
		parseTextBodySp3d(txPr, textStyle, parseColor);
		if (textStyle.text3d) {
			result.text3d = textStyle.text3d;
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}
