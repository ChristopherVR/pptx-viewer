import { SvgExporter } from 'pptx-viewer-core';
import type { PptxData, PptxSlide, SvgExportOptions } from 'pptx-viewer-core';

/** Export one parsed slide as resolution-independent SVG markup. */
export function exportSlideToSvg(
	slide: PptxSlide,
	width: number,
	height: number,
	options?: SvgExportOptions,
): string {
	return SvgExporter.exportSlide(slide, width, height, options);
}

/** Export one parsed slide as an SVG Blob. */
export function exportSlideToSvgBlob(
	slide: PptxSlide,
	width: number,
	height: number,
	options?: SvgExportOptions,
): Blob {
	return new Blob([exportSlideToSvg(slide, width, height, options)], {
		type: 'image/svg+xml;charset=utf-8',
	});
}

/** Export all selected slides using the core SVG renderer. */
export function exportAllSlidesToSvg(data: PptxData, options?: SvgExportOptions): string[] {
	return SvgExporter.exportAll(data, options);
}

/** Add the print dialog's optional slide frame without rasterising the SVG. */
export function addSvgSlideFrame(svg: string, width: number, height: number): string {
	const frame = `<rect x="1" y="1" width="${Math.max(0, width - 2)}" height="${Math.max(0, height - 2)}" fill="none" stroke="#000" stroke-width="2" />`;
	return svg.replace('</svg>', `${frame}</svg>`);
}

export type { SvgExportOptions } from 'pptx-viewer-core';
