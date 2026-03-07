/**
 * EMF+ OBJECT record dispatcher.
 *
 * Handles the EMFPLUS_OBJECT record by delegating to type-specific parsers.
 */

import type { EmfPlusReplayCtx } from "./emf-types";
import {
  EMFPLUS_OBJECTTYPE_BRUSH,
  EMFPLUS_OBJECTTYPE_PEN,
  EMFPLUS_OBJECTTYPE_PATH,
  EMFPLUS_OBJECTTYPE_FONT,
  EMFPLUS_OBJECTTYPE_STRINGFORMAT,
  EMFPLUS_OBJECTTYPE_IMAGE,
  EMFPLUS_OBJECTTYPE_IMAGEATTRIBUTES,
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

    default:
      emfWarn(
        `replayEmfPlusRecords: Unknown EMF+ object type: ${objectType}, id=${objectId}`,
      );
      break;
  }
}
