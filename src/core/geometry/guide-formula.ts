/**
 * OOXML DrawingML guide formula evaluator — barrel re-export.
 *
 * Core evaluation lives in `./guide-formula-eval.ts`,
 * public API helpers in `./guide-formula-api.ts`,
 * and geometry path evaluation in `./guide-formula-paths.ts`.
 */

export type { GeometryGuide, GeometryContext } from "./guide-formula-eval";
export {
  createBuiltinVariables,
  evaluateGuides,
  parseGuideDefinitions,
  parseAdjustmentValues,
  resolveCoordinate,
} from "./guide-formula-api";
export { evaluateGeometryPaths, ooxmlArcToSvg } from "./guide-formula-paths";
