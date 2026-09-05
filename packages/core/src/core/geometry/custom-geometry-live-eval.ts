/**
 * Live (per-render) re-evaluation of an `a:custGeom` freeform's outline
 * against a CURRENT `shapeAdjustments` override map, instead of the numbers
 * `buildStructuredCustomGeometryPaths`/`parseCustomGeometry` froze once at
 * parse time from the `a:avLst` DEFAULTS.
 *
 * Wave 1 (G3 of the D3 geometry audit) made an `a:ahXY`/`a:ahPolar` handle
 * derivable and draggable (`shape-adjustment-custom-geometry.ts` in
 * `pptx-viewer-shared`, using `resolveCustomGeometryGuideContext` from
 * `custom-geometry-guides.ts`) and made the dragged value write back into the
 * referenced `a:gdLst` guide ON SAVE (`custom-geometry-guide-writeback.ts`).
 * Neither step re-evaluates the PATH itself: the handle moves, but the
 * shape's body only reshapes once the file is saved and reloaded. This module
 * closes that gap by evaluating the same formula-bearing `a:pathLst` XML
 * (preserved verbatim on `CustomGeometryRawData.pathLstXml`, see
 * `PptxHandlerRuntimeGeometryParsing.extractCustomGeometryRawData`) against a
 * guide context that already has the in-progress override applied, exactly
 * the way a preset shape's `evaluatePresetShape` re-evaluates its polygon
 * from `shapeAdjustments` on every render.
 *
 * @module geometry/custom-geometry-live-eval
 */
import type {
	AdjustHandlePolar,
	AdjustHandleXY,
	ConnectionSite,
	CustomGeometryPath,
	CustomGeometryRawData,
	CustomGeometryTextRect,
	XmlObject,
} from '../types';
import { ensureArrayValue } from '../utils';
import { customGeometryPathsToXml } from './custom-geometry';
import { resolveCustomGeometryGuideContext } from './custom-geometry-guides';
import { buildCustomGeometryPathsFromNodes } from './custom-geometry-parser';
import { evaluateGeometryPaths } from './guide-formula-paths';

/** `(value) => unknown[]`, wrapping the generic `ensureArrayValue` for callers below. */
const ensureArray = (value: unknown): unknown[] => ensureArrayValue<unknown>(value);

/** The `a:pathLst/a:path` node array preserved on `rawData.pathLstXml`, or empty. */
function pathNodesOf(rawData: CustomGeometryRawData | undefined): XmlObject[] {
	const pathLst = rawData?.pathLstXml as XmlObject | undefined;
	return ensureArrayValue(pathLst?.['a:path']) as XmlObject[];
}

/**
 * Re-evaluate a custom geometry's `a:pathLst` into a single, already-scaled
 * SVG `d` string plus its coordinate-space dimensions, at `overrides` on top
 * of the geometry's own `a:avLst` defaults.
 *
 * Reuses {@link evaluateGeometryPaths}, the exact evaluator
 * `PptxHandlerRuntimeGeometryParsing.parseCustomGeometry` uses at parse time
 * (correct multi-`@w`/`@h` sub-path rescaling into one shared viewBox; see
 * that module's "Verified OK" note on why the simpler
 * `customGeometryPathsToSvg` must NOT be used here), so a live re-evaluation
 * produces byte-identical output to a fresh parse when `overrides` is empty.
 *
 * Returns `undefined` when `rawData` carries no preserved `a:pathLst` (an
 * older parse, or a shape with no raw data at all) or either dimension is
 * non-positive; the caller should fall back to the element's static
 * `pathData`/`pathWidth`/`pathHeight`.
 */
export function evaluateCustomGeometryPathData(
	rawData: CustomGeometryRawData | undefined,
	pathWidth: number,
	pathHeight: number,
	overrides: Record<string, number> | undefined,
): { pathData: string; pathWidth: number; pathHeight: number } | undefined {
	const pathNodes = pathNodesOf(rawData);
	if (pathNodes.length === 0 || !(pathWidth > 0) || !(pathHeight > 0)) {
		return undefined;
	}
	const variables = resolveCustomGeometryGuideContext(rawData, pathWidth, pathHeight, overrides);
	const result = evaluateGeometryPaths(pathNodes, variables, ensureArray);
	return result ?? undefined;
}

