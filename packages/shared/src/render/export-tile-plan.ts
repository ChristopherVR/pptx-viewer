/**
 * Pure tile-planning for raster export beyond the browser's maximum canvas
 * size. No DOM dependency: given a full raster size (in device pixels, i.e.
 * the slide's logical size already multiplied by the requested export scale)
 * and the browser's probed canvas-dimension cap, this computes how many
 * tiles are needed, their pixel rectangles, and whether tiling is needed at
 * all.
 *
 * Every binding's export handler (React `useExportHandlers`, Vue
 * `useExport`/`useExportWiring`, Angular `export.service.ts`, Svelte
 * `export-controller.svelte.ts`, Vanilla `export-controller.ts`) calls this
 * once per export to decide whether to rasterise a slide in one shot or in
 * tiles, keeping the maths identical across all five bindings.
 */

/** A single tile's pixel rectangle within the full raster. */
export interface ExportTileRect {
	/** 0-based column index. */
	col: number;
	/** 0-based row index. */
	row: number;
	/** Left edge, in full-raster device pixels. */
	x: number;
	/** Top edge, in full-raster device pixels. */
	y: number;
	/** Tile width in device pixels (<= the cap; the last column may be narrower). */
	width: number;
	/** Tile height in device pixels (<= the cap; the last row may be shorter). */
	height: number;
}

/** The computed tiling plan for one export. */
export interface ExportTilePlan {
	/** Full raster width in device pixels. */
	fullWidth: number;
	/** Full raster height in device pixels. */
	fullHeight: number;
	/** `false` when the full raster already fits within `maxDim` on both axes. */
	tiled: boolean;
	/** Column count (1 when `tiled` is `false`). */
	cols: number;
	/** Row count (1 when `tiled` is `false`). */
	rows: number;
	/** Every tile rectangle, row-major order. `[fullRect]` when `tiled` is `false`. */
	tiles: ExportTileRect[];
}

/** Never plan a tile below this size, however small `maxDim` is reported. */
const MIN_TILE_DIM = 256;

/**
 * Compute the tile plan for a `fullWidth` x `fullHeight` device-pixel raster
 * given the browser's maximum single-axis canvas dimension (`maxDim`, from
 * {@link probeMaxCanvasDimension}).
 *
 * Tiles are laid out on a uniform grid sized so every tile is <= `maxDim` on
 * both axes; the last column/row absorbs the remainder so tiles are not
 * needlessly small. `maxDim` is clamped to at least {@link MIN_TILE_DIM} so a
 * degenerate probe result cannot produce an unusable (or infinite) grid.
 */
export function computeExportTilePlan(
	fullWidth: number,
	fullHeight: number,
	maxDim: number,
): ExportTilePlan {
	const safeMax = Math.max(MIN_TILE_DIM, Math.floor(maxDim));
	const fw = Math.max(1, Math.round(fullWidth));
	const fh = Math.max(1, Math.round(fullHeight));

	if (fw <= safeMax && fh <= safeMax) {
		return {
			fullWidth: fw,
			fullHeight: fh,
			tiled: false,
			cols: 1,
			rows: 1,
			tiles: [{ col: 0, row: 0, x: 0, y: 0, width: fw, height: fh }],
		};
	}

	const cols = Math.ceil(fw / safeMax);
	const rows = Math.ceil(fh / safeMax);
	const baseTileW = Math.ceil(fw / cols);
	const baseTileH = Math.ceil(fh / rows);

	const tiles: ExportTileRect[] = [];
	for (let row = 0; row < rows; row++) {
		const y = row * baseTileH;
		const height = Math.min(baseTileH, fh - y);
		for (let col = 0; col < cols; col++) {
			const x = col * baseTileW;
			const width = Math.min(baseTileW, fw - x);
			tiles.push({ col, row, x, y, width, height });
		}
	}

	return { fullWidth: fw, fullHeight: fh, tiled: true, cols, rows, tiles };
}

/**
 * Convert a device-pixel tile rectangle back into the *source* (unscaled,
 * pre-export-scale) coordinate space used by the element being rasterised
 * (an SVG `viewBox` window, or html2canvas's `x`/`y`/`width`/`height` crop
 * options). `scale` is the export scale factor applied on top of the
 * element's natural CSS pixel size.
 */
export function tileRectToSourceRect(
	tile: ExportTileRect,
	scale: number,
): { x: number; y: number; width: number; height: number } {
	const s = scale > 0 ? scale : 1;
	return {
		x: tile.x / s,
		y: tile.y / s,
		width: tile.width / s,
		height: tile.height / s,
	};
}
