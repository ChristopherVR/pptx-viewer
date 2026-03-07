import { PptxElement, XmlObject, TextSegment, TextStyle } from "../../types";

import type { ShapeTextParsingContext } from "./PptxHandlerRuntimeTypes";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeShapeParagraphContentParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected parseShape(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shape: any,
    id: string,
    slidePath?: string,
  ): PptxElement | null {
    try {
      const spPr = shape["p:spPr"] as XmlObject | undefined;
      const slideRelationshipMap = slidePath
        ? this.slideRelsMap.get(slidePath)
        : undefined;
      const placeholderInfo = this.extractPlaceholderInfo(
        shape?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined,
      );
      const inheritedPlaceholder =
        slidePath && placeholderInfo
          ? this.findPlaceholderContext(slidePath, placeholderInfo)
          : undefined;
      const inheritedSpPr = (inheritedPlaceholder?.shape?.["p:spPr"] ||
        inheritedPlaceholder?.picture?.["p:spPr"]) as XmlObject | undefined;
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

      // Extract shape geometry
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

      const geomNode =
        (custGeom as XmlObject | undefined) ??
        (effectiveSpPr?.["a:prstGeom"] as XmlObject | undefined);
      const adjustmentHandles = this.parseAdjustmentHandles(
        geomNode,
        width,
        height,
        shapeAdjustments,
      );

      // ── Text body ────────────────────────────────────────────
      const txBody =
        shape["p:txBody"] || inheritedPlaceholder?.shape?.["p:txBody"];
      const inheritedTxBody = inheritedPlaceholder?.shape?.["p:txBody"] as
        | XmlObject
        | undefined;
      this.compatibilityService.inspectShapeCompatibility(
        effectiveSpPr,
        txBody as XmlObject | undefined,
        slidePath,
        id,
      );
      const styleNode = (shape["p:style"] ||
        inheritedPlaceholder?.shape?.["p:style"] ||
        inheritedPlaceholder?.picture?.["p:style"]) as XmlObject | undefined;

      let text = "";
      const textStyle: TextStyle = {};
      const textSegments: TextSegment[] = [];
      const paragraphIndents: Array<{ marginLeft?: number; indent?: number }> =
        [];
      const inheritedBodyDefaultRunStyle = this.extractTextRunStyle(
        inheritedTxBody?.["a:lstStyle"]?.["a:defPPr"]?.["a:defRPr"],
        "left",
        slideRelationshipMap,
      );
      const bodyDefaultRunStyle = {
        ...inheritedBodyDefaultRunStyle,
        ...this.extractTextRunStyle(
          txBody?.["a:lstStyle"]?.["a:defPPr"]?.["a:defRPr"],
          "left",
          slideRelationshipMap,
        ),
      } as TextStyle;
      Object.assign(textStyle, bodyDefaultRunStyle);

      const fontRef = styleNode?.["a:fontRef"] as XmlObject | undefined;
      const fontRefIdx = String(fontRef?.["@_idx"] || "").toLowerCase();
      if (!textStyle.fontFamily && fontRefIdx.length > 0) {
        const token = fontRefIdx.includes("minor") ? "+mn-lt" : "+mj-lt";
        const resolved = this.resolveThemeTypeface(token);
        if (resolved) textStyle.fontFamily = resolved;
      }
      if (!textStyle.color) {
        textStyle.color = this.parseColor(fontRef);
      }

      const bodyPr = (txBody?.["a:bodyPr"] || inheritedTxBody?.["a:bodyPr"]) as
        | XmlObject
        | undefined;
      const bodyPropResult = this.applyBodyProperties(
        bodyPr,
        txBody as XmlObject | undefined,
        textStyle,
      );
      let linkedTxbxId = bodyPropResult.linkedTxbxId;
      let linkedTxbxSeq = bodyPropResult.linkedTxbxSeq;

      // Placeholder defaults
      const phDefaults =
        slidePath && placeholderInfo
          ? this.lookupPlaceholderDefaults(slidePath, placeholderInfo)
          : undefined;
      if (phDefaults) {
        this.applyPlaceholderBodyDefaults(textStyle, phDefaults);
      }
      if (this.presentationDefaultTextStyle) {
        this.applyPlaceholderBodyDefaults(
          textStyle,
          this.presentationDefaultTextStyle,
        );
      }

      if (txBody?.["a:p"]) {
        const paras = this.ensureArray(txBody["a:p"]);
        const textParts: string[] = [];
        let didSeedPrimaryTextStyle = false;
        const effectiveLevelStyles =
          phDefaults?.levelStyles ??
          this.presentationDefaultTextStyle?.levelStyles;
        const ctx: ShapeTextParsingContext = {
          txBody,
          inheritedTxBody,
          bodyDefaultRunStyle,
          slideRelationshipMap,
          placeholderInfo: placeholderInfo ?? undefined,
          phDefaults,
          slidePath,
          effectiveLevelStyles,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paras.forEach((p: any, pIdx: number) => {
          const styleResult = this.resolveShapeParagraphStyle(
            p as XmlObject,
            textStyle,
            ctx,
          );
          paragraphIndents.push(styleResult.indent);

          const contentResult = this.collectShapeParagraphContent(
            p as XmlObject,
            pIdx,
            paras.length,
            styleResult.paraAlign,
            styleResult.mergedDefaultRunStyle,
            ctx,
          );
          textParts.push(...contentResult.parts);
          textSegments.push(...contentResult.segments);
          if (contentResult.seedStyle && !didSeedPrimaryTextStyle) {
            Object.assign(textStyle, contentResult.seedStyle);
            didSeedPrimaryTextStyle = true;
          }
        });
        text = textParts.join("");
      }

      // Extract shape style + determine element type
      const shapeStyle = this.extractShapeStyle(effectiveSpPr, styleNode);
      const hasText = text.trim().length > 0;
      const isPlainRect = !prstGeom || prstGeom === "rect";
      const hasVisibleStyle =
        (shapeStyle.fillColor && shapeStyle.fillColor !== "transparent") ||
        (shapeStyle.strokeWidth || 0) > 0;

      let type: PptxElement["type"] = "shape";
      if (hasText && isPlainRect && !hasVisibleStyle) {
        type = "text";
      }

      // Parse shape-level actions (hyperlinks, slide jumps)
      const cNvPrForActions = shape?.["p:nvSpPr"]?.["p:cNvPr"] as
        | XmlObject
        | undefined;
      const { actionClick, actionHover } = this.parseElementActions(
        cNvPrForActions,
        slideRelationshipMap,
        this.orderedSlidePaths,
      );

      // Parse shape lock attributes with inheritance
      const cNvSpPr = shape?.["p:nvSpPr"]?.["p:cNvSpPr"] as
        | XmlObject
        | undefined;
      const spLocksNode = cNvSpPr?.["a:spLocks"] as XmlObject | undefined;
      const slideLocks = this.parseShapeLocks(spLocksNode);
      const inheritedCNvSpPr = (inheritedPlaceholder?.shape?.["p:nvSpPr"]?.[
        "p:cNvSpPr"
      ] ?? inheritedPlaceholder?.picture?.["p:nvPicPr"]?.["p:cNvPicPr"]) as
        | XmlObject
        | undefined;
      const inheritedLockNode = (inheritedCNvSpPr?.["a:spLocks"] ??
        inheritedCNvSpPr?.["a:picLocks"]) as XmlObject | undefined;
      const inheritedLocks = this.parseShapeLocks(inheritedLockNode);
      const locks = inheritedLocks
        ? { ...inheritedLocks, ...slideLocks }
        : slideLocks;

      const promptText =
        !hasText && phDefaults?.promptText ? phDefaults.promptText : undefined;

      const commonProps = {
        id,
        x,
        y,
        width,
        height,
        text,
        textStyle: hasText || promptText ? textStyle : undefined,
        textSegments: hasText ? textSegments : undefined,
        paragraphIndents:
          hasText && paragraphIndents.length > 0 ? paragraphIndents : undefined,
        promptText,
        linkedTxbxId,
        linkedTxbxSeq,
        shapeType: isPlainRect ? "rect" : shapeType,
        shapeAdjustments,
        adjustmentHandles,
        shapeStyle,
        rotation,
        flipHorizontal,
        flipVertical,
        actionClick,
        actionHover,
        locks,
        rawXml: shape,
      };

      if (type === "text") {
        return { ...commonProps, type: "text" as const };
      }

      return {
        ...commonProps,
        type: "shape" as const,
        pathData,
        pathWidth,
        pathHeight,
      };
    } catch (e) {
      console.warn(`[pptx] Skipping shape element (${id}):`, e);
      return null;
    }
  }
}
