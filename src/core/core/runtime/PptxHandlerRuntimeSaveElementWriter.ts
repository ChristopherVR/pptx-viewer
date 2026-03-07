import {
  type XmlObject,
  type PptxElement,
  hasShapeProperties,
  hasTextProperties,
  type GroupPptxElement,
  type InkPptxElement,
  type MediaPptxElement,
  type PptxImageLikeElement,
} from "../../types";

import {
  PptxHandlerRuntime as PptxHandlerRuntimeBase,
  type SaveSlideContext,
} from "./PptxHandlerRuntimeSaveElementEmbedding";

export type { SaveSlideContext };

/** Collector arrays for sorting processed elements into shape tree lists. */
export interface SlideShapeCollectors {
  readonly shapes: XmlObject[];
  readonly pics: XmlObject[];
  readonly connectors: XmlObject[];
  readonly graphicFrames: XmlObject[];
  readonly groups: XmlObject[];
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /** Whether a shape XML represents a graphic frame. */
  protected isGraphicFrameShape(shape: XmlObject): boolean {
    return Boolean(
      shape["p:nvGraphicFramePr"] || (shape["a:graphic"] && shape["p:xfrm"]),
    );
  }

  /** Whether an element ID indicates a template (layout/master) element. */
  protected isTemplateElementId(elementId: string): boolean {
    return elementId.startsWith("layout-") || elementId.startsWith("master-");
  }

  /**
   * Process a single slide element during save. Handles embedding,
   * transforms, geometry, styles, text, and sorts into collectors.
   */
  protected processSlideElement(
    el: PptxElement,
    collectors: SlideShapeCollectors,
    ctx: SaveSlideContext,
  ): void {
    let shape = el.rawXml as XmlObject | undefined;

    // Image embedding
    if (
      (el.type === "picture" || el.type === "image") &&
      typeof el.imageData === "string"
    ) {
      shape =
        this.processImageEmbedding(el as PptxImageLikeElement, shape, ctx) ??
        shape;
    }

    // Media embedding
    if (el.type === "media") {
      shape =
        this.processMediaEmbedding(el as MediaPptxElement, shape, ctx) ?? shape;
    }

    // Group elements
    if (el.type === "group") {
      const grpXml = this.buildGroupShapeXml(el as GroupPptxElement);
      if (grpXml) collectors.groups.push(grpXml);
      return;
    }

    // Create new XML if missing
    if (!shape && (el.type === "text" || el.type === "shape")) {
      shape = this.createElementXml(el);
    }
    if (!shape && el.type === "connector") {
      shape = this.createConnectorXml(el);
    }
    if (!shape && el.type === "ink") {
      shape = this.createInkShapeXml(el as InkPptxElement);
    }

    if (!shape) {
      this.compatibilityService.reportWarning({
        code: "SAVE_ELEMENT_SKIPPED",
        message: `Element '${el.id}' could not be serialized and was skipped during save.`,
        scope: "save",
        slideId: ctx.slide.id,
        elementId: el.id,
      });
      return;
    }

    // Transform
    this.elementTransformUpdater.applyTransform(
      shape,
      el,
      PptxHandlerRuntime.EMU_PER_PX,
    );

    // Image crop / effects / alt text
    this.applyImageProperties(shape, el);

    // Geometry
    this.applyGeometryUpdate(shape, el);

    // Shape styles (fill, stroke, effects, 3D)
    if (hasShapeProperties(el) && el.shapeStyle && shape["p:spPr"]) {
      const spPr = shape["p:spPr"] as XmlObject;
      this.applyFillAndStroke(spPr, el.shapeStyle);
      this.applyEffectsAndThreeD(spPr, el.shapeStyle);
    }

    // Text body
    if (hasTextProperties(el)) {
      this.applyTextBodyContent(
        shape,
        el,
        ctx.resolveHyperlinkRelationshipId,
        ctx.getSlideRelationshipMap,
      );
    }

    // Table / Chart / SmartArt
    this.applyDataSerialization(shape, el, ctx.slide.id);

    // Actions and locks
    this.serializeElementActions(shape, el, ctx.resolveHyperlinkRelationshipId);
    this.serializeShapeLocks(shape, el);

    // Template elements
    if (this.isTemplateElementId(el.id)) {
      const templateSpTree = this.getTemplateSpTree(ctx.slide.id, el.id);
      if (templateSpTree) {
        el.rawXml = this.ensureTemplateShapeAttached(
          templateSpTree,
          el.type,
          shape,
        );
      }
      return;
    }

    // Sort into collector
    if (el.type === "picture" || el.type === "image") {
      collectors.pics.push(shape);
    } else if (el.type === "connector") {
      collectors.connectors.push(shape);
    } else if (this.isGraphicFrameShape(shape)) {
      collectors.graphicFrames.push(shape);
    } else {
      collectors.shapes.push(shape);
    }
  }
}
