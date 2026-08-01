/**
 * Thin re-export shim → vendored `pptx-viewer-shared`
 * (`render/connector-path`).
 *
 * The pure connector-geometry builder (`buildConnectorGeometry` + its helpers,
 * arrow `MarkerShape`s, wrapper-style serialisation) was extracted to shared and
 * is consumed by every binding. This shim preserves the historical Angular
 * import surface so `ConnectorRendererComponent`, the viewer barrel, and the
 * colocated tests are unchanged.
 *
 * `connectorKind` is re-exported from shared's `connector-style` (where it lives
 * canonically) so this binding's existing `./connector-path` import sites keep
 * working.
 */

export type { ConnectorRouting, MarkerShape, ConnectorGeometry } from '../internal/shared';

export {
	buildConnectorGeometry,
	buildDashArray,
	connectorHitStrokeWidth,
	connectorKind,
	connectorBendFraction,
	buildConnectorPathD,
	markerPath,
	normalizeArrow,
	buildWrapperStyle,
} from '../internal/shared';
