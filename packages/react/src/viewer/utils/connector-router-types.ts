/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The connector-router types now live in `pptx-viewer-shared`
 * (`render/connector-router-types`). This shim preserves the historical
 * import surface (`RouterPoint`, `RouterRect`, `ConnectorRouterOptions`).
 */
export type { RouterPoint, RouterRect, ConnectorRouterOptions } from 'pptx-viewer-shared';
