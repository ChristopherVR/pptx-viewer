/**
 * Framework-agnostic rendering & editing helpers shared by the React, Vue, and
 * Angular `pptx-viewer` bindings. Pure TypeScript (no framework imports) — each
 * binding consumes one copy instead of duplicating it.
 *
 * - geometry:   `shape-geometry` (preset clip-path cascade over core).
 * - fills:      `fill-style` (image/gradient/pattern/solid → CSS).
 * - effects:    `visual-effects` (shadow/glow/reflection/DAG), `image-effects`.
 * - text:       `text-warp` (WordArt paths), `omml-to-mathml` (equations).
 * - charts:     `chart-helpers` (layout/palette/axis math).
 * - animation:  `animation-css` (preset → CSS keyframes).
 * - editing:    `element-align` (align/distribute), `element-interaction`
 *               (drag/resize/rotate math).
 */
export * from './shape-geometry';
export * from './fill-style';
export * from './visual-effects';
export * from './image-effects';
export * from './text-warp';
export * from './omml-to-mathml';
export * from './chart-helpers';
export * from './animation-css';
export * from './element-align';
export * from './element-interaction';
