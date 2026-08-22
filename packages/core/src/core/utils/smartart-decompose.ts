/**
 * SmartArt decomposition engine.
 *
 * Converts SmartArt data-model nodes into standard PptxElement[] shapes
 * that can be rendered by the existing shape/text renderer rather than
 * relying on a special-purpose SVG overlay.
 *
 * Layout algorithms live in `./smartart-layouts.ts` and
 * `./smartart-layouts-tree.ts`; shared helpers in `./smartart-helpers.ts`.
 *
 * When a parsed layout definition is available, the DiagramML interpreter in
 * `./smartart-layout-interpreter.ts` (the SAME interpreter every binding's
 * live preview uses, via `pptx-viewer-shared`'s re-export) is used for more
 * accurate positioning before falling back to the simpler heuristic layouts.
 * This used to run a second, weaker constraint-driven engine
 * (`smartart-layout-engine.ts`, deleted) that only implemented `lin`/`snake`/
 * `cycle`/`pyra`/`hierRoot`/`hierChild` and never interpreted control flow, so
 * a diagram whose live preview used `composite`/`conn`/`sp`/`tx` (or a decided
 * `dgm:choose`/`dgm:forEach`) was fabricated with a plain linear fallback on
 * save.
 */

import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtQuickStyle,
} from '../types';
import type { DrawingBounds } from './smartart-decompose-dispatch';
import {
	dispatchLayoutByType,
	dispatchNamedLayout,
	resolveEffectiveLayoutType,
} from './smartart-decompose-dispatch';
import { DEFAULT_ACCENT_COLORS, nextId, makeShapeElement } from './smartart-helpers';
import { interpretedLayoutToElements } from './smartart-interpreter-drawing-bridge';
import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import { flattenNodes } from './smartart-layout-style-helpers';
import { applyNodeStylesToElements } from './smartart-node-style-apply';
import { parseSmartArtPresLayoutVars } from './smartart-pres-layout-vars';

// ── Pre-computed drawing shape conversion ────────────────────────────────

/**
 * Compute a stroke-width multiplier based on SmartArt quick-style effect
 * intensity.  Subtle → thinner outlines, intense → heavier outlines.
 */
function quickStyleStrokeScale(quickStyle: PptxSmartArtQuickStyle | undefined): number {
	if (!quickStyle?.effectIntensity) {
		return 1;
	}
	switch (quickStyle.effectIntensity) {
		case 'subtle':
			return 0.5;
		case 'intense':
			return 2;
		default:
			return 1;
	}
}

function convertDrawingShapes(
	drawingShapes: PptxSmartArtDrawingShape[],
	containerBounds: DrawingBounds,
	colorTransformFills?: string[],
	quickStyle?: PptxSmartArtQuickStyle,
): PptxElement[] {
	const strokeScale = quickStyleStrokeScale(quickStyle);
	// Compute the bounding box of all drawing shapes to determine the offset
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const ds of drawingShapes) {
		if (ds.x < minX) {
			minX = ds.x;
		}
		if (ds.y < minY) {
			minY = ds.y;
		}
		if (ds.x + ds.width > maxX) {
			maxX = ds.x + ds.width;
		}
		if (ds.y + ds.height > maxY) {
			maxY = ds.y + ds.height;
		}
	}

	const drawingW = maxX - minX || 1;
	const drawingH = maxY - minY || 1;
	const scaleX = containerBounds.width / drawingW;
	const scaleY = containerBounds.height / drawingH;

	return drawingShapes.map((ds, index) => {
		const fill =
			ds.fillColor ??
			(colorTransformFills && colorTransformFills.length > 0
				? colorTransformFills[index % colorTransformFills.length]
				: DEFAULT_ACCENT_COLORS[index % DEFAULT_ACCENT_COLORS.length]);

		return makeShapeElement(
			nextId('sa-draw'),
			containerBounds.x + (ds.x - minX) * scaleX,
			containerBounds.y + (ds.y - minY) * scaleY,
			ds.width * scaleX,
			ds.height * scaleY,
			ds.shapeType ?? 'rect',
			fill,
			ds.text ?? '',
			{
				rotation: ds.rotation,
				skewX: ds.skewX,
				skewY: ds.skewY,
				pathData: ds.pathData,
				pathWidth: ds.pathWidth,
				pathHeight: ds.pathHeight,
				customGeometryPaths: ds.customGeometryPaths,
				customGeometryRawData: ds.customGeometryRawData,
				customGeometryAdjustHandlesXY: ds.customGeometryAdjustHandlesXY,
				customGeometryAdjustHandlesPolar: ds.customGeometryAdjustHandlesPolar,
				customGeometryConnectionSites: ds.customGeometryConnectionSites,
				customGeometryTextRect: ds.customGeometryTextRect,
				strokeColor: ds.strokeColor,
				strokeWidth: ds.strokeWidth !== undefined ? ds.strokeWidth * strokeScale : undefined,
				fontSize: ds.fontSize,
				fontColor: ds.fontColor ?? '#FFFFFF',
				textSegments: ds.textSegments,
			},
		);
	});
}

