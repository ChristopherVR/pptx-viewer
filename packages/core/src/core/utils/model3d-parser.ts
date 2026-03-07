import type { XmlObject } from "../types";

/** EMU per pixel -- matches PptxHandlerRuntime.EMU_PER_PX */
const EMU_PER_PX = 12700;

export interface Model3DTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Extract position and size from a p16:model3D element's shape properties.
 */
export function extractModel3DTransform(model3d: XmlObject): Model3DTransform {
  const spPr = (model3d["p16:spPr"] ?? model3d["p:spPr"]) as
    | XmlObject
    | undefined;
  const xfrm = spPr?.["a:xfrm"] as XmlObject | undefined;
  const off = xfrm?.["a:off"] as XmlObject | undefined;
  const ext = xfrm?.["a:ext"] as XmlObject | undefined;

  const rawX = parseInt(String(off?.["@_x"] ?? "0"), 10);
  const rawY = parseInt(String(off?.["@_y"] ?? "0"), 10);
  const rawCx = parseInt(String(ext?.["@_cx"] ?? "0"), 10);
  const rawCy = parseInt(String(ext?.["@_cy"] ?? "0"), 10);

  const x = Number.isFinite(rawX) ? rawX / EMU_PER_PX : 0;
  const y = Number.isFinite(rawY) ? rawY / EMU_PER_PX : 0;
  const width =
    Number.isFinite(rawCx) && rawCx > 0 ? rawCx / EMU_PER_PX : 120;
  const height =
    Number.isFinite(rawCy) && rawCy > 0 ? rawCy / EMU_PER_PX : 80;
  const rotation = xfrm?.["@_rot"]
    ? parseInt(String(xfrm["@_rot"])) / 60000
    : undefined;

  return { x, y, width, height, rotation };
}

/**
 * Resolve the MIME type for a 3D model based on file extension.
 */
export function resolveModel3DMimeType(modelPath: string): string | undefined {
  const ext = modelPath.split(".").pop()?.toLowerCase();
  if (ext === "glb") return "model/gltf-binary";
  if (ext === "gltf") return "model/gltf+json";
  return undefined;
}
