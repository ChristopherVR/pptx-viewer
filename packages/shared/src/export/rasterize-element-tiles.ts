/**
 * Lower-level primitive behind `rasterize-element.ts`'s `rasterizeElement()`:
 * rasterises `element` into its raw per-tile canvases without stitching them.
 *
 * `rasterizeElement()` uses this and then stitches the tiles into one PNG
 * when tiling was needed. A caller that can place multiple images itself
 * (a PDF page, which has no canvas-size limit of its own) should use this
 * directly instead: `pdf-tile-placement.ts` maps each returned tile onto its
 * proportional position on a PDF page, so a PDF/notes-PDF export escapes the
 * browser canvas cap without ever stitching a PNG at all.
 */
import { computeExportTilePlan, tileRectToSourceRect } from '../render/export-tile-plan';
import type {
	FontStyleDocumentLike,
	LinkStyleDocumentLike,
} from '../render/foreign-object-font-embed';
import { buildForeignObjectSvgBody } from '../render/foreign-object-svg-document';
import { probeMaxCanvasDimension } from './canvas-size-probe';
import type { RasterizeElementOptions } from './rasterize-element';
import type { RasterStrategy, RasterStrategyOptions } from './rasterize-element-strategy';
import { rasterizeWindow } from './rasterize-element-strategy';

/** One rasterised tile: its full-raster position/size plus the canvas and strategy that produced it. */
export interface RasterizedTile {
	/** 0-based column index (tiles in the same row share increasing `col`). */
	col: number;
	/** 0-based row index. */
	row: number;
	/** Left edge, in full-raster device pixels. */
	x: number;
	/** Top edge, in full-raster device pixels. */
	y: number;
	width: number;
	height: number;
	canvas: HTMLCanvasElement;
	strategy: RasterStrategy;
}

/** The full set of tiles covering one element's export, tiled or not. */
export interface RasterizeElementTilesResult {
	/** Full raster width in device pixels (sum of every column's width). */
	fullWidth: number;
	/** Full raster height in device pixels (sum of every row's height). */
	fullHeight: number;
	/** `false` when a single tile already covers the whole export. */
	tiled: boolean;
	/** Every tile, row-major order. Exactly one entry when `tiled` is `false`. */
	tiles: RasterizedTile[];
}

/** Prefix of the console warning emitted when a raster strategy silently degrades. */
export const RASTER_STRATEGY_FALLBACK_WARNING = '[pptx-viewer] raster export:';

/**
 * Default `onStrategyFailed`: a strategy failure is a silent fidelity
 * downgrade (foreignObject -> vector-SVG -> html2canvas), so surface it on the
 * console rather than let a lower-fidelity export ship unexplained. A binding
 * that wants telemetry instead passes its own `onStrategyFailed`.
 */
function warnStrategyFailed(strategy: RasterStrategy, error: unknown): void {
	const detail = error instanceof Error ? error.message : String(error);
	// oxlint-disable-next-line no-console -- deliberate diagnostic for a silent fidelity downgrade.
	console.warn(
		`${RASTER_STRATEGY_FALLBACK_WARNING} ${strategy} strategy failed, falling back to the next one (${detail})`,
	);
}

/**
 * Rasterise `element` (an attached, `naturalWidth` x `naturalHeight` CSS-pixel
 * stage) at `options.scale` into its raw per-tile canvases, tiling
 * transparently whenever the requested resolution exceeds the browser's
 * canvas cap. Builds the `foreignObject` SVG body once and reuses it for
 * every tile (see `render/foreign-object-svg-document.ts`).
 */
export async function rasterizeElementTiles(
	element: HTMLElement,
	naturalWidth: number,
	naturalHeight: number,
	doc: Document,
	options: RasterizeElementOptions,
): Promise<RasterizeElementTilesResult> {
	const scale = options.scale && options.scale > 0 ? options.scale : 1;
	const maxDim = options.maxCanvasDim ?? probeMaxCanvasDimension();
	const plan = computeExportTilePlan(naturalWidth * scale, naturalHeight * scale, maxDim);

	const body =
		options.mode === 'html2canvas'
			? undefined
			: await buildForeignObjectSvgBody(
					element,
					doc as Document & FontStyleDocumentLike & LinkStyleDocumentLike,
					{
						width: naturalWidth,
						height: naturalHeight,
						backgroundColor: options.backgroundColor,
					},
				);

	const strategyOptions: RasterStrategyOptions = {
		mode: options.mode,
		vectorSvgFallback: options.vectorSvgFallback,
		html2canvasFallback: options.html2canvasFallback,
		onStrategyFailed: options.onStrategyFailed ?? warnStrategyFailed,
	};

	const tiles: RasterizedTile[] = [];
	let done = 0;
	for (const tile of plan.tiles) {
		const { canvas, strategy } = await rasterizeWindow(
			body,
			tileRectToSourceRect(tile, scale),
			{ width: tile.width, height: tile.height },
			options.backgroundColor,
			strategyOptions,
		);
		tiles.push({
			col: tile.col,
			row: tile.row,
			x: tile.x,
			y: tile.y,
			width: tile.width,
			height: tile.height,
			canvas,
			strategy,
		});
		done++;
		options.onTileProgress?.(done, plan.tiles.length);
	}

	return { fullWidth: plan.fullWidth, fullHeight: plan.fullHeight, tiled: plan.tiled, tiles };
}

/**
 * Group `tiles` (row-major, as returned by {@link rasterizeElementTiles}) into
 * a 2D array indexed `[row][col]`. Shared by every caller that stitches tiles
 * row-by-row (`rasterize-element.ts`'s PNG stitch, `rasterize-element-tiled-canvas.ts`'s
 * canvas stitch) so the row/col grouping is written once.
 */
export function groupTilesByRow(tiles: readonly RasterizedTile[]): RasterizedTile[][] {
	const rowCount = tiles.reduce((max, t) => Math.max(max, t.row), 0) + 1;
	const rows: RasterizedTile[][] = Array.from({ length: rowCount }, () => []);
	for (const tile of tiles) {
		// `row`/`col` are declared as `number`, but this is a public export: a
		// caller could pass a `RasterizedTile[]` built from untrusted data whose
		// `row`/`col` are, at runtime, a string like `__proto__`. Indexing an
		// array with that string resolves through `Array.prototype` (itself
		// inherited from `Object.prototype`), so `rows[tile.row][tile.col] = tile`
		// would assign onto `Array.prototype` rather than `rows`, polluting every
		// array in the process. Requiring a genuine non-negative integer index
		// closes that off without changing behaviour for any real tile, which is
		// always produced by `computeExportTilePlan`'s integer loop counters.
		if (
			!Number.isInteger(tile.row) ||
			!Number.isInteger(tile.col) ||
			tile.row < 0 ||
			tile.col < 0
		) {
			continue;
		}
		rows[tile.row][tile.col] = tile;
	}
	return rows;
}
