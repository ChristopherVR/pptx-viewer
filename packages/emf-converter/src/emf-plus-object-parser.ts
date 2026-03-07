/**
 * EMF+ OBJECT record dispatcher.
 *
 * Handles the EMFPLUS_OBJECT record by delegating to type-specific parsers.
 */

import type { EmfPlusReplayCtx, EmfPlusRegionNode } from "./emf-types";
import {
  EMFPLUS_OBJECTTYPE_BRUSH,
  EMFPLUS_OBJECTTYPE_PEN,
  EMFPLUS_OBJECTTYPE_PATH,
  EMFPLUS_OBJECTTYPE_FONT,
  EMFPLUS_OBJECTTYPE_STRINGFORMAT,
  EMFPLUS_OBJECTTYPE_IMAGE,
  EMFPLUS_OBJECTTYPE_IMAGEATTRIBUTES,
  EMFPLUS_OBJECTTYPE_REGION,
  EMFPLUS_BRUSHTYPE_SOLID,
  EMFPLUS_BRUSHTYPE_HATCHFILL,
  EMFPLUS_BRUSHTYPE_LINEARGRADIENT,
  EMFPLUS_BRUSHTYPE_PATHGRADIENT,
} from "./emf-constants";
import { argbToRgba } from "./emf-color-helpers";
import { parseEmfPlusPath } from "./emf-plus-path";
import { emfLog, emfWarn } from "./emf-logging";
import {
  parseEmfPlusPenObject,
  parseEmfPlusImageObject,
  parseEmfPlusFontObject,
} from "./emf-plus-object-complex";

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export function handleEmfPlusObjectRecord(
  rCtx: EmfPlusReplayCtx,
  recFlags: number,
  dataOff: number,
  recDataSize: number,
): void {
  const { view, objectTable } = rCtx;
  const objectId = recFlags & 0xff;
  const objectType = (recFlags >> 8) & 0x7f;

  switch (objectType) {
    // ---------------------------------------------------------------
    // Brush
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_BRUSH: {
      if (recDataSize >= 8) {
        const brushType = view.getUint32(dataOff, true);
        let color = "rgba(0,0,0,1)";
        if (brushType === EMFPLUS_BRUSHTYPE_SOLID && recDataSize >= 8) {
          color = argbToRgba(view.getUint32(dataOff + 4, true));
        } else if (
          brushType === EMFPLUS_BRUSHTYPE_LINEARGRADIENT &&
          recDataSize >= 48
        ) {
          color = argbToRgba(view.getUint32(dataOff + 40, true));
        } else if (
          brushType === EMFPLUS_BRUSHTYPE_PATHGRADIENT &&
          recDataSize >= 12
        ) {
          color = argbToRgba(view.getUint32(dataOff + 8, true));
        } else if (
          brushType === EMFPLUS_BRUSHTYPE_HATCHFILL &&
          recDataSize >= 12
        ) {
          color = argbToRgba(view.getUint32(dataOff + 8, true));
        }
        objectTable.set(objectId, { kind: "plus-brush", color });
      }
      break;
    }

    // ---------------------------------------------------------------
    // Pen
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_PEN: {
      const pen = parseEmfPlusPenObject(view, dataOff, recDataSize);
      if (pen) {
        objectTable.set(objectId, pen);
      }
      break;
    }

    // ---------------------------------------------------------------
    // Path
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_PATH: {
      const path = parseEmfPlusPath(view, dataOff, recDataSize);
      if (path) {
        objectTable.set(objectId, path);
      }
      break;
    }

    // ---------------------------------------------------------------
    // Font
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_FONT: {
      const font = parseEmfPlusFontObject(view, dataOff, recDataSize);
      if (font) {
        objectTable.set(objectId, font);
      }
      break;
    }

    // ---------------------------------------------------------------
    // StringFormat
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_STRINGFORMAT: {
      if (recDataSize >= 16) {
        const sfFlags = view.getUint32(dataOff + 4, true);
        const alignment = view.getUint32(dataOff + 12, true);
        const lineAlignment = view.getUint32(dataOff + 16, true);
        objectTable.set(objectId, {
          kind: "plus-stringformat",
          flags: sfFlags,
          alignment: alignment ?? 0,
          lineAlignment: lineAlignment ?? 0,
        });
      }
      break;
    }

    // ---------------------------------------------------------------
    // Image
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_IMAGE: {
      if (recDataSize < 8) break;
      const parsed = parseEmfPlusImageObject(
        view,
        dataOff,
        recDataSize,
        objectId,
      );
      objectTable.set(objectId, {
        kind: "plus-image",
        data: parsed.data,
        type: parsed.type,
      });
      rCtx.totalImageObjects++;
      emfLog(
        `replayEmfPlusRecords: Stored Image object id=${objectId}, hasData=${parsed.data != null}, imgType=${parsed.type}`,
      );
      break;
    }

    // ---------------------------------------------------------------
    // ImageAttributes
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_IMAGEATTRIBUTES: {
      objectTable.set(objectId, { kind: "plus-imageattributes" });
      break;
    }

    // ---------------------------------------------------------------
    // Region
    // ---------------------------------------------------------------
    case EMFPLUS_OBJECTTYPE_REGION: {
      const region = parseEmfPlusRegionObject(view, dataOff, recDataSize);
      if (region) {
        objectTable.set(objectId, region);
        emfLog(`replayEmfPlusRecords: Stored Region object id=${objectId}`);
      }
      break;
    }

    default:
      emfWarn(
        `replayEmfPlusRecords: Unknown EMF+ object type: ${objectType}, id=${objectId}`,
      );
      break;
  }
}

