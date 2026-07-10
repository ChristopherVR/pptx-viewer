import type { SmartArtPptxElement, SmartArtStyle } from 'pptx-viewer-core';
import type { RenderedShape, SmartArtLayoutResult } from 'pptx-viewer-shared';
import {
	buildChromeStyle,
	buildSmartArtA11y,
	computeDrawingViewBox,
	computeSmartArtLayout,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from 'pptx-viewer-shared';

import { styleToString } from '../style';

/**
 * View-model resolution for `smartArt` elements (port of the vanilla
 * binding's `renderSmartArtElement`). Palette / stroke / shadow / layout
 * geometry all come from `pptx-viewer-shared`; this module only picks the
 * rendering path and shapes the data for the `SmartArtView` SFC.
 */

/** Inline style applied to every SmartArt SVG so it fills the element box. */
export const SMARTART_SVG_STYLE = 'width: 100%; height: 100%; pointer-events: none; display: block';

/** Connector stroke for the fallback layout path. */
export const SMARTART_CONNECTOR_STROKE = '#94a3b8';

/** Resolved SmartArt view: drawing shapes, engine layout, or a placeholder. */
export type SmartArtView =
	| { kind: 'drawing'; viewBox: string; shapes: RenderedShape[]; shadow: string | undefined }
	| { kind: 'layout'; layout: SmartArtLayoutResult }
	| { kind: 'placeholder' };

/** Chrome (background / outline) style string for the graphic wrapper. */
export function smartArtChromeStyle(element: SmartArtPptxElement): string {
	return styleToString({ ...buildChromeStyle(element.smartArtData?.chrome), position: 'relative' });
}

/** Assistive-tech diagram label, when the element carries SmartArt data. */
export function smartArtAriaLabel(element: SmartArtPptxElement): string | undefined {
	return element.smartArtData ? buildSmartArtA11y(element.smartArtData).label : undefined;
}

/**
 * Pick the rendering path: pre-computed drawing shapes (preferred), the
 * shared layout engine over the node tree, or an empty placeholder.
 */
export function buildSmartArtView(element: SmartArtPptxElement): SmartArtView {
	const data = element.smartArtData;
	const nodes = data?.nodes ?? [];
	const drawingShapes = data?.drawingShapes ?? [];

	if (data && drawingShapes.length > 0) {
		const style: SmartArtStyle = data.style ?? 'flat';
		const viewBox = computeDrawingViewBox(drawingShapes);
		return {
			kind: 'drawing',
			viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
			shapes: projectDrawingShapes(element.id, drawingShapes, viewBox, resolvePalette(data), style),
			shadow: styleShadowFilter(style),
		};
	}

	if (data && nodes.length > 0) {
		return {
			kind: 'layout',
			layout: computeSmartArtLayout(
				nodes,
				{ width: element.width, height: element.height },
				resolvePalette(data),
				data.style ?? 'flat',
				element.id,
				data.resolvedLayoutType,
				data.layout,
			),
		};
	}

	return { kind: 'placeholder' };
}

/** One rendered line of a multi-line SVG label; `y` offsets the node centre. */
export interface SvgTextLine {
	text: string;
	y: number;
}

/**
 * Split node text on `\n` and compute per-line y offsets (in SVG px) that
 * centre the block around the node centre y (offset 0). Single-line text
 * produces one entry with y=0, preserving `dominant-baseline="central"`
 * behaviour exactly (mirrors Vue's / vanilla's `textLines`).
 */
export function svgTextLines(text: string, fontSize: number): SvgTextLine[] {
	const raw = text.split('\n').filter((l) => l.length > 0);
	if (raw.length === 0) {
		return [{ text: '', y: 0 }];
	}
	const lh = fontSize * 1.2;
	const totalH = raw.length * lh;
	return raw.map((line, i) => ({
		text: line,
		y: -totalH / 2 + lh / 2 + i * lh,
	}));
}
