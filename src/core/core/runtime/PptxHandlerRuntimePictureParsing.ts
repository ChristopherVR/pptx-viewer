import { XmlObject, PptxElement, type MediaPptxElement } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeShapeParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async parsePicture(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pic: any,
    id: string,
    slidePath: string,
  ): Promise<PptxElement | null> {
    try {
      const spPr = pic["p:spPr"] as XmlObject | undefined;
      const placeholderInfo = this.extractPlaceholderInfo(
        pic?.["p:nvPicPr"]?.["p:nvPr"] as XmlObject | undefined,
      );
      const inheritedPlaceholder = placeholderInfo
        ? this.findPlaceholderContext(slidePath, placeholderInfo)
        : undefined;
      const inheritedSpPr = (inheritedPlaceholder?.picture?.["p:spPr"] ||
        inheritedPlaceholder?.shape?.["p:spPr"]) as XmlObject | undefined;
      const effectiveSpPr = this.mergeXmlObjects(inheritedSpPr, spPr);
      const xfrm = (effectiveSpPr?.["a:xfrm"] ||
        spPr?.["a:xfrm"] ||
        inheritedSpPr?.["a:xfrm"]) as XmlObject | undefined;
      if (!xfrm) return null;

      const off = xfrm["a:off"];
      const ext = xfrm["a:ext"];
      if (!off || !ext) return null;

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
      const rotation = xfrm["@_rot"]
        ? parseInt(xfrm["@_rot"]) / 60000
        : undefined;
      const { flipHorizontal, flipVertical } = this.readFlipState(xfrm);

      // ── Check if this picture is actually a video/audio placeholder ──
      const nvPr = pic?.["p:nvPicPr"]?.["p:nvPr"] as XmlObject | undefined;
      const videoFileNode = nvPr?.["a:videoFile"] as XmlObject | undefined;
      const audioFileNode = nvPr?.["a:audioFile"] as XmlObject | undefined;

      if (videoFileNode || audioFileNode) {
        const isVideo = !!videoFileNode;
        const mediaFileNode = (videoFileNode ?? audioFileNode)!;
        const mediaRelId = String(
          mediaFileNode["@_r:link"] ?? mediaFileNode["@_r:embed"] ?? "",
        ).trim();

        let mediaPath: string | undefined;
        let mediaMimeType: string | undefined;
        if (mediaRelId) {
          mediaPath = this.mediaDataParser.resolveRelationshipTarget(
            slidePath,
            mediaRelId,
          );
          mediaMimeType = this.mediaDataParser.getMediaMimeType(mediaPath);
        }

        // Extract the poster frame from the picture's blipFill
        let posterFramePath: string | undefined;
        let posterFrameData: string | undefined;
        const posterBlipFill = pic["p:blipFill"];
        const posterBlip = posterBlipFill?.["a:blip"];
        const posterREmbed = posterBlip?.["@_r:embed"];
        const posterRLink = posterBlip?.["@_r:link"];
        if (posterREmbed || posterRLink) {
          const slideRels = this.slideRelsMap.get(slidePath);
          const posterTarget = slideRels?.get(posterREmbed || posterRLink);
          if (posterTarget) {
            if (
              posterTarget.startsWith("http://") ||
              posterTarget.startsWith("https://") ||
              posterTarget.startsWith("data:")
            ) {
              posterFramePath = posterTarget;
              posterFrameData = posterTarget;
            } else {
              posterFramePath = this.resolveImagePath(slidePath, posterTarget);
              if (this.eagerDecodeImages && posterFramePath) {
                posterFrameData = await this.getImageData(posterFramePath);
              }
            }
          }
        }

        return {
          id,
          type: "media",
          x,
          y,
          width,
          height,
          rotation,
          flipHorizontal,
          flipVertical,
          mediaType: isVideo ? "video" : "audio",
          mediaPath,
          mediaMimeType,
          posterFramePath,
          posterFrameData,
          rawXml: pic,
        } as MediaPptxElement;
      }

      const prstGeom = effectiveSpPr?.["a:prstGeom"]?.["@_prst"];
      const shapeAdjustments = this.parseGeometryAdjustments(
        effectiveSpPr?.["a:prstGeom"] as XmlObject | undefined,
      );
      let shapeType = prstGeom || "rect";
      let pathData: string | undefined;
      let pathWidth: number | undefined;
      let pathHeight: number | undefined;

      const custGeom = effectiveSpPr?.["a:custGeom"];
      if (custGeom) {
        const customPath = this.parseCustomGeometry(
          custGeom as XmlObject | undefined,
          width,
          height,
        );
        if (customPath) {
          shapeType = "custom";
          pathData = customPath.pathData;
          pathWidth = customPath.pathWidth;
          pathHeight = customPath.pathHeight;
        }
      }

      const picGeomNode =
        (custGeom as XmlObject | undefined) ??
        (effectiveSpPr?.["a:prstGeom"] as XmlObject | undefined);
      const adjustmentHandles = this.parseAdjustmentHandles(
        picGeomNode,
        width,
        height,
        shapeAdjustments,
      );

      // Get image relationship ID
      const blipFill = pic["p:blipFill"];
      const blip = blipFill?.["a:blip"];
      const rEmbed = blip?.["@_r:embed"];
      const rLink = blip?.["@_r:link"];
      const crop = this.readImageCropFromBlipFill(
        blipFill as XmlObject | undefined,
      );

      // Image tiling properties
      const tileNode = (blipFill as XmlObject | undefined)?.["a:tile"] as
        | XmlObject
        | undefined;
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
        blipFill as XmlObject | undefined,
        blip as XmlObject | undefined,
        slidePath,
        id,
      );
      this.inspectArtisticEffects(blip as XmlObject | undefined, slidePath, id);
      this.compatibilityService.inspectShapeCompatibility(
        effectiveSpPr,
        undefined,
        slidePath,
        id,
      );

      // Check for SVG variant in blip extensions and load it
      const svgRelId = this.extractSvgBlipRelId(blip as XmlObject | undefined);
      let svgData: string | undefined;
      let svgPath: string | undefined;
      if (svgRelId) {
        const slideRelsForSvg = this.slideRelsMap.get(slidePath);
        const svgTarget = slideRelsForSvg?.get(svgRelId);
        if (svgTarget) {
          svgPath = this.resolveImagePath(slidePath, svgTarget);
          if (this.eagerDecodeImages && svgPath) {
            svgData = await this.getImageData(svgPath);
          }
        }
      }

      let imageData: string | undefined;
      let imagePath: string | undefined;
      if (rEmbed || rLink) {
        const slideRels = this.slideRelsMap.get(slidePath);
        const target = slideRels?.get(rEmbed || rLink);
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

      const styleNode = (pic["p:style"] ||
        inheritedPlaceholder?.picture?.["p:style"] ||
        inheritedPlaceholder?.shape?.["p:style"]) as XmlObject | undefined;
      const altTextRaw = String(
        pic?.["p:nvPicPr"]?.["p:cNvPr"]?.["@_descr"] || "",
      ).trim();
      const imageEffects = this.extractImageEffects(
        blip as XmlObject | undefined,
      );

      // Parse hyperlink / action for the picture element
      const picCNvPr = pic?.["p:nvPicPr"]?.["p:cNvPr"] as XmlObject | undefined;
      const picSlideRels = this.slideRelsMap.get(slidePath);
      const { actionClick: picActionClick, actionHover: picActionHover } =
        this.parseElementActions(
          picCNvPr,
          picSlideRels,
          this.orderedSlidePaths,
        );

      // Parse locks from p:nvPicPr/p:cNvPicPr/a:picLocks
      const picCNvPicPr = pic?.["p:nvPicPr"]?.["p:cNvPicPr"] as
        | XmlObject
        | undefined;
      const picLocks = this.parseShapeLocks(
        (picCNvPicPr?.["a:picLocks"] ?? picCNvPicPr?.["a:spLocks"]) as
          | XmlObject
          | undefined,
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
        svgData,
        svgPath,
        altText: altTextRaw.length > 0 ? altTextRaw : undefined,
        imageEffects: imageEffects || undefined,
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
        flipHorizontal,
        flipVertical,
        rawXml: pic,
        actionClick: picActionClick,
        actionHover: picActionHover,
        locks: picLocks,
      };
    } catch (e) {
      console.warn(`[pptx] Skipping picture element (${id}):`, e);
      return null;
    }
  }
}
