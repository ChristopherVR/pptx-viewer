import type { ShapeStyle, XmlObject } from "../../types";

export interface Shape3dStyleContext {
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
}

/** Apply `a:scene3d` properties to the shape style. */
export function applyScene3dStyle(
  shapeProps: XmlObject,
  style: ShapeStyle,
): void {
  const scene3dNode = shapeProps["a:scene3d"] as XmlObject | undefined;
  if (!scene3dNode) return;

  const camera = scene3dNode["a:camera"] as XmlObject | undefined;
  const lightRig = scene3dNode["a:lightRig"] as XmlObject | undefined;
  style.scene3d = {
    cameraPreset: String(camera?.["@_prst"] || "").trim() || undefined,
    cameraRotX:
      camera?.["a:rot"]?.["@_lat"] != null
        ? parseInt(String((camera["a:rot"] as XmlObject)["@_lat"]), 10)
        : undefined,
    cameraRotY:
      camera?.["a:rot"]?.["@_lon"] != null
        ? parseInt(String((camera["a:rot"] as XmlObject)["@_lon"]), 10)
        : undefined,
    cameraRotZ:
      camera?.["a:rot"]?.["@_rev"] != null
        ? parseInt(String((camera["a:rot"] as XmlObject)["@_rev"]), 10)
        : undefined,
    lightRigType: String(lightRig?.["@_rig"] || "").trim() || undefined,
    lightRigDirection: String(lightRig?.["@_dir"] || "").trim() || undefined,
  };

  const backdrop = scene3dNode["a:backdrop"] as XmlObject | undefined;
  if (backdrop) {
    style.scene3d.hasBackdrop = true;
    const anchor = (backdrop as XmlObject)["a:anchor"] as XmlObject | undefined;
    const anchorAttrs = anchor as XmlObject | undefined;
    if (anchorAttrs) {
      style.scene3d.backdropAnchorX = parseInt(
        String(anchorAttrs["@_x"] || "0"),
        10,
      );
      style.scene3d.backdropAnchorY = parseInt(
        String(anchorAttrs["@_y"] || "0"),
        10,
      );
      style.scene3d.backdropAnchorZ = parseInt(
        String(anchorAttrs["@_z"] || "0"),
        10,
      );
    }
  }
}

/** Apply `a:sp3d` properties to the shape style. */
export function applyShape3dStyle(
  shapeProps: XmlObject,
  style: ShapeStyle,
  context: Shape3dStyleContext,
): void {
  const shape3dNode = shapeProps["a:sp3d"] as XmlObject | undefined;
  if (!shape3dNode) return;

  const bevelTop = shape3dNode["a:bevelT"] as XmlObject | undefined;
  const bevelBottom = shape3dNode["a:bevelB"] as XmlObject | undefined;
  style.shape3d = {
    extrusionHeight:
      shape3dNode["@_extrusionH"] != null
        ? parseInt(String(shape3dNode["@_extrusionH"]), 10)
        : undefined,
    extrusionColor: context.parseColor(
      shape3dNode["a:extrusionClr"] as XmlObject | undefined,
    ),
    contourWidth:
      shape3dNode["@_contourW"] != null
        ? parseInt(String(shape3dNode["@_contourW"]), 10)
        : undefined,
    contourColor: context.parseColor(
      shape3dNode["a:contourClr"] as XmlObject | undefined,
    ),
    presetMaterial:
      String(shape3dNode["@_prstMaterial"] || "").trim() || undefined,
    bevelTopType: bevelTop
      ? String(bevelTop["@_prst"] || "circle").trim()
      : undefined,
    bevelTopWidth:
      bevelTop?.["@_w"] != null
        ? parseInt(String(bevelTop["@_w"]), 10)
        : undefined,
    bevelTopHeight:
      bevelTop?.["@_h"] != null
        ? parseInt(String(bevelTop["@_h"]), 10)
        : undefined,
    bevelBottomType: bevelBottom
      ? String(bevelBottom["@_prst"] || "circle").trim()
      : undefined,
    bevelBottomWidth:
      bevelBottom?.["@_w"] != null
        ? parseInt(String(bevelBottom["@_w"]), 10)
        : undefined,
    bevelBottomHeight:
      bevelBottom?.["@_h"] != null
        ? parseInt(String(bevelBottom["@_h"]), 10)
        : undefined,
  };
}
