/**
 * SmartArt DiagramML interpreter - constant shared by the `lin` (
 * `smartart-layout-interpreter-linear.ts`) and `snake` (
 * `smartart-layout-interpreter-snake.ts`) arrangers. Split into its own module
 * purely to avoid a circular import between the two (both need it; neither
 * should import the other).
 */

/**
 * No margin around the arrangement's outer edge by default: measured against
 * TWO independent gallery fixtures with no declared `begPad`/`endPad` (
 * `basic-process--flat3.pptx`: item x=0/main-axis-flush against a 0-local-x
 * container edge; `basic-block-list--flat3.pptx`, a `snake` arrangement: the
 * whole grid's bounding box spans 0.3%-0.2% of the frame from every edge,
 * i.e. touching it), PowerPoint's cached drawing reserves NO fixed-pixel
 * margin around a `lin`/`snake` arrangement's own bounding box. A previous
 * hardcoded `INSET = 6` was an unmeasured guess that this fixture evidence
 * disproves; `begPad`/`endPad`/`sibSp` are the ONLY real DiagramML sources of
 * spacing, and they default to `0` on their own.
 */
export const INSET = 0;
