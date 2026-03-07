import type { XmlObject } from "../../types";

import type {
  ConnectorXmlFactoryInit,
  IConnectorXmlFactory,
  PptxBuilderFactoryContext,
} from "./types";

/**
 * Factory that produces OpenXML `p:cxnSp` (connection shape) XML objects.
 *
 * Generates the full connector shape tree including:
 * - `p:nvCxnSpPr` (non-visual properties with unique ID)
 * - `p:spPr` (shape properties with transform, geometry, and line style)
 * - Start/end connection bindings (`a:stCxn` / `a:endCxn`)
 * - Stroke color, width, dash pattern, and arrowheads
 */
export class ConnectorXmlFactory implements IConnectorXmlFactory {
  private readonly context: PptxBuilderFactoryContext;

  /** @param context - Shared factory context providing ID generation and unit conversion. */
  public constructor(context: PptxBuilderFactoryContext) {
    this.context = context;
  }

  /**
   * Create a `p:cxnSp` XML object from a connector element model.
   * @param init - Initialization data containing the connector element.
   * @returns A complete OpenXML connector shape XML object.
   */
  public createXmlElement(init: ConnectorXmlFactoryInit): XmlObject {
    const { element } = init;
    // Default to straightConnector1 for line-type connectors; otherwise normalize geometry
    const geometry =
      element.shapeType && element.shapeType !== "line"
        ? this.context.normalizePresetGeometry(element.shapeType)
        : "straightConnector1";
    const strokeColor = element.shapeStyle?.strokeColor || "#1F2937";
    const strokeWidth = Math.max(1, element.shapeStyle?.strokeWidth || 1);
    // Build the a:ln (line) node with width in EMU
    const lineNode: XmlObject = {
      "@_w": String(Math.round(strokeWidth * this.context.emuPerPx)),
    };
    if (strokeColor === "transparent" || strokeWidth <= 0) {
      lineNode["a:noFill"] = {};
    } else {
      lineNode["a:solidFill"] = {
        "a:srgbClr": {
          "@_val": strokeColor.replace("#", ""),
        },
      };
    }

    if (element.shapeStyle?.strokeDash) {
      if (element.shapeStyle.strokeDash === "solid") {
        delete lineNode["a:prstDash"];
        delete lineNode["a:custDash"];
      } else if (element.shapeStyle.strokeDash === "custom") {
        delete lineNode["a:prstDash"];
        if (
          element.shapeStyle.customDashSegments &&
          element.shapeStyle.customDashSegments.length > 0
        ) {
          lineNode["a:custDash"] = {
            "a:ds": element.shapeStyle.customDashSegments.map((segment) => ({
              "@_d": String(segment.dash),
              "@_sp": String(segment.space),
            })),
          };
        } else {
          lineNode["a:custDash"] = {
            "a:ds": {
              "@_d": "200000",
              "@_sp": "200000",
            },
          };
        }
      } else {
        lineNode["a:prstDash"] = {
          "@_val": element.shapeStyle.strokeDash,
        };
        delete lineNode["a:custDash"];
      }
    }

    if (
      element.shapeStyle?.connectorStartArrow &&
      element.shapeStyle.connectorStartArrow !== "none"
    ) {
      lineNode["a:headEnd"] = {
        "@_type": element.shapeStyle.connectorStartArrow,
      };
    }
    if (
      element.shapeStyle?.connectorEndArrow &&
      element.shapeStyle.connectorEndArrow !== "none"
    ) {
      lineNode["a:tailEnd"] = {
        "@_type": element.shapeStyle.connectorEndArrow,
      };
    }

    // Build connection site references (a:stCxn / a:endCxn) on the cNvCxnSpPr node
    const cNvCxnSpPr: XmlObject = {};
    if (element.shapeStyle?.connectorStartConnection?.shapeId) {
      cNvCxnSpPr["a:stCxn"] = {
        "@_id": element.shapeStyle.connectorStartConnection.shapeId,
        "@_idx": String(
          element.shapeStyle.connectorStartConnection.connectionSiteIndex ?? 0,
        ),
      };
    }
    if (element.shapeStyle?.connectorEndConnection?.shapeId) {
      cNvCxnSpPr["a:endCxn"] = {
        "@_id": element.shapeStyle.connectorEndConnection.shapeId,
        "@_idx": String(
          element.shapeStyle.connectorEndConnection.connectionSiteIndex ?? 0,
        ),
      };
    }

    const connectorId = this.context.getNextId();

    return {
      "p:nvCxnSpPr": {
        "p:cNvPr": {
          "@_id": String(connectorId),
          "@_name": `Connector ${connectorId}`,
        },
        "p:cNvCxnSpPr": cNvCxnSpPr,
        "p:nvPr": {},
      },
      "p:spPr": {
        "a:xfrm": {
          "a:off": {
            "@_x": String(Math.round(element.x * this.context.emuPerPx)),
            "@_y": String(Math.round(element.y * this.context.emuPerPx)),
          },
          "a:ext": {
            "@_cx": String(Math.round(element.width * this.context.emuPerPx)),
            "@_cy": String(Math.round(element.height * this.context.emuPerPx)),
          },
          "@_rot": element.rotation
            ? String(Math.round(element.rotation * 60000))
            : undefined,
          "@_flipH": element.flipHorizontal ? "1" : undefined,
          "@_flipV": element.flipVertical ? "1" : undefined,
        },
        "a:prstGeom": {
          "@_prst": geometry,
          "a:avLst": {},
        },
        "a:ln": lineNode,
      },
    };
  }
}
