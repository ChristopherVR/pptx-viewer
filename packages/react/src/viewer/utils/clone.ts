import type {
  PptxChartData,
  PptxElement,
  PptxElementAnimation,
  PptxSlide,
  PptxSlideTransition,
  PptxSmartArtData,
  ShapeStyle,
  TextStyle,
  XmlObject,
} from "pptx-viewer-core";

import type { EditorHistorySnapshot } from "../types";

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

export function cloneSlideTransition(
  transition: PptxSlideTransition | undefined,
): PptxSlideTransition | undefined {
  if (!transition) return undefined;
  return { ...transition };
}

export function cloneElementAnimation(
  animation: PptxElementAnimation,
): PptxElementAnimation {
  return { ...animation };
}

export function cloneChartData(
  data: PptxChartData | undefined,
): PptxChartData | undefined {
  if (!data) return undefined;
  return {
    ...data,
    categories: [...(data.categories || [])],
    series: (data.series || []).map((series) => ({
      ...series,
      values: [...(series.values || [])],
    })),
  };
}

export function cloneSmartArtData(
  data: PptxSmartArtData | undefined,
): PptxSmartArtData | undefined {
  if (!data) return undefined;
  return {
    ...data,
    nodes: (data.nodes || []).map((node) => ({ ...node })),
  };
}

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
      return { ...element };
    case "chart":
      return {
        ...element,
        chartData: cloneChartData(element.chartData),
      };
    case "smartArt":
      return {
        ...element,
        smartArtData: cloneSmartArtData(element.smartArtData),
      };
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
    transition: cloneSlideTransition(slide.transition),
    animations: slide.animations?.map(cloneElementAnimation),
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

export function cloneHistorySnapshot(
  snapshot: EditorHistorySnapshot,
): EditorHistorySnapshot {
  return {
    width: snapshot.width,
    height: snapshot.height,
    activeSlideIndex: snapshot.activeSlideIndex,
    slides: snapshot.slides.map(cloneSlide),
    templateElementsBySlideId: cloneTemplateElementsBySlideId(
      snapshot.templateElementsBySlideId,
    ),
  };
}

export function cloneXmlObject(
  value: XmlObject | undefined,
): XmlObject | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as XmlObject;
  } catch {
    return undefined;
  }
}
