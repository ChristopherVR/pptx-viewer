import { PptxElement, XmlObject, TextStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeGeometryParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse a shape that has an image fill (a:blipFill inside spPr)
   * This handles shapes like rectangles filled with images (e.g., wood texture backgrounds)
   */
  protected async parseShapeWithImageFill(
    shape: XmlObject,
    id: string,
    slidePath: string,
  ): Promise<PptxElement | null> {
    try {
      const spPr = shape["p:spPr"] as XmlObject | undefined;
      const placeholderInfo = this.extractPlaceholderInfo(
        shape?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined,
      );
      const inheritedPlaceholder = placeholderInfo
        ? this.findPlaceholderContext(slidePath, placeholderInfo)
        : undefined;
      const inheritedSpPr = (inheritedPlaceholder?.shape?.["p:spPr"] ||
        inheritedPlaceholder?.picture?.["p:spPr"]) as XmlObject | undefined;
      const effectiveSpPr = this.mergeXmlObjects(inheritedSpPr, spPr);
      const xfrm = (effectiveSpPr?.["a:xfrm"] ||
        spPr?.["a:xfrm"] ||
        inheritedSpPr?.["a:xfrm"]) as XmlObject | undefined;
      if (!xfrm) {
        console.warn(`[shape-img] ${id}: no xfrm, skipping`);
        return null;
      }

      const off = xfrm["a:off"];
      const ext = xfrm["a:ext"];
      if (!off || !ext) {
        console.warn(`[shape-img] ${id}: no off/ext, skipping`);
        return null;
      }

      const x = Math.round(
        parseInt(off["@_x"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
      );
      const y = Math.round(
        parseInt(off["@_y"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
      );
      const width = Math.round(
        parseInt(ext["@_cx"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
      );
      const height = Math.round(
        parseInt(ext["@_cy"] || "0") / PptxHandlerRuntime.EMU_PER_PX,
      );

      // Get rotation if present
      const rotation = xfrm["@_rot"]
        ? parseInt(xfrm["@_rot"]) / 60000
        : undefined;
      const skewX = xfrm["@_skewX"]
        ? parseInt(String(xfrm["@_skewX"]), 10) / 60000
        : undefined;
      const skewY = xfrm["@_skewY"]
        ? parseInt(String(xfrm["@_skewY"]), 10) / 60000
        : undefined;
      const { flipHorizontal, flipVertical } = this.readFlipState(xfrm);

      const prstGeom = effectiveSpPr?.["a:prstGeom"]?.["@_prst"];
      const shapeAdjustments = this.parseGeometryAdjustments(
        effectiveSpPr?.["a:prstGeom"] as XmlObject | undefined,
      );
      let shapeType = prstGeom || "rect";
      let pathData: string | undefined;
      let pathWidth: number | undefined;
      let pathHeight: number | undefined;

      const custGeom = effectiveSpPr?.["a:custGeom"] as XmlObject | undefined;
      if (custGeom) {
        const customPath = this.parseCustomGeometry(custGeom, width, height);
        if (customPath) {
          shapeType = "custom";
          pathData = customPath.pathData;
          pathWidth = customPath.pathWidth;
          pathHeight = customPath.pathHeight;
        }
      }

      // Parse adjustment handles from geometry definition
      const geomNode =
        custGeom ?? (effectiveSpPr?.["a:prstGeom"] as XmlObject | undefined);
      const adjustmentHandles = this.parseAdjustmentHandles(
        geomNode,
        width,
        height,
        shapeAdjustments,
      );

      // Get image relationship ID from spPr's blipFill (not p:blipFill)
      const blipFill = (effectiveSpPr?.["a:blipFill"] ||
        spPr?.["a:blipFill"]) as XmlObject | undefined;
      const blip = blipFill?.["a:blip"];
      const rEmbed = blip?.["@_r:embed"];
      const rLink = blip?.["@_r:link"];
      const crop = this.readImageCropFromBlipFill(blipFill);

      // Image tiling properties from a:tile
      const tileNode = blipFill?.["a:tile"] as XmlObject | undefined;
      const tileProps: Record<string, unknown> = {};
      if (tileNode) {
        const txRaw = Number.parseInt(String(tileNode["@_tx"] || ""), 10);
        if (Number.isFinite(txRaw))
          tileProps.tileOffsetX = txRaw / PptxHandlerRuntime.EMU_PER_PX;
        const tyRaw = Number.parseInt(String(tileNode["@_ty"] || ""), 10);
        if (Number.isFinite(tyRaw))
          tileProps.tileOffsetY = tyRaw / PptxHandlerRuntime.EMU_PER_PX;
        const sxRaw = Number.parseInt(String(tileNode["@_sx"] || ""), 10);
        if (Number.isFinite(sxRaw)) tileProps.tileScaleX = sxRaw / 100000;
        const syRaw = Number.parseInt(String(tileNode["@_sy"] || ""), 10);
        if (Number.isFinite(syRaw)) tileProps.tileScaleY = syRaw / 100000;
        const flipStr = String(tileNode["@_flip"] || "").trim();
        if (
          flipStr === "x" ||
          flipStr === "y" ||
          flipStr === "xy" ||
          flipStr === "none"
        ) {
          tileProps.tileFlip = flipStr;
        }
        const algnStr = String(tileNode["@_algn"] || "").trim();
        if (algnStr.length > 0) tileProps.tileAlignment = algnStr;
      }

      this.compatibilityService.inspectPictureCompatibility(
        blipFill,
        blip,
        slidePath,
        id,
      );
      this.compatibilityService.inspectShapeCompatibility(
        effectiveSpPr,
        shape["p:txBody"] as XmlObject | undefined,
        slidePath,
        id,
      );

      let imageData: string | undefined;
      let imagePath: string | undefined;

      console.log(`[shape-img] ${id}: rEmbed=${rEmbed}, rLink=${rLink}`);
      if (rEmbed || rLink) {
        const slideRels = this.slideRelsMap.get(slidePath);
        const target = slideRels?.get(rEmbed || rLink);
        console.log(`[shape-img] ${id}: target=${target}`);

        if (target) {
          if (
            target.startsWith("http://") ||
            target.startsWith("https://") ||
            target.startsWith("data:")
          ) {
            imagePath = target;
            imageData = target;
          } else {
            imagePath = this.resolveImagePath(slidePath, target);
            if (this.eagerDecodeImages && imagePath) {
              imageData = await this.getImageData(imagePath);
            }
          }
        }
      }
      console.log(`[shape-img] ${id}: imagePath=${imagePath}, hasImageData=${!!imageData}, dataLen=${imageData?.length ?? 0}`);

      const styleNode = (shape["p:style"] ||
        inheritedPlaceholder?.shape?.["p:style"] ||
        inheritedPlaceholder?.picture?.["p:style"]) as XmlObject | undefined;

      // Parse hyperlink / action for the shape-with-image-fill element
      const sifCNvPr = shape?.["p:nvSpPr"]?.["p:cNvPr"] as
        | XmlObject
        | undefined;
      const sifSlideRels = this.slideRelsMap.get(slidePath);
      const { actionClick: sifActionClick, actionHover: sifActionHover } =
        this.parseElementActions(
          sifCNvPr,
          sifSlideRels,
          this.orderedSlidePaths,
        );

      return {
        id,
        type: "picture",
        x,
        y,
        width,
        height,
        imageData,
        imagePath,
        ...crop,
        ...tileProps,
        shapeType,
        shapeAdjustments,
        adjustmentHandles,
        pathData,
        pathWidth,
        pathHeight,
        shapeStyle: this.extractShapeStyle(effectiveSpPr, styleNode),
        rotation,
        skewX,
        skewY,
        flipHorizontal,
        flipVertical,
        rawXml: shape,
        actionClick: sifActionClick,
        actionHover: sifActionHover,
      };
    } catch (e) {
      console.error("ERROR in parseShapeWithImageFill:", id, e);
      return null;
    }
  }

  protected textVerticalAlignFromDrawingValue(
    value: unknown,
  ): TextStyle["vAlign"] | undefined {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (normalized.length === 0) return undefined;
    if (normalized === "t" || normalized === "top") return "top";
    if (normalized === "ctr" || normalized === "center") return "middle";
    if (normalized === "b" || normalized === "bottom") return "bottom";
    if (normalized === "dist" || normalized === "just") return "middle";
    return undefined;
  }

  protected textDirectionFromDrawingValue(
    value: unknown,
  ): TextStyle["textDirection"] | undefined {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (normalized.length === 0 || normalized === "horz") return undefined;
    if (normalized === "vert") return "vertical";
    if (normalized === "vert270") return "vertical270";
    if (normalized === "eavert") return "eaVert";
    if (normalized === "wordartvert") return "wordArtVert";
    if (normalized === "wordartvertrtl") return "wordArtVertRtl";
    if (normalized === "mongolianvert") return "mongolianVert";
    return undefined;
  }
}
