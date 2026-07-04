---
title: Geometry Engine
description: Overview of the pptx-viewer-core geometry engine - 187+ preset shapes, clip paths, connector routing, the OOXML DrawingML guide-formula evaluator, and exported helpers.
---

# Geometry Engine

PowerPoint shapes are not stored as paths - they're defined by a shape **preset** (one of 187+) plus adjustment handles, evaluated through the OOXML DrawingML guide-formula language to produce coordinates. The geometry module turns all of that into SVG paths and clip paths the renderer can use.

This is an overview of what the module does and the public helpers it exports (re-exported from `pptx-viewer-core`). It powers the viewer bindings' shape rendering and the headless [SVG export](/core/svg-export).

## What it handles

| Concern                 | Detail                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preset shapes**       | 187+ definitions (rect, roundRect, arrows, stars, callouts, flowchart, etc.) with adjustment handles.                                                                                                                                                          |
| **Clip paths**          | Pre-computed and adjustment-aware SVG clip paths for every preset.                                                                                                                                                                                             |
| **Guide formulas**      | Full OOXML DrawingML formula evaluator (`+/-`, `*/div`, `val`, `abs`, `sqrt`, `sin/cos/tan`, `at2`, `min/max`, `mod`, `pin`, `if`, `?:`) over built-in variables (`w`, `h`, `l/t/r/b`, `wd2`, `hd2`, `cd2/cd4/cd8`) and adjustment handles (`adj`, `adj1`, …). |
| **Custom geometry**     | Parsing of arbitrary `<a:custGeom>` paths.                                                                                                                                                                                                                     |
| **Connectors**          | Routing and path generation for straight / bent / curved connectors.                                                                                                                                                                                           |
| **Transforms**          | Element position, rotation, and flip transforms.                                                                                                                                                                                                               |
| **Boolean ops**         | Union / intersect / subtract / fragment of shapes (for merged geometry).                                                                                                                                                                                       |
| **Freeform / callouts** | Freeform path building, Douglas-Peucker simplification, callout leader-line geometry.                                                                                                                                                                          |

## Resolving a shape to a clip path

The main entry points convert a shape (by preset type) into an SVG clip path. Adjustment-aware variants honour the shape's draggable handles:

```ts
import {
	getShapeType,
	getShapeClipPath,
	getAdjustmentAwareShapeClipPath,
	getShapeClipPathFromPreset,
	getPresetShapeClipPath,
} from 'pptx-viewer-core';

const clip = getShapeClipPath(element);
```

These return CSS/SVG `clip-path` values used to mask the rendered element box.

## Evaluating preset shapes and guide formulas

For full path data (not just a clip), evaluate the preset against a width/height and adjustment values:

```ts
import {
	evaluatePresetShape,
	lookupPresetShape,
	evaluateGuides,
	parseGuideDefinitions,
	parseAdjustmentValues,
	evaluateGeometryPaths,
	resolveCoordinate,
	createBuiltinVariables,
	ooxmlArcToSvg,
} from 'pptx-viewer-core';
```

| Helper                                            | Purpose                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `lookupPresetShape(name)`                         | Look up a preset definition by OOXML shape name.                    |
| `evaluatePresetShape(...)`                        | Evaluate a preset to path geometry (`PresetShapeEvaluationResult`). |
| `parseGuideDefinitions` / `parseAdjustmentValues` | Parse `<a:gd>` guides and adjustment values from shape XML.         |
| `createBuiltinVariables`                          | Seed `w`, `h`, `l/t/r/b`, `wd2`, … for evaluation.                  |
| `evaluateGuides`                                  | Run the formula evaluator over a guide set.                         |
| `evaluateGeometryPaths` / `resolveCoordinate`     | Produce path commands / resolve a single coordinate.                |
| `ooxmlArcToSvg`                                   | Convert an OOXML arc segment to an SVG arc.                         |

The preset tables themselves are exported: `PRESET_SHAPE_GEOMETRY_TABLE`, `PRESET_SHAPE_CLIP_PATHS`, `PRESET_SHAPE_DEFINITIONS`, and `PRESET_SHAPE_CATEGORY_LABELS`.

## Connectors

```ts
import { getConnectorPathGeometry, getConnectorAdjustment } from 'pptx-viewer-core';
import type { ConnectorPathGeometry } from 'pptx-viewer-core';

const geom = getConnectorPathGeometry(connectorElement);
```

`getConnectorPathGeometry` routes straight / bent / curved connectors and returns the path geometry for rendering.

## Transforms

```ts
import { getElementTransform, getTextCompensationTransform } from 'pptx-viewer-core';

const transform = getElementTransform(element); // position / rotation / flip
```

## Boolean operations and freeform

For merged shapes and freeform drawing, the module exports boolean helpers and path utilities:

```ts
import {
	unionShapes,
	intersectShapes,
	subtractShapes,
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
You rarely call these directly when using a viewer binding - they're wired into the renderer. Reach for them when building a custom renderer or generating geometry outside the viewer (e.g. server-side). For the visual output, see [/core/svg-export](/core/svg-export) and [/react/](/react/).
:::
