import { SvgExporter } from 'pptx-viewer-core';
import type { PptxData, PptxSlide, SvgExportOptions } from 'pptx-viewer-core';
import { downloadBlob } from 'pptx-viewer-shared';

export type SvgExportSingleSlideOptions = SvgExportOptions;
export type SvgExportAllOptions = SvgExportOptions;

/** Export one parsed slide as self-contained SVG markup. */
export function exportSlideToSvg(
	slide: PptxSlide,
	width: number,
	height: number,
	options: SvgExportSingleSlideOptions = {},
): string {
	return SvgExporter.exportSlide(slide, width, height, options);
}

/** Export one parsed slide as an SVG Blob. */
export function exportSlideToSvgBlob(
	slide: PptxSlide,
	width: number,
	height: number,
	options: SvgExportSingleSlideOptions = {},
): Blob {
	return new Blob([exportSlideToSvg(slide, width, height, options)], {
		type: 'image/svg+xml;charset=utf-8',
	});
}

/** Export one parsed slide as an SVG download. */
export function exportSlideAsSvg(
	slide: PptxSlide,
	slideIndex: number,
	width: number,
	height: number,
	options: SvgExportSingleSlideOptions = {},
): void {
	downloadBlob(exportSlideToSvgBlob(slide, width, height, options), `slide-${slideIndex + 1}.svg`);
}

/** Export the selected presentation slides as SVG strings. */
export function exportAllSlidesToSvg(data: PptxData, options: SvgExportAllOptions = {}): string[] {
	return SvgExporter.exportAll(data, options);
}

/** Export the selected presentation slides as SVG Blobs. */
export function exportAllSlidesToSvgBlobs(
	data: PptxData,
	options: SvgExportAllOptions = {},
): Blob[] {
	return exportAllSlidesToSvg(data, options).map(
		(svg) => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
	);
}
