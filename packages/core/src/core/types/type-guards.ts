/**
 * Runtime type guards for narrowing the {@link PptxElement} union.
 *
 * @module pptx-types/type-guards
 */

// ==========================================================================
// Type guards for PptxElement discrimination
// ==========================================================================

import type {
  PptxElement,
  TextPptxElement,
  ShapePptxElement,
  ConnectorPptxElement,
  InkPptxElement,
  PptxImageLikeElement,
  PptxElementWithText,
  PptxElementWithShapeStyle,
} from "./elements";

/**
 * Narrows a {@link PptxElement} to {@link TextPptxElement}.
 *
 * @param element - Any PPTX element.
 * @returns `true` when `element.type === "text"`.
 *
 * @example
 * ```ts
 * if (isTextElement(el)) {
 *   // => true when el.type === "text"
 *   console.log(el.text, el.textSegments);
 * }
 * ```
 */
export function isTextElement(
  element: PptxElement,
): element is TextPptxElement {
  return element.type === "text";
}

/**
 * Narrows a {@link PptxElement} to {@link ShapePptxElement}.
 *
 * @param element - Any PPTX element.
 * @returns `true` when `element.type === "shape"`.
 *
 * @example
 * ```ts
 * if (isShapeElement(el)) {
 *   // => true when el.type === "shape"
 *   console.log(el.shapeType, el.shapeStyle);
 * }
 * ```
 */
export function isShapeElement(
  element: PptxElement,
): element is ShapePptxElement {
  return element.type === "shape";
}

/**
 * Narrows a {@link PptxElement} to {@link ConnectorPptxElement}.
 *
 * @param element - Any PPTX element.
 * @returns `true` when `element.type === "connector"`.
 *
 * @example
 * ```ts
 * if (isConnectorElement(el)) {
 *   // => true when el.type === "connector"
 *   console.log(el.connectionStart, el.connectionEnd);
 * }
 * ```
 */
export function isConnectorElement(
  element: PptxElement,
): element is ConnectorPptxElement {
  return element.type === "connector";
}

/**
 * Narrows a {@link PptxElement} to {@link PptxImageLikeElement}
 * (image or picture).
 *
 * @param element - Any PPTX element.
 * @returns `true` when `element.type` is `"image"` or `"picture"`.
 *
 * @example
 * ```ts
 * if (isImageLikeElement(el)) {
 *   // => true when el.type === "image" or "picture"
 *   console.log(el.imagePath, el.altText);
 * }
 * ```
 */
export function isImageLikeElement(
  element: PptxElement,
): element is PptxImageLikeElement {
  return element.type === "image" || element.type === "picture";
}

/**
 * Narrows a {@link PptxElement} to {@link InkPptxElement}.
 *
 * @param element - Any PPTX element.
 * @returns `true` when `element.type === "ink"`.
 *
 * @example
 * ```ts
 * if (isInkElement(el)) {
 *   // => true when el.type === "ink"
 *   console.log(el.inkSvg);
 * }
 * ```
 */
export function isInkElement(element: PptxElement): element is InkPptxElement {
  return element.type === "ink";
}

/**
 * Narrows to elements that have `text`, `textStyle`, and `textSegments`
 * properties (text, shape, or connector elements).
 *
 * @param element - Any PPTX element.
 * @returns `true` when the element carries text properties.
 *
 * @example
 * ```ts
 * if (hasTextProperties(el)) {
 *   // => true for text, shape, or connector elements
 *   console.log(el.text, el.textStyle, el.textSegments);
 * }
 * ```
 */
export function hasTextProperties(
  element: PptxElement,
): element is PptxElementWithText {
  return (
    element.type === "text" ||
    element.type === "shape" ||
    element.type === "connector"
  );
}

/**
 * Narrows to elements that have `shapeStyle`, `shapeType`, and
 * `shapeAdjustments` properties (text, shape, connector, image, or picture).
 *
 * @param element - Any PPTX element.
 * @returns `true` when the element carries shape-style properties.
 *
 * @example
 * ```ts
 * if (hasShapeProperties(el)) {
 *   // => true for text, shape, connector, image, or picture elements
 *   console.log(el.shapeStyle, el.shapeType);
 * }
 * ```
 */
export function hasShapeProperties(
  element: PptxElement,
): element is PptxElementWithShapeStyle {
  return (
    element.type === "text" ||
    element.type === "shape" ||
    element.type === "connector" ||
    element.type === "image" ||
    element.type === "picture"
  );
}
