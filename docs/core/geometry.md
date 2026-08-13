---
title: Geometry Engine
description: Overview of the pptx-viewer-core geometry engine - all 187 ST_ShapeType preset shapes, clip paths, connector routing, the OOXML DrawingML guide-formula evaluator, and exported helpers.
---

# Geometry Engine

PowerPoint shapes are not stored as paths - they are defined by a shape **preset** plus adjustment handles, evaluated through the OOXML DrawingML guide-formula language (ISO/IEC 29500-1 section 20.1.9) to produce coordinates. The geometry module turns all of that into SVG paths and clip paths the renderer can use.

This is an overview of what the module does and the public helpers it exports (re-exported from `pptx-viewer-core`). It powers the viewer bindings' shape rendering and the headless [SVG export](/core/svg-export).

## Preset tables (verified counts)

Three exported tables cover the ECMA-376 preset catalogue from different angles:

`ST_ShapeType` (ISO/IEC 29500-1 section 20.1.10.56) is a **closed 187-value enumeration**, and every one of those 187 presets has a full evaluable definition. That 187 is the number to reason about; the table sizes below differ from it only because two of them carry extra lookup keys.

| Table                         | Keys | Contents                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRESET_SHAPE_GEOMETRY_TABLE` | 194  | Full evaluable geometry definitions (`avLst`, `gdLst`, `pathLst`, text rect). All 187 `ST_ShapeType` presets, plus 6 alias keys (`cylinder`, `pentArrow`, `flowChartStoredData`, `bentArrowCallout`, `bentUpArrowCallout`, `diamondTabs`) and one render-only invention, `mathFunction`, which has no ECMA equivalent and degrades to `rect` on save. |
| `PRESET_SHAPE_CLIP_PATHS`     | 200  | Precomputed static SVG clip paths keyed by preset name (includes aliases).                                                                                                                                                                                                                                                                            |
| `PRESET_SHAPE_DEFINITIONS`    | 187  | Insertable shape definitions with display names, grouped by `PRESET_SHAPE_CATEGORY_LABELS` into 9 categories: basic, rectangles, arrows, stars, callouts, flowchart, math, action, other.                                                                                                                                                             |

## What it handles

| Concern                 | Detail                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preset shapes**       | All 187 `ST_ShapeType` presets, evaluable (rects, arrows, stars, callouts, flowchart, action buttons, scrolls, brackets, etc.) with adjustment handles. |
| **Clip paths**          | Precomputed and adjustment-aware SVG clip paths for every preset.                                                                                       |
| **Guide formulas**      | Full OOXML DrawingML formula evaluator (operator list below) over built-in variables and adjustment handles (`adj`, `adj1`, ...).                       |
| **Custom geometry**     | Parsing and evaluation of arbitrary `<a:custGeom>` paths (`parseStructuredCustomGeometry`, `evaluateGeometryPaths`).                                    |
| **Connectors**          | Routing and path generation for straight / bent / curved connectors.                                                                                    |
| **Transforms**          | Element position, rotation, and flip transforms as CSS transform strings.                                                                               |
| **Boolean ops**         | Union / intersect / subtract / fragment of shapes (for merged geometry).                                                                                |
| **Freeform / callouts** | Freeform path building, Douglas-Peucker simplification, Catmull-Rom smoothing, callout leader-line geometry, cloud Bezier paths.                        |

## Resolving geometry for a shape

The highest-level path: evaluate the element's preset against its box and adjustments, and get SVG path data plus the text rectangle back. Signatures verified against `packages/core/src/core/geometry/`:

```ts
import { evaluatePresetShape, getAdjustmentAwareShapeClipPath } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

