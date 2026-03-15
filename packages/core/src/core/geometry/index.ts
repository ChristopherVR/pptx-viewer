/**
 * Geometry module barrel export.
 *
 * Re-exports all public APIs for shape geometry resolution, connector path
 * generation, element transforms, preset shape clip-paths / definitions,
 * and the OOXML DrawingML guide formula evaluator.
 *
 * @module geometry
 */

export {
  getShapeType,
  getShapeClipPath,
  getRoundRectRadiusPx,
  getImageMaskStyle,
} from "./shape-geometry";
export type { ImageMaskStyle } from "./shape-geometry";

export {
  getConnectorAdjustment,
  getConnectorPathGeometry,
} from "./connector-geometry";
export type { ConnectorPathGeometry } from "./connector-geometry";

export {
  getElementTransform,
  getTextCompensationTransform,
} from "./transform-utils";

export {
  PRESET_SHAPE_CLIP_PATHS,
  PRESET_SHAPE_DEFINITIONS,
  PRESET_SHAPE_CATEGORY_LABELS,
  getPresetShapeClipPath,
} from "./preset-shape-paths";
export type {
  PresetShapeDefinition,
  PresetShapeCategory,
} from "./preset-shape-paths";

export {
  createBuiltinVariables,
  evaluateGuides,
  parseGuideDefinitions,
  parseAdjustmentValues,
  resolveCoordinate,
  evaluateGeometryPaths,
  ooxmlArcToSvg,
} from "./guide-formula";
export type { GeometryGuide, GeometryContext } from "./guide-formula";

export {
  unionShapes,
  intersectShapes,
  subtractShapes,
  fragmentShapes,
  combineShapes,
  mergeShapes,
  svgPathToPolygons,
  polygonsToSvgPath,
  unionPolygons,
  intersectPolygons,
  subtractPolygons,
  unionSvgPaths,
  intersectSvgPaths,
  subtractSvgPaths,
} from "./shape-boolean";
export type { Vec2, MergeShapeOperation } from "./shape-boolean";

export {
  FreeformPathBuilder,
  douglasPeucker,
  catmullRomToBezier,
} from "./freeform-builder";

export {
  isCalloutShape,
  getCalloutTier,
  getCalloutLeaderLineGeometry,
  buildCalloutLeaderLineSvgPath,
  getCalloutViewBoxBounds,
} from "./callout-geometry";
export type {
  CalloutPoint,
  CalloutLeaderLineGeometry,
} from "./callout-geometry";