// ── Main decomposition entry point ──────────────────────────────────────

/**
 * Decompose a SmartArt data model into an array of standard PptxElements.
 *
 * @param smartArtData Parsed SmartArt data model from the PptxHandler.
 * @param containerBounds The bounding box of the SmartArt graphic frame on the slide.
 * @param themeColorMap Optional theme colour map (accent1-accent6 keys) for colour cycling.
 * @returns An array of PptxElements (shapes + connectors), or `undefined` when decomposition is not possible.
 */
export function decomposeSmartArt(
	smartArtData: PptxSmartArtData,
	containerBounds: DrawingBounds,
	themeColorMap?: Record<string, string>,
): PptxElement[] | undefined {
	const nodes = smartArtData.nodes;
	if (!nodes || nodes.length === 0) {
		return undefined;
	}

	// Prefer pre-computed drawing shapes when available — these reflect
	// PowerPoint's actual layout engine output and are the most accurate.
	if (smartArtData.drawingShapes && smartArtData.drawingShapes.length > 0) {
		const colorFills = smartArtData.colorTransform?.fillColors;
		return convertDrawingShapes(
			smartArtData.drawingShapes,
			containerBounds,
			colorFills,
			smartArtData.quickStyle,
		);
	}

	return computeSmartArtElementsWithoutCache(smartArtData, containerBounds, themeColorMap);
}

/**
 * Compute SmartArt shapes WITHOUT consulting `smartArtData.drawingShapes`:
 * the DiagramML interpreter when a recognised `layoutDefinition` is present,
 * falling back through the named/algorithmic/heuristic family approximation.
 *
 * Split out of {@link decomposeSmartArt} so `relayoutSmartArt` (recomputing
 * after a node is added/removed/reordered) can reuse the exact same
 * interpretation + fallback chain without also reprojecting whatever stale
 * `drawingShapes` happen to be on the data - `decomposeSmartArt`'s
 * drawing-shape branch is a REPROJECTION of cached geometry, not a "nothing
 * else worked" fallback, so `relayoutSmartArt` needs this narrower function
 * to keep its own "return the untouched existing shapes" fallback meaningful.
 */