function resolveShapeGeometry(el: PptxElement) {
	if (el.type !== 'shape') return;

	// Full path geometry: SVG path data in pixel space + the text inset rect.
	const result = evaluatePresetShape(
		el.shapeType ?? 'rect', // preset name, e.g. 'roundRect', 'star5'
		el.width,
		el.height,
		el.shapeAdjustments, // optional Record<string, number> of adj overrides
	);
	// result: { svgPath: string; textRect?: { l: number; t: number; r: number; b: number } } | undefined

	// Or just a CSS/SVG clip-path value honouring the adjustment handles:
	const clip = getAdjustmentAwareShapeClipPath(
		el.shapeType,
		el.width,
		el.height,
		el.shapeAdjustments,
	);

	return { path: result?.svgPath, clip };
}
```

### Clip-path helpers

```ts
import {
	getShapeType, // normalize a raw preset name to a supported type ('rect' fallback)
	getShapeClipPath, // (shapeType: string | undefined) => static preset clip path
	getAdjustmentAwareShapeClipPath, // (shapeType, width, height, adjustments?) => adjusted clip path
	getShapeClipPathFromPreset, // (shapeType, width, height, adjustments?) => evaluated from the geometry table
	getPresetShapeClipPath, // raw lookup in PRESET_SHAPE_CLIP_PATHS
} from 'pptx-viewer-core';
```

Note that these take the **preset name string** (`element.shapeType`), not the element itself. All return CSS/SVG `clip-path` values (or `undefined` for unknown presets) used to mask the rendered element box.

## The guide-formula evaluator

Preset and custom geometry coordinates are expressed as ordered guide formulas. The evaluator implements every operator from ISO/IEC 29500-1 section 20.1.9.11 (verified against `guide-formula-eval.ts`):

| Operator                | Meaning                                         |
| ----------------------- | ----------------------------------------------- |
| `val`                   | literal value                                   |
| `abs`, `sqrt`           | absolute value, square root                     |
| `+-`                    | `x + y - z`                                     |
| `*/`                    | `(x * y) / z`                                   |
| `+/`                    | `(x + y) / z`                                   |
| `?:` (`if`)             | `x > 0 ? y : z`                                 |
| `min`, `max`            | minimum / maximum                               |
| `mod`                   | `sqrt(x^2 + y^2 + z^2)`                         |
| `pin`                   | clamp `y` between `x` and `z`                   |
| `sin`, `cos`, `tan`     | `x * fn(y)`, `y` in OOXML angle units           |
| `atan`, `at2` (`atan2`) | inverse trig, result in OOXML angle units       |
| `cat2`, `sat2`          | `x * cos(atan2(z, y))` / `x * sin(atan2(z, y))` |

Angles use OOXML units: 60,000ths of a degree (`cd4` = 90 degrees = 5,400,000).

Built-in variables seeded by `createBuiltinVariables({ w, h })`: `w`, `h`, `l`, `t`, `r`, `b`, `hc`, `vc`, width/height fractions `wd2`..`wd12` / `hd2`..`hd12`, short/long side `ss`, `ls`, `ssd2`..`ssd32`, and angular constants `cd2`, `cd4`, `cd8`, `3cd4`, `3cd8`, `5cd8`, `7cd8`.

```ts
import {
	parseGuideDefinitions, // (gdNodes) => GeometryGuide[] from parsed <a:gd> XML
	parseAdjustmentValues, // (gdNodes) => Map<string, number> from <a:avLst>
	createBuiltinVariables, // ({ w, h }) => Map<string, number>
	evaluateGuides, // (guides, { w, h }, adjustments?) => Map<string, number>
	evaluateGeometryPaths, // (pathNodes, variables, ensureArray) => { pathData, pathWidth, pathHeight } | null
	resolveCoordinate, // (value, variables) => number
	ooxmlArcToSvg, // convert an OOXML arcTo segment to an SVG arc
	lookupPresetShape, // (name) => PresetShapeGeometryDefinition | undefined (case-insensitive)
} from 'pptx-viewer-core';

const vars = evaluateGuides([{ name: 'half', formula: '*/ w 1 2' }], { w: 200, h: 100 });
vars.get('half'); // => 100
```

## Connectors

```ts
import { getConnectorPathGeometry, getConnectorAdjustment } from 'pptx-viewer-core';
import type { ConnectorPathGeometry } from 'pptx-viewer-core';

const geom = getConnectorPathGeometry(connectorElement);
// => { pathData: 'M 0 0 L 100 100', startX, startY, endX, endY }
```

`getConnectorPathGeometry(element)` routes straight (`line`), bent (`bentConnector2..5`), and curved (`curvedConnector2..5`) connectors from the element's box, flips, and adjustment values, returning the SVG path plus endpoint coordinates (useful for placing arrowheads).

## Transforms

```ts
import { getElementTransform, getTextCompensationTransform } from 'pptx-viewer-core';

const transform = getElementTransform(element);
// => CSS transform string combining scaleX(-1)/scaleY(-1)/rotate(...), or undefined
```

`getTextCompensationTransform` returns the inverse transform that keeps text upright inside a flipped shape.

## Boolean operations and freeform

For merged shapes and freeform drawing:

```ts
import {
	unionShapes,
	intersectShapes,
	subtractShapes,
	fragmentShapes,
	combineShapes,
	svgPathToPolygons,
	polygonsToSvgPath,
	FreeformPathBuilder,
	douglasPeucker,
	catmullRomToBezier,
} from 'pptx-viewer-core';
```

And callout geometry:

```ts
import {
	isCalloutShape,
	getCalloutTier,
	getCalloutLeaderLineGeometry,
	buildCalloutLeaderLineSvgPath,
} from 'pptx-viewer-core';
```

::: tip Rendering
You rarely call these directly when using a viewer binding - they are wired into the renderer. Reach for them when building a custom renderer or generating geometry outside the viewer (e.g. server-side). For visual output, see [/core/svg-export](/core/svg-export) and [/react/](/react/).
:::
