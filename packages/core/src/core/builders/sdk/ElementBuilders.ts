/**
 * Fluent element builder classes for the headless PPTX SDK.
 *
 * These builders complement the functional {@link createTextElement},
 * {@link createShapeElement}, etc. factories by providing a step-by-step,
 * method-chaining API for constructing elements. Each builder's
 * {@link TextBuilder.build | .build()} method delegates to the
 * corresponding ElementFactory function, so the output is identical.
 *
 * Implementation is split across focused sub-modules:
 * - {@link TextBuilder} -- `./TextBuilder`
 * - {@link ShapeBuilder} -- `./ShapeBuilder`
 * - {@link ImageBuilder} -- `./ImageBuilder`
 * - {@link TableBuilder} -- `./TableBuilder`
 * - {@link ChartBuilder} -- `./ChartBuilder`
 * - {@link ConnectorBuilder} -- `./ConnectorBuilder`
 *
 * @example
 * ```ts
 * const title = TextBuilder.create("Hello")
 *   .fontSize(36).bold().color("#FF0000")
 *   .alignment("center")
 *   .position(100, 100).size(600, 50)
 *   .build();
 *
 * const chart = ChartBuilder.create("bar")
 *   .categories(["Q1", "Q2", "Q3"])
 *   .addSeries("Revenue", [100, 150, 130], "#4472C4")
 *   .title("Quarterly Revenue")
 *   .position(100, 150).size(600, 400)
 *   .build();
 * ```
 *
 * @module sdk/ElementBuilders
 */

export { TextBuilder } from './TextBuilder';
export { ShapeBuilder } from './ShapeBuilder';
export { ImageBuilder } from './ImageBuilder';
export { TableBuilder } from './TableBuilder';
export { ChartBuilder } from './ChartBuilder';
export { ConnectorBuilder } from './ConnectorBuilder';
export { MediaBuilder } from './MediaBuilder';
export { GroupBuilder } from './GroupBuilder';
