/**
 * Framework-agnostic rendering & editing helpers shared by the React, Vue, and
 * Angular `pptx-viewer` bindings. Pure TypeScript (no framework imports) — each
 * binding consumes one copy instead of duplicating it.
 *
 * - geometry:   `shape-geometry` (preset clip-path cascade over core).
 * - fills:      `fill-style` (image/gradient/pattern/solid → CSS).
 * - effects:    `visual-effects` (shadow/glow/reflection/DAG), `image-effects`.
 * - text:       `text-warp` (WordArt paths), `omml-to-mathml` (equations).
 * - charts:     `chart-helpers` (layout/palette/axis math), `chart-trendlines`
 *               (regression overlays).
 * - animation:  `animation-css` (preset → CSS keyframes).
 * - 3d:         `visual-3d` (scene3d/shape3d → CSS transform/shadow pieces).
 * - tables:     `table-style` (cell style + banding → CSS).
 * - editing:    `element-align` (align/distribute), `element-interaction`
 *               (drag/resize/rotate math).
 * - connectors: `connector-router` (orthogonal A* obstacle-avoiding routing +
 *               SVG path serialisation), `connector-reroute` (dynamic endpoint
 *               recalculation when connected shapes move + connection sites).
 */
export * from './shape-geometry';
export * from './fill-style';
export * from './visual-effects';
export * from './image-effects';
export * from './text-warp';
export * from './omml-to-mathml';
export * from './latex-to-omml';
export * from './chart-helpers';
export * from './chart-trendlines';
export * from './animation-css';
export * from './visual-3d';
export * from './table-style';
export * from './element-align';
export * from './element-interaction';
export * from './bullet-autonum';
export * from './bullet-list';
export * from './text-paragraphs';
export * from './connector-router';
export * from './connector-reroute';
export * from './connector-style';