/**
 * Re-evaluate a custom geometry's `a:pathLst` into structured, per-sub-path
 * {@link CustomGeometryPath} data (segments as concrete numbers, one entry
 * per `a:path`), at `overrides` on top of the geometry's own `a:avLst`
 * defaults. The structured counterpart to
 * {@link evaluateCustomGeometryPathData}: use this when per-sub-path
 * `@fill`/`@stroke` intent must survive (feeds
 * `customGeometryPathsToSvgSubpaths`), use the other for a single merged
 * outline (a CSS `clip-path`).
 *
 * Returns `undefined` under the same conditions as
 * {@link evaluateCustomGeometryPathData}.
 */
export function evaluateCustomGeometryPaths(
	rawData: CustomGeometryRawData | undefined,
	pathWidth: number,
	pathHeight: number,
	overrides: Record<string, number> | undefined,
): CustomGeometryPath[] | undefined {
	const pathNodes = pathNodesOf(rawData);
	if (pathNodes.length === 0 || !(pathWidth > 0) || !(pathHeight > 0)) {
		return undefined;
	}
	const variables = resolveCustomGeometryGuideContext(rawData, pathWidth, pathHeight, overrides);
	return buildCustomGeometryPathsFromNodes(
		pathNodes,
		pathWidth,
		pathHeight,
		variables,
		ensureArray,
	);
}

/**
 * The single source of truth `PptxHandlerRuntimeSaveElementEmbedding.
 * applyGeometryUpdate` serializes into `a:pathLst`: `fallbackPaths` (the
 * numbers frozen at PARSE time) would otherwise disagree with the `a:avLst`
 * `applyCustomGeometryGuideOverrides` commits right after it, since a
 * `shapeAdjustments` drag never re-baked `fallbackPaths`. Re-evaluating from
 * `rawData` against the CURRENT `overrides` keeps the saved geometry and its
 * own guide defaults consistent; `fallbackPaths` is used only when there is
 * no raw data to re-evaluate (an older parse, or an SDK-built shape).
 */
export function resolveSaveTimeCustomGeometryPaths(
	rawData: CustomGeometryRawData | undefined,
	pathWidth: number,
	pathHeight: number,
	overrides: Record<string, number> | undefined,
	fallbackPaths: CustomGeometryPath[],
): CustomGeometryPath[] {
	return evaluateCustomGeometryPaths(rawData, pathWidth, pathHeight, overrides) ?? fallbackPaths;
}

/** The custom-geometry slots `applyGeometryUpdate` reads off a shape/image/picture element. */
export interface SaveTimeCustomGeometryElement {
	customGeometryPaths?: CustomGeometryPath[];
	customGeometryRawData?: CustomGeometryRawData;
	pathWidth?: number;
	pathHeight?: number;
	customGeometryAdjustHandlesXY?: AdjustHandleXY[];
	customGeometryAdjustHandlesPolar?: AdjustHandlePolar[];
	customGeometryConnectionSites?: ConnectionSite[];
	customGeometryTextRect?: CustomGeometryTextRect;
}

/**
 * Build the `a:custGeom` XML `applyGeometryUpdate` writes to `spPr`,
 * re-deriving `a:pathLst` from raw geometry XML against `shapeAdjustments`
 * (see {@link resolveSaveTimeCustomGeometryPaths}) before handing it to
 * {@link customGeometryPathsToXml}. Callers still patch the result's
 * `a:avLst` via `applyCustomGeometryGuideOverrides`.
 */
export function buildSaveTimeCustomGeometryXml(
	el: SaveTimeCustomGeometryElement,
	shapeAdjustments: Record<string, number> | undefined,
): XmlObject {
	const livePaths = resolveSaveTimeCustomGeometryPaths(
		el.customGeometryRawData,
		el.pathWidth ?? 0,
		el.pathHeight ?? 0,
		shapeAdjustments,
		el.customGeometryPaths ?? [],
	);
	return customGeometryPathsToXml(livePaths, el.customGeometryRawData, {
		adjustHandlesXY: el.customGeometryAdjustHandlesXY,
		adjustHandlesPolar: el.customGeometryAdjustHandlesPolar,
		connectionSites: el.customGeometryConnectionSites,
		textRect: el.customGeometryTextRect,
	});
}
