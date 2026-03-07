/**
 * Framework-agnostic deep-cloning utilities for PPTX data structures.
 *
 * Provides specialised clone functions for TextStyle, ShapeStyle,
 * PptxElement, PptxSlide, and raw XmlObject trees. These are used
 * by the undo/redo system, clipboard operations, and template
 * instantiation to create independent copies without shared references.
 *
 * @module clone-utils
 */
import type {
  PptxElement,
  PptxSlide,
  TextStyle,
  ShapeStyle,
  XmlObject,
} from "../types";

/**
 * Shallow-clone a {@link TextStyle} object.
 *
 * @param style - The text style to clone.
 * @returns A new TextStyle copy, or `undefined` if the input is falsy.
 */
export function cloneTextStyle(style?: TextStyle): TextStyle | undefined {
  if (!style) return undefined;
  return { ...style };
}

/**
 * Clone a {@link ShapeStyle} object, including deep-cloning the
 * gradient stops array (since each stop is its own object).
 *
 * @param style - The shape style to clone.
 * @returns A new ShapeStyle copy, or `undefined` if the input is falsy.
 */
export function cloneShapeStyle(style?: ShapeStyle): ShapeStyle | undefined {
  if (!style) return undefined;
  return {
    ...style,
    // Deep-clone gradient stops since they are nested objects
    fillGradientStops: style.fillGradientStops
      ? style.fillGradientStops.map((stop) => ({ ...stop }))
      : undefined,
  };
}

/**
 * Deep-clone a {@link PptxElement}, correctly handling nested objects
 * for each element variant (text, shape, connector, image, etc.).
 *
 * Elements with text content get their textSegments and textStyle
 * deep-cloned; simpler element types use a shallow spread.
 *
 * @param element - The element to clone.
 * @returns A fully independent copy of the element.
 */
export function cloneElement(element: PptxElement): PptxElement {
  switch (element.type) {
    case "text":
    case "shape":
      return {
        ...element,
        textStyle: cloneTextStyle(element.textStyle),
        shapeStyle: cloneShapeStyle(element.shapeStyle),
        shapeAdjustments: element.shapeAdjustments
          ? { ...element.shapeAdjustments }
          : undefined,
        textSegments: element.textSegments
          ? element.textSegments.map((segment) => ({
              ...segment,
              style: cloneTextStyle(segment.style) || {},
            }))
          : undefined,
      };
    case "connector":
      return {
        ...element,
        shapeStyle: cloneShapeStyle(element.shapeStyle),
        shapeAdjustments: element.shapeAdjustments
          ? { ...element.shapeAdjustments }
          : undefined,
      };
    case "image":
    case "picture":
      return {
        ...element,
        shapeStyle: cloneShapeStyle(element.shapeStyle),
        shapeAdjustments: element.shapeAdjustments
          ? { ...element.shapeAdjustments }
          : undefined,
      };
    case "table":
    case "chart":
    case "smartArt":
    case "ole":
    case "media":
    case "group":
    case "ink":
    case "zoom":
    case "contentPart":
    case "unknown":
      return { ...element };
  }
}

/**
 * Deep-clone a {@link PptxSlide}, including its elements, comments,
 * and warnings arrays.
 *
 * @param slide - The slide to clone.
 * @returns A fully independent copy of the slide.
 */
export function cloneSlide(slide: PptxSlide): PptxSlide {
  return {
    ...slide,
    comments: slide.comments?.map((comment) => ({ ...comment })),
    warnings: slide.warnings?.map((warning) => ({ ...warning })),
    elements: slide.elements.map(cloneElement),
  };
}

/**
 * Deep-clone a mapping of slide IDs to template element arrays.
 *
 * Used when duplicating or resetting template element state so that
 * each slide gets its own independent element copies.
 *
 * @param templateElementsBySlideId - The mapping to clone.
 * @returns A new record with independently cloned element arrays.
 */
export function cloneTemplateElementsBySlideId(
  templateElementsBySlideId: Record<string, PptxElement[]>,
): Record<string, PptxElement[]> {
  const cloned: Record<string, PptxElement[]> = {};
  Object.entries(templateElementsBySlideId).forEach(([slideId, elements]) => {
    cloned[slideId] = elements.map(cloneElement);
  });
  return cloned;
}

/**
 * Deep-clone an {@link XmlObject} tree using JSON round-trip serialisation.
 *
 * This is a simple but reliable approach for pure-data XML objects.
 * Returns `undefined` if cloning fails (e.g. circular references).
 *
 * @param value - The XML object tree to clone.
 * @returns A deep copy, or `undefined` on failure.
 */
export function cloneXmlObject(
  value: XmlObject | undefined,
): XmlObject | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as XmlObject;
  } catch (error) {
    console.warn(
      "Failed to clone XML object, returning undefined.",
      value,
      error,
    );
    return undefined;
  }
}
