/**
 * Barrel re-export - all connector shape utilities.
 *
 * Downstream code continues to import from this file;
 * the implementation now lives in `connector-path` and `vector-shape-renderer`.
 */
export {
  getConnectorAdjustment,
  getConnectorPathGeometry,
  renderConnectorMarker,
  getCompoundLineOffsets,
  getCompoundLineWidths,
  getConnectionSites,
} from "./connector-path";

export { renderVectorShape } from "./vector-shape-renderer";
