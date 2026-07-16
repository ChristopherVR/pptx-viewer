import type { PptxData, PptxSlide, SvgExportOptions } from 'pptx-viewer-core';
import { SvgExporter } from 'pptx-viewer-core';

/** Export one parsed slide as resolution-independent SVG markup. */
export function exportSlideToSvg(
	slide: PptxSlide,
	width: number,
	height: number,
	options: SvgExportOptions = {},
): string {
	return SvgExporter.exportSlide(slide, width, height, options);
}

/** Export the selected slides in a parsed presentation as SVG markup. */
export function exportAllSlidesToSvg(data: PptxData, options: SvgExportOptions = {}): string[] {
	return SvgExporter.exportAll(data, options);
}

export type { SvgExportOptions } from 'pptx-viewer-core';
