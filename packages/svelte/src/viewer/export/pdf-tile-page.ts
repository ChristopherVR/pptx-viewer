import type { RasterizeElementTilesResult } from 'pptx-viewer-shared';
import { placeTileOnPage } from 'pptx-viewer-shared';

/** The subset of jsPDF's `addImage` this module needs (duck-typed so callers can pass the real `jsPDF` instance). */
export interface JsPdfImageTarget {
	addImage(
		imageData: string,
		format: string,
		x: number,
		y: number,
		width: number,
		height: number,
	): unknown;
}

/**
 * Draw every tile of `tilesResult` onto `pdf`'s current page via `addImage`,
 * each placed at its proportional position (`placeTileOnPage`) on a
 * `pageWidth` x `pageHeight` page. Extracted out of `export-controller.svelte.ts`
 * purely to keep that file under the file-size budget; also independently
 * unit-testable without a `jsPDF` instance (a plain mock satisfying
 * {@link JsPdfImageTarget} is enough).
 *
 * A single-tile result (the overwhelming majority of exports) degrades to
 * exactly one full-page `addImage` call.
 */
export function addTiledPageImages(
	pdf: JsPdfImageTarget,
	tilesResult: RasterizeElementTilesResult,
	pageWidth: number,
	pageHeight: number,
): void {
	for (const tile of tilesResult.tiles) {
		const placement = placeTileOnPage(
			tile,
			tilesResult.fullWidth,
			tilesResult.fullHeight,
			pageWidth,
			pageHeight,
		);
		pdf.addImage(
			tile.canvas.toDataURL('image/png'),
			'PNG',
			placement.x,
			placement.y,
			placement.width,
			placement.height,
		);
	}
}
