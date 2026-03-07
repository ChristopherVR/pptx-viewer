import type { XmlObject } from "../../types";
import type {
  PptxSmartArtNode,
  PptxSmartArtConnection,
} from "../../types/smart-art";

/**
 * Build XML point-node objects (`dgm:pt`) from in-memory SmartArt nodes.
 */
export function buildSmartArtPointXml(nodes: PptxSmartArtNode[]): XmlObject[] {
  return nodes.map((node) => {
    const ptNode: XmlObject = {
      "@_modelId": node.id,
    };
    if (node.nodeType) {
      ptNode["@_type"] = node.nodeType;
    }
    ptNode["dgm:t"] = {
      "a:bodyPr": {},
      "a:lstStyle": {},
      "a:p": {
        "a:r": {
          "a:rPr": { "@_lang": "en-US", "@_dirty": "0" },
          "a:t": node.text,
        },
      },
    };
    return ptNode;
  });
}

/**
 * Build XML connection-node objects (`dgm:cxn`) from in-memory connections.
 */
export function buildSmartArtConnectionXml(
  connections: PptxSmartArtConnection[],
): XmlObject[] {
  return connections.map((conn) => {
    const cxnNode: XmlObject = {
      "@_srcId": conn.sourceId,
      "@_destId": conn.destId,
    };
    if (conn.type) cxnNode["@_type"] = conn.type;
    if (conn.srcOrd !== undefined) cxnNode["@_srcOrd"] = String(conn.srcOrd);
    if (conn.destOrd !== undefined) cxnNode["@_destOrd"] = String(conn.destOrd);
    return cxnNode;
  });
}
