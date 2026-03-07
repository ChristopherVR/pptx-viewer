/**
 * Utilities for converting between structured CustomGeometryPath[] and
 * SVG path data strings, plus serialization to/from OOXML a:custGeom XML.
 */
import type {
  CustomGeometryPath,
  CustomGeometryPoint,
  CustomGeometrySegment,
  XmlObject,
} from "../types";
import { ooxmlArcToSvg } from "./guide-formula-paths";

// ---------------------------------------------------------------------------
// Structured paths -> SVG path data string
// ---------------------------------------------------------------------------

/** Convert structured custom geometry paths to a single SVG path data string. */
export function customGeometryPathsToSvg(paths: CustomGeometryPath[]): string {
  const parts: string[] = [];
  let penX = 0;
  let penY = 0;
  let moveX = 0;
  let moveY = 0;
  for (const path of paths) {
    for (const seg of path.segments) {
      switch (seg.type) {
        case "moveTo":
          parts.push(`M ${seg.pt.x} ${seg.pt.y}`);
          penX = seg.pt.x;
          penY = seg.pt.y;
          moveX = penX;
          moveY = penY;
          break;
        case "lineTo":
          parts.push(`L ${seg.pt.x} ${seg.pt.y}`);
          penX = seg.pt.x;
          penY = seg.pt.y;
          break;
        case "cubicBezTo":
          parts.push(
            `C ${seg.pts[0].x} ${seg.pts[0].y} ${seg.pts[1].x} ${seg.pts[1].y} ${seg.pts[2].x} ${seg.pts[2].y}`,
          );
          penX = seg.pts[2].x;
          penY = seg.pts[2].y;
          break;
        case "quadBezTo":
          parts.push(
            `Q ${seg.pts[0].x} ${seg.pts[0].y} ${seg.pts[1].x} ${seg.pts[1].y}`,
          );
          penX = seg.pts[1].x;
          penY = seg.pts[1].y;
          break;
        case "arcTo": {
          const result = ooxmlArcToSvg(
            seg.wR, seg.hR, seg.stAng, seg.swAng, penX, penY,
          );
          if (result) {
            parts.push(result.svg);
            penX = result.endX;
            penY = result.endY;
          }
          break;
        }
        case "close":
          parts.push("Z");
          penX = moveX;
          penY = moveY;
          break;
      }
    }
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// SVG path data string -> structured paths (basic parser)
// ---------------------------------------------------------------------------

/** Parse a simple SVG path data string into structured CustomGeometryPath. */
export function svgToCustomGeometryPaths(
  pathData: string,
  width: number,
  height: number,
): CustomGeometryPath[] {
  const segments: CustomGeometrySegment[] = [];
  // Tokenise: split on command letters while keeping them
  const tokens = pathData.match(/[MLCQZAmlcqza][^MLCQZAmlcqza]*/gi) ?? [];
  for (const token of tokens) {
    const cmd = token[0];
    const nums = (token.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
    switch (cmd.toUpperCase()) {
      case "M":
        if (nums.length >= 2) {
          segments.push({ type: "moveTo", pt: { x: nums[0], y: nums[1] } });
        }
        break;
      case "L":
        if (nums.length >= 2) {
          segments.push({ type: "lineTo", pt: { x: nums[0], y: nums[1] } });
        }
        break;
      case "C":
        if (nums.length >= 6) {
          segments.push({
            type: "cubicBezTo",
            pts: [
              { x: nums[0], y: nums[1] },
              { x: nums[2], y: nums[3] },
              { x: nums[4], y: nums[5] },
            ],
          });
        }
        break;
      case "Q":
        if (nums.length >= 4) {
          segments.push({
            type: "quadBezTo",
            pts: [
              { x: nums[0], y: nums[1] },
              { x: nums[2], y: nums[3] },
            ],
          });
        }
        break;
      case "Z":
        segments.push({ type: "close" });
        break;
    }
  }
  return [{ width, height, segments }];
}

// ---------------------------------------------------------------------------
// Structured paths -> OOXML a:custGeom XML object
// ---------------------------------------------------------------------------

function pointToXml(pt: CustomGeometryPoint): XmlObject {
  return { "@_x": String(Math.round(pt.x)), "@_y": String(Math.round(pt.y)) };
}

/** Serialize structured paths to an OOXML `a:custGeom` XML object. */
export function customGeometryPathsToXml(
  paths: CustomGeometryPath[],
): XmlObject {
  const xmlPaths: XmlObject[] = paths.map((path) => {
    const pathXml: XmlObject = {
      "@_w": String(Math.round(path.width)),
      "@_h": String(Math.round(path.height)),
    };

    const moveToList: XmlObject[] = [];
    const lnToList: XmlObject[] = [];
    const cubicBezToList: XmlObject[] = [];
    const quadBezToList: XmlObject[] = [];
    const arcToList: XmlObject[] = [];
    let hasClose = false;

    for (const seg of path.segments) {
      switch (seg.type) {
        case "moveTo":
          moveToList.push({ "a:pt": pointToXml(seg.pt) });
          break;
        case "lineTo":
          lnToList.push({ "a:pt": pointToXml(seg.pt) });
          break;
        case "cubicBezTo":
          cubicBezToList.push({
            "a:pt": seg.pts.map(pointToXml),
          });
          break;
        case "quadBezTo":
          quadBezToList.push({
            "a:pt": seg.pts.map(pointToXml),
          });
          break;
        case "arcTo":
          arcToList.push({
            "@_wR": String(Math.round(seg.wR)),
            "@_hR": String(Math.round(seg.hR)),
            "@_stAng": String(Math.round(seg.stAng)),
            "@_swAng": String(Math.round(seg.swAng)),
          });
          break;
        case "close":
          hasClose = true;
          break;
      }
    }

    if (moveToList.length > 0) {
      pathXml["a:moveTo"] =
        moveToList.length === 1 ? moveToList[0] : moveToList;
    }
    if (lnToList.length > 0) {
      pathXml["a:lnTo"] = lnToList.length === 1 ? lnToList[0] : lnToList;
    }
    if (cubicBezToList.length > 0) {
      pathXml["a:cubicBezTo"] =
        cubicBezToList.length === 1 ? cubicBezToList[0] : cubicBezToList;
    }
    if (quadBezToList.length > 0) {
      pathXml["a:quadBezTo"] =
        quadBezToList.length === 1 ? quadBezToList[0] : quadBezToList;
    }
    if (arcToList.length > 0) {
      pathXml["a:arcTo"] =
        arcToList.length === 1 ? arcToList[0] : arcToList;
    }
    if (hasClose) {
      pathXml["a:close"] = {};
    }

    return pathXml;
  });

  return {
    "a:avLst": {},
    "a:gdLst": {},
    "a:ahLst": {},
    "a:cxnLst": {},
    "a:rect": {
      "@_l": "l",
      "@_t": "t",
      "@_r": "r",
      "@_b": "b",
    },
    "a:pathLst": {
      "a:path": xmlPaths.length === 1 ? xmlPaths[0] : xmlPaths,
    },
  };
}

// ---------------------------------------------------------------------------
// Compute bounding box of all points in structured paths
// ---------------------------------------------------------------------------

/** Get all explicit control/anchor points from structured paths. */
export function getAllPointsFromPaths(
  paths: CustomGeometryPath[],
): CustomGeometryPoint[] {
  const points: CustomGeometryPoint[] = [];
  for (const path of paths) {
    for (const seg of path.segments) {
      switch (seg.type) {
        case "moveTo":
        case "lineTo":
          points.push(seg.pt);
          break;
        case "cubicBezTo":
          points.push(...seg.pts);
          break;
        case "quadBezTo":
          points.push(...seg.pts);
          break;
      }
    }
  }
  return points;
}

/** Recalculate the coordinate-space dimensions to tightly fit all points. */
export function recalculatePathBounds(paths: CustomGeometryPath[]): {
  width: number;
  height: number;
} {
  const pts = getAllPointsFromPaths(paths);
  if (pts.length === 0) return { width: 1, height: 1 };
  let maxX = 0;
  let maxY = 0;
  for (const pt of pts) {
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  return { width: Math.max(maxX, 1), height: Math.max(maxY, 1) };
}
