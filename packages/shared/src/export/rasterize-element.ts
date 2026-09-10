import type { RasterStrategy, RasterStrategyOptions } from './rasterize-element-strategy';
/**
 * Top-level per-element raster-export orchestrator: the single entry point
 * every binding's export handler calls for PNG/JPEG/PDF-page rasterisation.
 *
 * Built on `rasterize-element-tiles.ts`'s `rasterizeElementTiles()` (the raw
 * per-tile canvases), plus `tile-row-stitch.ts` + `streaming-png-encoder.ts`
 * to stitch a tiled export's per-tile canvases into one PNG file no single
 * canvas could have held.
 *
 * The non-tiled case (the overwhelming majority of exports) returns a plain
 * `HTMLCanvasElement`, so existing per-binding code (`canvas.toBlob`, JPEG
 * re-encoding for PDF pages, etc.) keeps working unchanged. Only an export
 * whose full resolution exceeds the browser's canvas cap returns pre-encoded
 * PNG bytes instead, since no single canvas could stage the full image for
 * `toBlob`/`toDataURL` to encode. A caller that can place multiple images
 * itself (PDF/notes-PDF, via `rasterizeElementTiles` + `pdf-tile-placement.ts`
 * directly) should prefer that over stitching, since a PDF page has no
 * canvas-size limit to escape in the first place.
 */
import type { RasterizedTile } from './rasterize-element-tiles';
import { rasterizeElementTiles } from './rasterize-element-tiles';
import { encodePngFromRowBands } from './streaming-png-encoder';
import { combineTileRowPixels } from './tile-row-stitch';

/** Options controlling one element's raster export. */
export interface RasterizeElementOptions {
	/** Export scale multiplier on top of the element's natural (1x) size. Default 1. */
	scale?: number;
	/** Solid background painted behind transparent content. */
	backgroundColor?: string;
	/** Override the probed canvas-dimension cap (mainly a test seam). */
	maxCanvasDim?: number;
	/** `'html2canvas'` skips straight to the documented legacy fallback. Default `'auto'`. */
	mode?: RasterStrategyOptions['mode'];
	/** Re-windows the existing vector-SVG export pipeline; see `rasterize-element-strategy.ts`. */
	vectorSvgFallback?: RasterStrategyOptions['vectorSvgFallback'];
	/** The per-binding `html2canvas-pro` driver, last resort. */
	html2canvasFallback: RasterStrategyOptions['html2canvasFallback'];
	/** Called whenever a strategy is attempted and fails, for diagnostics/telemetry. */
	onStrategyFailed?: RasterStrategyOptions['onStrategyFailed'];
	/** Called after each tile finishes, for progress UI on large tiled exports. */
	onTileProgress?: (done: number, total: number) => void;
}

/** The common case: a normal canvas any `toBlob`/`toDataURL` caller can use directly. */
export interface RasterizeElementCanvasResult {
	kind: 'canvas';
	canvas: HTMLCanvasElement;
	strategy: RasterStrategy;
	width: number;
	height: number;
}

/** The tiled case: pre-encoded PNG bytes, since no single canvas held the full image. */
export interface RasterizeElementPngBytesResult {
	kind: 'png-bytes';
	bytes: Uint8Array;
	width: number;
	height: number;
	/** Strategy used per tile, in row-major order, for diagnostics/tests. */
	strategies: RasterStrategy[];
}

export type RasterizeElementResult = RasterizeElementCanvasResult | RasterizeElementPngBytesResult;

function groupTilesByRow(tiles: readonly RasterizedTile[]): RasterizedTile[][] {
	const rowCount = tiles.reduce((max, t) => Math.max(max, t.row), 0) + 1;
	const rows: RasterizedTile[][] = Array.from({ length: rowCount }, () => []);
	for (const tile of tiles) {
		rows[tile.row][tile.col] = tile;
	}
	return rows;
}

async function stitchTilesToPng(
	fullWidth: number,
	fullHeight: number,
	tiles: readonly RasterizedTile[],
): Promise<Uint8Array> {
	const rows = groupTilesByRow(tiles);

	async function* rowBands() {
		for (const rowTiles of rows) {
			const pixelTiles = rowTiles.map((tile) => {
				const ctx = tile.canvas.getContext('2d');
				if (!ctx) {
					throw new Error('rasterizeElement: 2D canvas context unavailable while stitching tiles');
				}
				return {
					pixels: ctx.getImageData(0, 0, tile.canvas.width, tile.canvas.height).data,
					width: tile.canvas.width,
					height: tile.canvas.height,
				};
			});
			yield {
				pixels: combineTileRowPixels(pixelTiles, fullWidth),
				bandHeight: pixelTiles[0].height,
			};
		}
	}

	return encodePngFromRowBands(fullWidth, fullHeight, rowBands());
}

/**
 * Rasterise `element` (an attached, `naturalWidth` x `naturalHeight` CSS-pixel
 * stage) at `options.scale`, tiling transparently if the requested
 * resolution exceeds the browser's canvas cap.
 */
export async function rasterizeElement(
	element: HTMLElement,
	naturalWidth: number,
	naturalHeight: number,
	doc: Document,
	options: RasterizeElementOptions,
): Promise<RasterizeElementResult> {
	const { fullWidth, fullHeight, tiled, tiles } = await rasterizeElementTiles(
		element,
		naturalWidth,
		naturalHeight,
		doc,
		options,
	);

	if (!tiled) {
		const only = tiles[0];
		return {
			kind: 'canvas',
			canvas: only.canvas,
			strategy: only.strategy,
			width: only.width,
			height: only.height,
		};
	}

	const bytes = await stitchTilesToPng(fullWidth, fullHeight, tiles);
	return {
		kind: 'png-bytes',
		bytes,
		width: fullWidth,
		height: fullHeight,
		strategies: tiles.map((t) => t.strategy),
	};
}