export function computeSmartArtElementsWithoutCache(
	smartArtData: PptxSmartArtData,
	containerBounds: DrawingBounds,
	themeColorMap?: Record<string, string>,
): PptxElement[] | undefined {
	const nodes = smartArtData.nodes;
	if (!nodes || nodes.length === 0) {
		return undefined;
	}

	// When a parsed layout definition is available, run the DiagramML
	// interpreter for more accurate positioning: the same interpreter every
	// binding's live preview uses (via `pptx-viewer-shared`), so the fabricated
	// cached drawing matches what the viewer actually renders, including
	// `composite`/`conn`/`sp`/`tx` and decided `dgm:choose`/`dgm:forEach`.
	if (smartArtData.layoutDefinition) {
		const flat = flattenNodes(nodes);
		const interpreted = interpretSmartArtLayout({
			layoutDefinition: smartArtData.layoutDefinition,
			nodes,
			flat,
			box: { width: containerBounds.width, height: containerBounds.height },
			palette: resolveInterpreterPalette(themeColorMap, smartArtData.colorTransform?.fillColors),
			style: smartArtData.style ?? 'flat',
			elementId: 'smartart-fabrication',
			presLayoutVars: smartArtData.presLayoutVars,
		});
		if (interpreted && interpreted.nodes.length > 0) {
			return interpretedLayoutToElements(interpreted, nodes, containerBounds);
		}
	}

	// Apply colour-transform fill colours to the theme map when available
	const effectiveThemeMap = buildEffectiveThemeMap(
		themeColorMap,
		smartArtData.colorTransform?.fillColors,
	);

	// Resolve the effective layout type, preferring the named preset over
	// the resolved/raw type so SDK-created diagrams get the right algorithm.
	const layoutType = resolveEffectiveLayoutType(smartArtData);

	// Consult presentation layout variables (direction) so a reversed-flow
	// diagram lays its nodes out right-to-left. The full DiagramML interpreter
	// (org-chart / hierBranch geometry) is a separate follow-up; here we only
	// honour the coarse flow direction against the algorithmic fallback.
	const layoutVars =
		smartArtData.presLayoutVars ??
		parseSmartArtPresLayoutVars(smartArtData.layoutDefinition?.rawXml);
	const orderedNodes = layoutVars?.direction === 'rev' ? [...nodes].reverse() : nodes;

	// Check for specific named layouts that have their own algorithm,
	// before falling through to the general category dispatch.
	const namedLayout = smartArtData.layout;
	if (namedLayout) {
		const namedResult = dispatchNamedLayout(
			namedLayout,
			orderedNodes,
			containerBounds,
			effectiveThemeMap,
		);
		if (namedResult) {
			// Per-node colour / emphasis overrides win over the cycled palette.
			return applyNodeStylesToElements(namedResult, orderedNodes);
		}
	}

	const algorithmic = dispatchLayoutByType(
		layoutType,
		orderedNodes,
		containerBounds,
		effectiveThemeMap,
	);
	// Per-node colour / emphasis overrides win over the cycled palette.
	return algorithmic ? applyNodeStylesToElements(algorithmic, orderedNodes) : algorithmic;
}

// ── Internal helpers ────────────────────────────────────────────────────

/**
 * Build an effective theme colour map by overlaying color-transform fills
 * onto the accent1-accent6 theme keys.
 */
function buildEffectiveThemeMap(
	themeColorMap?: Record<string, string>,
	colorTransformFills?: string[],
): Record<string, string> | undefined {
	if (!colorTransformFills || colorTransformFills.length === 0) {
		return themeColorMap;
	}
	const merged: Record<string, string> = { ...themeColorMap };
	for (let i = 0; i < colorTransformFills.length && i < 6; i++) {
		merged[`accent${i + 1}`] = colorTransformFills[i];
	}
	return merged;
}

/**
 * Resolve the six-colour palette the interpreter cycles through: a colour
 * transform's fill colours win, then the theme's accent1-accent6, then the
 * hard-coded default accents.
 */
function resolveInterpreterPalette(
	themeColorMap: Record<string, string> | undefined,
	colorTransformFills: string[] | undefined,
): string[] {
	if (colorTransformFills && colorTransformFills.length > 0) {
		return colorTransformFills;
	}
	if (themeColorMap) {
		const accents = Array.from({ length: 6 }, (_, i) => themeColorMap[`accent${i + 1}`]).filter(
			(color): color is string => typeof color === 'string' && color.length > 0,
		);
		if (accents.length > 0) {
			return accents;
		}
	}
	return [...DEFAULT_ACCENT_COLORS];
}
