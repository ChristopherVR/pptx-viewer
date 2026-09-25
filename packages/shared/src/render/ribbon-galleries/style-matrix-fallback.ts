/**
 * An approximate `<p:style>` resolver for when no handler is available
 * (previews rendered before a deck is loaded, or a host that built the viewer
 * without one). It follows the Office 2013-2022 theme's format scheme: fill 1
 * solid, fills 2/3 flattened to the reference colour, outlines 1/1.5/2 pt,
 * effect 3 a soft drop shadow. The real path is
 * `PptxHandler.resolveStyleMatrixReferences`.
 *
 * @module render/ribbon-galleries/style-matrix-fallback
 */
import type { ResolvedStyleMatrix, ShapeStyle, XmlObject } from 'pptx-viewer-core';

import { parseDrawingColorChoice } from '../drawing-color';

const LINE_WIDTH_PX = [0, 12700 / 9525, 19050 / 9525, 25400 / 9525];

function idxOf(node: XmlObject | undefined): number {
	return Number.parseInt(String(node?.['@_idx'] ?? '0'), 10) || 0;
}

export function fallbackResolveStyleMatrix(
	styleXml: XmlObject,
	colorMap: Readonly<Record<string, string>> | undefined,
): ResolvedStyleMatrix {
	const overrides = { ...colorMap } as Record<string, string | undefined>;
	const color = (node: XmlObject | undefined) => parseDrawingColorChoice(node, overrides);
	const fillRef = styleXml['a:fillRef'] as XmlObject | undefined;
	const lnRef = styleXml['a:lnRef'] as XmlObject | undefined;
	const effectRef = styleXml['a:effectRef'] as XmlObject | undefined;
	const style: ShapeStyle = {};
	const fillIdx = idxOf(fillRef);
	if (fillIdx === 0) {
		Object.assign(style, { fillMode: 'none', fillColor: 'transparent', fillOpacity: 0 });
	} else {
		Object.assign(style, { fillMode: 'solid', fillColor: color(fillRef), fillRefIdx: fillIdx });
	}
	const lnIdx = idxOf(lnRef);
	if (lnIdx === 0) {
		Object.assign(style, { strokeColor: 'transparent', strokeWidth: 0 });
	} else {
		Object.assign(style, {
			strokeColor: color(lnRef),
			strokeWidth: LINE_WIDTH_PX[Math.min(lnIdx, 3)],
			lnRefIdx: lnIdx,
		});
	}
	const effectIdx = idxOf(effectRef);
	if (effectIdx > 0) {
		style.effectRefIdx = effectIdx;
	}
	if (effectIdx === 3) {
		Object.assign(style, {
			shadowColor: '#000000',
			shadowOpacity: 0.63,
			shadowBlur: 57150 / 9525,
			shadowOffsetX: 0,
			shadowOffsetY: 19050 / 9525,
		});
	}
	const fontRef = styleXml['a:fontRef'] as XmlObject | undefined;
	if (fontRef) {
		style.fontRefIdx = String(fontRef['@_idx'] ?? 'minor');
	}
	return { shapeStyle: style, fontColor: color(fontRef) };
}
