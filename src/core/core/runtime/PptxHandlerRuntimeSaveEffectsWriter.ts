import { XmlObject, type ShapeStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveShapeStyleWriter";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Serialize visual effects (shadow, glow, reflection, blur, soft edge),
   * effectDag, 3D scene, and 3D shape properties to the given spPr XML object.
   */
  protected applyEffectsAndThreeD(
    spPr: XmlObject,
    shapeStyle: ShapeStyle,
  ): void {
    // Effects: shadow, inner shadow, glow, soft edge, reflection, blur
    const outerShadowXml = this.buildOuterShadowXml(shapeStyle);
    const innerShadowXml = this.buildInnerShadowXml(shapeStyle);
    const glowXml = this.buildGlowXml(shapeStyle);
    const softEdgeXml = this.buildSoftEdgeXml(shapeStyle);
    const reflectionXml = this.buildReflectionXml(shapeStyle);
    const blurXml = this.buildBlurXml(shapeStyle);
    const hasAnyEffect =
      outerShadowXml ||
      innerShadowXml ||
      glowXml ||
      softEdgeXml ||
      reflectionXml ||
      blurXml;
    if (hasAnyEffect) {
      const effectList = (spPr["a:effectLst"] || {}) as XmlObject;
      if (outerShadowXml) effectList["a:outerShdw"] = outerShadowXml;
      if (innerShadowXml) effectList["a:innerShdw"] = innerShadowXml;
      if (glowXml) effectList["a:glow"] = glowXml;
      if (softEdgeXml) effectList["a:softEdge"] = softEdgeXml;
      if (reflectionXml) effectList["a:reflection"] = reflectionXml;
      if (blurXml) effectList["a:blur"] = blurXml;
      spPr["a:effectLst"] = effectList;
    } else {
      // Clean up individual effects that were explicitly removed
      const effectList = spPr["a:effectLst"] as XmlObject | undefined;
      if (effectList) {
        if (shapeStyle.shadowColor !== undefined && !outerShadowXml) {
          delete effectList["a:outerShdw"];
        }
        if (shapeStyle.innerShadowColor !== undefined && !innerShadowXml) {
          delete effectList["a:innerShdw"];
        }
        if (shapeStyle.glowColor !== undefined && !glowXml) {
          delete effectList["a:glow"];
        }
        if (shapeStyle.softEdgeRadius !== undefined && !softEdgeXml) {
          delete effectList["a:softEdge"];
        }
        if (shapeStyle.reflectionBlurRadius !== undefined && !reflectionXml) {
          delete effectList["a:reflection"];
        }
        if (shapeStyle.blurRadius !== undefined && !blurXml) {
          delete effectList["a:blur"];
        }
        if (Object.keys(effectList).length === 0) {
          delete spPr["a:effectLst"];
        }
      }
    }

    // Round-trip preserve effectDag if present
    if (shapeStyle.effectDagXml) {
      spPr["a:effectDag"] = shapeStyle.effectDagXml;
    }

    // ── 3D Scene (a:scene3d) ──
    if (shapeStyle.scene3d) {
      const s3d = shapeStyle.scene3d;
      const hasData = s3d.cameraPreset || s3d.lightRigType;
      if (hasData) {
        const cameraObj: XmlObject = {};
        if (s3d.cameraPreset) cameraObj["@_prst"] = s3d.cameraPreset;
        if (
          s3d.cameraRotX != null ||
          s3d.cameraRotY != null ||
          s3d.cameraRotZ != null
        ) {
          const rot: XmlObject = {};
          if (s3d.cameraRotX != null) rot["@_lat"] = s3d.cameraRotX;
          if (s3d.cameraRotY != null) rot["@_lon"] = s3d.cameraRotY;
          if (s3d.cameraRotZ != null) rot["@_rev"] = s3d.cameraRotZ;
          cameraObj["a:rot"] = rot;
        }
        const lightRigObj: XmlObject = {};
        if (s3d.lightRigType) lightRigObj["@_rig"] = s3d.lightRigType;
        if (s3d.lightRigDirection) lightRigObj["@_dir"] = s3d.lightRigDirection;
        const scene3dXml: XmlObject = {};
        scene3dXml["a:camera"] = cameraObj;
        if (Object.keys(lightRigObj).length > 0) {
          scene3dXml["a:lightRig"] = lightRigObj;
        }
        if (s3d.hasBackdrop) {
          const backdropObj: XmlObject = {};
          if (
            s3d.backdropAnchorX != null ||
            s3d.backdropAnchorY != null ||
            s3d.backdropAnchorZ != null
          ) {
            backdropObj["a:anchor"] = {
              "@_x": s3d.backdropAnchorX ?? 0,
              "@_y": s3d.backdropAnchorY ?? 0,
              "@_z": s3d.backdropAnchorZ ?? 0,
            };
          }
          scene3dXml["a:backdrop"] = backdropObj;
        }
        spPr["a:scene3d"] = scene3dXml;
      } else {
        delete spPr["a:scene3d"];
      }
    } else if (shapeStyle.scene3d === undefined) {
      delete spPr["a:scene3d"];
    }

    // ── 3D Shape (a:sp3d) ──
    if (shapeStyle.shape3d) {
      const sh3d = shapeStyle.shape3d;
      const hasData =
        sh3d.extrusionHeight != null ||
        sh3d.contourWidth != null ||
        sh3d.presetMaterial ||
        sh3d.bevelTopType ||
        sh3d.bevelBottomType ||
        sh3d.extrusionColor ||
        sh3d.contourColor;
      if (hasData) {
        const sp3dXml: XmlObject = {};
        if (sh3d.extrusionHeight != null)
          sp3dXml["@_extrusionH"] = sh3d.extrusionHeight;
        if (sh3d.contourWidth != null)
          sp3dXml["@_contourW"] = sh3d.contourWidth;
        if (sh3d.presetMaterial)
          sp3dXml["@_prstMaterial"] = sh3d.presetMaterial;
        if (sh3d.bevelTopType) {
          const bevelT: XmlObject = { "@_prst": sh3d.bevelTopType };
          if (sh3d.bevelTopWidth != null) bevelT["@_w"] = sh3d.bevelTopWidth;
          if (sh3d.bevelTopHeight != null) bevelT["@_h"] = sh3d.bevelTopHeight;
          sp3dXml["a:bevelT"] = bevelT;
        }
        if (sh3d.bevelBottomType) {
          const bevelB: XmlObject = { "@_prst": sh3d.bevelBottomType };
          if (sh3d.bevelBottomWidth != null)
            bevelB["@_w"] = sh3d.bevelBottomWidth;
          if (sh3d.bevelBottomHeight != null)
            bevelB["@_h"] = sh3d.bevelBottomHeight;
          sp3dXml["a:bevelB"] = bevelB;
        }
        if (sh3d.extrusionColor) {
          sp3dXml["a:extrusionClr"] = {
            "a:srgbClr": { "@_val": sh3d.extrusionColor },
          };
        }
        if (sh3d.contourColor) {
          sp3dXml["a:contourClr"] = {
            "a:srgbClr": { "@_val": sh3d.contourColor },
          };
        }
        spPr["a:sp3d"] = sp3dXml;
      } else {
        delete spPr["a:sp3d"];
      }
    } else if (shapeStyle.shape3d === undefined) {
      delete spPr["a:sp3d"];
    }
  }
}
