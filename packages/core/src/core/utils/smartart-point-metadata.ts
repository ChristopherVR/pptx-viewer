/**
 * Everything a SmartArt content node takes from the data model's
 * presentation points, resolved once per diagram: its quick-style role
 * (`smartart-node-style-role.ts`), whether it opts out of the coherent-3D
 * scene (`prSet/@coherent3DOff`), and the layout variables recorded per
 * presentation node (`smartart-node-pres-vars.ts`). Needs the FULL
 * (unfiltered) point list: `pres` points are not content points.
 *
 * @module smartart-point-metadata
 */

import type { PptxSmartArtConnection, PptxSmartArtNode, XmlObject } from '../types';
import { resolveSmartArtNodePresVars } from './smartart-node-pres-vars';
import {
	resolveSmartArtNodeCoherent3DOff,
	resolveSmartArtNodeStyleRoles,
} from './smartart-node-style-role';

export type SmartArtPointMetadata = Pick<
	PptxSmartArtNode,
	'styleRole' | 'coherent3DOff' | 'presLayoutVarsByName'
>;

export function resolveSmartArtPointMetadata(
	points: XmlObject[],
	connections: PptxSmartArtConnection[],
	localName: (key: string) => string,
): (pointId: string) => SmartArtPointMetadata {
	const styleRoles = resolveSmartArtNodeStyleRoles(points, connections, localName);
	const coherent3DOff = resolveSmartArtNodeCoherent3DOff(points, connections, localName);
	const presVars = resolveSmartArtNodePresVars(points, localName);
	return (pointId) => ({
		styleRole: styleRoles.get(pointId),
		coherent3DOff: coherent3DOff.has(pointId) || undefined,
		presLayoutVarsByName: presVars.get(pointId),
	});
}
