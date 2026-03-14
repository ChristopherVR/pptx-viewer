import type { PptxElement, XmlObject } from "../../types";

export interface IPptxElementTransformUpdater {
  applyTransform(
    shape: XmlObject,
    element: PptxElement,
    emuPerPx: number,
  ): void;
}

export class PptxElementTransformUpdater implements IPptxElementTransformUpdater {
  public applyTransform(
    shape: XmlObject,
    element: PptxElement,
    emuPerPx: number,
  ): void {
    const transform = (shape["p:spPr"]?.["a:xfrm"] || shape["p:xfrm"]) as
      | XmlObject
      | undefined;
    if (!transform) return;

    if (!transform["a:off"]) transform["a:off"] = {};
    if (!transform["a:ext"]) transform["a:ext"] = {};

    (transform["a:off"] as XmlObject)["@_x"] = String(
      Math.round(element.x * emuPerPx),
    );
    (transform["a:off"] as XmlObject)["@_y"] = String(
      Math.round(element.y * emuPerPx),
    );
    (transform["a:ext"] as XmlObject)["@_cx"] = String(
      Math.round(element.width * emuPerPx),
    );
    (transform["a:ext"] as XmlObject)["@_cy"] = String(
      Math.round(element.height * emuPerPx),
    );

    if (element.rotation !== undefined) {
      transform["@_rot"] = String(Math.round(element.rotation * 60000));
    }
    if (element.skewX !== undefined) {
      transform["@_skewX"] = String(Math.round(element.skewX * 60000));
    }
    if (element.skewY !== undefined) {
      transform["@_skewY"] = String(Math.round(element.skewY * 60000));
    }
    if (element.flipHorizontal) {
      transform["@_flipH"] = "1";
    } else {
      delete transform["@_flipH"];
    }
    if (element.flipVertical) {
      transform["@_flipV"] = "1";
    } else {
      delete transform["@_flipV"];
    }
  }
}