// ---------------------------------------------------------------------------
// Region object parser
// ---------------------------------------------------------------------------

/**
 * Parse a region node tree recursively from a DataView.
 * Returns the parsed node and the number of bytes consumed.
 */
function parseRegionNode(
  view: DataView,
  off: number,
  endOff: number,
): { node: EmfPlusRegionNode; bytesRead: number } | null {
  if (off + 4 > endOff) return null;

  const nodeType = view.getUint32(off, true);
  let cursor = off + 4;

  // Combine node types: 0=And(Intersect), 1=Or(Union), 2=Xor, 3=Exclude, 4=Complement
  if (nodeType <= 4) {
    const leftResult = parseRegionNode(view, cursor, endOff);
    if (!leftResult) return null;
    cursor += leftResult.bytesRead;

    const rightResult = parseRegionNode(view, cursor, endOff);
    if (!rightResult) return null;
    cursor += rightResult.bytesRead;

    return {
      node: {
        type: "combine",
        combineMode: nodeType,
        left: leftResult.node,
        right: rightResult.node,
      },
      bytesRead: cursor - off,
    };
  }

  // Rect leaf: 0x10000000
  if (nodeType === 0x10000000) {
    if (cursor + 16 > endOff) return null;
    const x = view.getFloat32(cursor, true);
    const y = view.getFloat32(cursor + 4, true);
    const w = view.getFloat32(cursor + 8, true);
    const h = view.getFloat32(cursor + 12, true);
    return {
      node: { type: "rect", x, y, width: w, height: h },
      bytesRead: cursor + 16 - off,
    };
  }

  // Path leaf: 0x10000001
  if (nodeType === 0x10000001) {
    if (cursor + 4 > endOff) return null;
    const pathDataSize = view.getInt32(cursor, true);
    cursor += 4;
    if (pathDataSize <= 0 || cursor + pathDataSize > endOff) return null;
    const path = parseEmfPlusPath(view, cursor, pathDataSize);
    return {
      node: path
        ? { type: "path", path }
        : { type: "empty" },
      bytesRead: cursor + pathDataSize - off,
    };
  }

  // Empty leaf: 0x10000002
  if (nodeType === 0x10000002) {
    return { node: { type: "empty" }, bytesRead: 4 };
  }

  // Infinite leaf: 0x10000003
  if (nodeType === 0x10000003) {
    return { node: { type: "infinite" }, bytesRead: 4 };
  }

  // Unknown node type — treat as empty
  emfWarn(`parseRegionNode: unknown node type 0x${nodeType.toString(16)}`);
  return { node: { type: "empty" }, bytesRead: 4 };
}

/**
 * Parse an EMF+ Region object (object type 0x08) from binary data.
 *
 * Binary layout (MS-EMFPLUS 2.2.1.8):
 * - Uint32: Version (0xDBC01002)
 * - Uint32: RegionNodeCount
 * - Region node tree (recursive)
 */
function parseEmfPlusRegionObject(
  view: DataView,
  off: number,
  maxLen: number,
): { kind: "plus-region"; nodes: EmfPlusRegionNode[] } | null {
  if (maxLen < 8) return null;

  const _version = view.getUint32(off, true);
  const regionNodeCount = view.getUint32(off + 4, true);

  if (regionNodeCount === 0 || regionNodeCount > 100000) {
    emfWarn(`parseEmfPlusRegionObject: invalid node count ${regionNodeCount}`);
    return null;
  }

  const endOff = off + maxLen;
  const result = parseRegionNode(view, off + 8, endOff);
  if (!result) {
    emfWarn(`parseEmfPlusRegionObject: failed to parse region node tree`);
    return null;
  }

  return {
    kind: "plus-region",
    nodes: [result.node],
  };
}
