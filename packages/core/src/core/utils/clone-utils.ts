/**
 * Framework-agnostic deep-cloning utilities for PPTX data structures.
 */
import type {
  PptxElement,
  PptxSlide,
  TextStyle,
  ShapeStyle,
  XmlObject,
} from "../types";

export function cloneTextStyle(style?: TextStyle): TextStyle | undefined {
  if (!style) return undefined;
  return { ...style };
}

export function cloneShapeStyle(style?: ShapeStyle): ShapeStyle | undefined {
  if (!style) return undefined;
  return {
    ...style,
    fillGradientStops: style.fillGradientStops
      ? style.fillGradientStops.map((stop) => ({ ...stop }))
      : undefined,
  };
}

/**
 * Deep-clone a PptxElement, correctly handling nested objects for each
 * element variant.
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

export function cloneSlide(slide: PptxSlide): PptxSlide {
  return {
    ...slide,
    comments: slide.comments?.map((comment) => ({ ...comment })),
    warnings: slide.warnings?.map((warning) => ({ ...warning })),
    elements: slide.elements.map(cloneElement),
  };
}

export function cloneTemplateElementsBySlideId(
  templateElementsBySlideId: Record<string, PptxElement[]>,
): Record<string, PptxElement[]> {
  const cloned: Record<string, PptxElement[]> = {};
  Object.entries(templateElementsBySlideId).forEach(([slideId, elements]) => {
    cloned[slideId] = elements.map(cloneElement);
  });
  return cloned;
}

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
