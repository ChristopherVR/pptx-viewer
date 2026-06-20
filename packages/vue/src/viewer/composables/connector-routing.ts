/**
 * Connector routing helpers for the Vue viewer.
 *
 * Thin re-export shim. Connector path geometry (bent / curved / straight) comes
 * from `pptx-viewer-core` (`getConnectorPathGeometry`); the compound-line
 * helpers and the `connectorNeedsPath` classifier now live in
 * `pptx-viewer-shared` (`render/connector-style`), shared by every binding.
 *
 * This file preserves the historical import surface so `ConnectorRenderer.vue`
 * and the colocated tests are unchanged.
 */

// Core geometry: one import point for callers.
export { getConnectorPathGeometry, getConnectorAdjustment } from 'pptx-viewer-core';
export type { ConnectorPathGeometry } from 'pptx-viewer-core';

// Shared line-style helpers + connector classification.
export type { CompoundLineType } from 'pptx-viewer-shared';
export {
	getCompoundLineOffsets,
	getCompoundLineWidths,
	connectorNeedsPath,
} from 'pptx-viewer-shared';
