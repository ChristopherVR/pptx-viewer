import React from "react";

import type { MaterialPresetType } from "pptx-viewer-core";
import { EMU_PER_PX } from "../constants";
import { getMaterialCssOverrides } from "./material-presets";

interface Scene3dParams {
  cameraRotX?: number;
  cameraRotY?: number;
  cameraRotZ?: number;
  hasBackdrop?: boolean;
}

interface Shape3dParams {
  extrusionHeight?: number;
  extrusionColor?: string;
  bevelTopType?: string;
  bevelTopWidth?: number;
  bevelTopHeight?: number;
  bevelBottomType?: string;
  bevelBottomWidth?: number;
  bevelBottomHeight?: number;
  presetMaterial?: string;
}

/**
 * Apply 3D effects (perspective, rotation, extrusion, bevel, material)
 * to a mutable CSS properties object.
 */
export function apply3dEffects(
  base: React.CSSProperties,
  scene3d: Scene3dParams | undefined,
  shape3d: Shape3dParams | undefined,
): void {
  if (!scene3d && !shape3d) return;

  // Camera rotation from scene3d (values are in 1/60000 degrees)
  const rotX = scene3d?.cameraRotX ? scene3d.cameraRotX / 60000 : 0;
  const rotY = scene3d?.cameraRotY ? scene3d.cameraRotY / 60000 : 0;
  const rotZ = scene3d?.cameraRotZ ? scene3d.cameraRotZ / 60000 : 0;

  if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
    base.perspective = "800px";
    const transforms: string[] = [];
    if (rotX !== 0) transforms.push(`rotateX(${-rotX}deg)`);
    if (rotY !== 0) transforms.push(`rotateY(${rotY}deg)`);
    if (rotZ !== 0) transforms.push(`rotateZ(${rotZ}deg)`);
    base.transform = transforms.join(" ");
  }

  // Extrusion depth → stacked box-shadow for pseudo-3D depth
  if (shape3d?.extrusionHeight && shape3d.extrusionHeight > 0) {
    const depthPx = Math.min(
      Math.round(shape3d.extrusionHeight / EMU_PER_PX),
      20,
    );
    const extColor = shape3d.extrusionColor || "#888888";
    const depthShadows: string[] = [];
    for (let i = 1; i <= depthPx; i++) {
      depthShadows.push(`${i}px ${i}px 0 ${extColor}`);
    }
    if (depthShadows.length > 0) {
      base.boxShadow = base.boxShadow
        ? `${base.boxShadow}, ${depthShadows.join(", ")}`
        : depthShadows.join(", ");
    }
  }

  // Top bevel → inset highlight/shadow
  if (shape3d?.bevelTopType && shape3d.bevelTopType !== "none") {
    const bW = shape3d.bevelTopWidth
      ? Math.round(shape3d.bevelTopWidth / EMU_PER_PX)
      : 3;
    const bH = shape3d.bevelTopHeight
      ? Math.round(shape3d.bevelTopHeight / EMU_PER_PX)
      : 3;
    const bevelShadow = `inset ${bW}px ${bH}px ${Math.max(bW, bH)}px rgba(255,255,255,0.3), inset -${bW}px -${bH}px ${Math.max(bW, bH)}px rgba(0,0,0,0.2)`;
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${bevelShadow}`
      : bevelShadow;
  }

  // Bottom bevel → inset shadow from opposite direction
  if (shape3d?.bevelBottomType && shape3d.bevelBottomType !== "none") {
    const bW = shape3d.bevelBottomWidth
      ? Math.round(shape3d.bevelBottomWidth / EMU_PER_PX)
      : 3;
    const bH = shape3d.bevelBottomHeight
      ? Math.round(shape3d.bevelBottomHeight / EMU_PER_PX)
      : 3;
    const bottomBevelShadow = `inset -${bW}px -${bH}px ${Math.max(bW, bH)}px rgba(255,255,255,0.2), inset ${bW}px ${bH}px ${Math.max(bW, bH)}px rgba(0,0,0,0.3)`;
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${bottomBevelShadow}`
      : bottomBevelShadow;
  }

  // Backdrop plane → subtle ground-plane shadow
  if (scene3d?.hasBackdrop) {
    const backdropShadow = "0px 8px 24px -4px rgba(0,0,0,0.25)";
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${backdropShadow}`
      : backdropShadow;
  }

  // Material preset → CSS filter/opacity approximation
  if (shape3d?.presetMaterial) {
    const matOverrides = getMaterialCssOverrides(
      shape3d.presetMaterial as MaterialPresetType,
    );
    if (matOverrides.filter) {
      base.filter = base.filter
        ? `${base.filter} ${matOverrides.filter}`
        : matOverrides.filter;
    }
    if (matOverrides.opacity !== undefined) {
      base.opacity = matOverrides.opacity;
    }
    if (matOverrides.boxShadow) {
      base.boxShadow = base.boxShadow
        ? `${base.boxShadow}, ${matOverrides.boxShadow}`
        : matOverrides.boxShadow;
    }
  }
}
