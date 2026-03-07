/**
 * OOXML DrawingML guide formula evaluator — barrel re-export.
 *
 * This module consolidates the guide formula system into a single import path.
 * The implementation is split across three internal modules:
 *
 * - **guide-formula-eval** — Core types (`GeometryGuide`, `GeometryContext`),
 *   formula parsing, operand resolution, and formula evaluation.
 * - **guide-formula-api** — Public helpers for seeding built-in variables,
 *   evaluating guide lists, parsing XML guide/adjustment nodes, and
 *   resolving path coordinates.
 * - **guide-formula-paths** — Geometry path evaluation that converts
 *   `a:custGeom` path definitions (with formula-resolved coordinates)
 *   into SVG path data strings.
 *
 * @module guide-formula
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
