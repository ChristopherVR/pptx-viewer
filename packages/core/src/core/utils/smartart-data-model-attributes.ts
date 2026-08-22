import type {
	PptxSmartArtConnection,
	PptxSmartArtNode,
	SmartArtNodeCustomLayout,
	XmlObject,
} from '../types';

type NullableAttribute = string | null | undefined;

export interface SmartArtDataModelIssue {
	code:
		| 'POINT_ID_REQUIRED'
		| 'POINT_ID_DUPLICATE'
		| 'CONNECTION_ATTRIBUTE_REQUIRED'
		| 'CONNECTION_ID_DUPLICATE'
		| 'CONNECTION_ENDPOINT_MISSING';
	message: string;
}

function optionalString(value: unknown): string | undefined {
	const text = String(value ?? '').trim();
	return text.length > 0 ? text : undefined;
}

function optionalInteger(value: unknown): number | undefined {
	const parsed = Number.parseInt(String(value ?? ''), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function applyNullableAttribute(xml: XmlObject, key: string, value: NullableAttribute): void {
	if (value === undefined) {
		return;
	}
	if (value === null || value.trim().length === 0) {
		delete xml[key];
		return;
	}
	xml[key] = value;
}

/** Parse the typed CT_Cxn attributes while leaving its XML object untouched. */
export function parseSmartArtConnection(connection: XmlObject): PptxSmartArtConnection | undefined {
	const sourceId = optionalString(connection['@_srcId']);
	const destId = optionalString(connection['@_destId']);
	if (!sourceId || !destId) {
		return undefined;
	}
	const parsed: PptxSmartArtConnection = {
		sourceId,
		destId,
	};
	const optionalValues = {
		modelId: optionalString(connection['@_modelId']),
		type: optionalString(connection['@_type']),
		srcOrd: optionalInteger(connection['@_srcOrd']),
		destOrd: optionalInteger(connection['@_destOrd']),
		parentTransitionId: optionalString(connection['@_parTransId']),
		siblingTransitionId: optionalString(connection['@_sibTransId']),
		presentationId: optionalString(connection['@_presId']),
	};
	for (const [key, value] of Object.entries(optionalValues)) {
		if (value !== undefined) {
			(parsed as unknown as Record<string, unknown>)[key] = value;
		}
	}
	return parsed;
}

/** Apply editable CT_Pt attributes without disturbing unknown attributes/children. */
export function applySmartArtPointAttributes(xml: XmlObject, node: PptxSmartArtNode): void {
	applyNullableAttribute(xml, '@_cxnId', node.connectionId);
}

/** Apply editable CT_Cxn identifiers without disturbing unknown XML content. */
export function applySmartArtConnectionAttributes(
	xml: XmlObject,
	connection: PptxSmartArtConnection,
	fallbackModelId: () => string,
): void {
	applyNullableAttribute(xml, '@_modelId', connection.modelId);
	if (!xml['@_modelId']) {
		xml['@_modelId'] = fallbackModelId();
	}
	xml['@_srcId'] = connection.sourceId;
	xml['@_destId'] = connection.destId;
	applyNullableAttribute(xml, '@_parTransId', connection.parentTransitionId);
	applyNullableAttribute(xml, '@_sibTransId', connection.siblingTransitionId);
	applyNullableAttribute(xml, '@_presId', connection.presentationId);
}

/** Parse a `dgm:prSet` boolean attribute (`"1"`/`"true"`), or `undefined`. */
function optionalBoolean(value: unknown): boolean | undefined {
	const text = String(value ?? '').trim();
	if (text.length === 0) {
		return undefined;
	}
	return text === '1' || text.toLowerCase() === 'true';
}

/** Parse a `dgm:prSet` angle attribute (60,000ths of a degree) to plain degrees. */
function optionalAngleDegrees(value: unknown): number | undefined {
	const text = String(value ?? '').trim();
	if (text.length === 0) {
		return undefined;
	}
	const parsed = Number.parseFloat(text);
	return Number.isFinite(parsed) ? parsed / 60000 : undefined;
}

/** Parse a `dgm:prSet` percentage attribute (100,000ths of a percent) to a ratio. */
function optionalPercentageRatio(value: unknown): number | undefined {
	const text = String(value ?? '').trim();
	if (text.length === 0) {
		return undefined;
	}
	const parsed = Number.parseFloat(text);
	return Number.isFinite(parsed) ? parsed / 100000 : undefined;
}

/**
 * Parse the manual layout override attributes (`cust*`) from a `dgm:pt`'s
 * `dgm:prSet` element, or `undefined` when `prSet` is absent or carries none of
 * them. These capture a drag/resize/rotate/flip the user performed on a
 * `type="pres"` presentation point in PowerPoint's own diagram editor.
 */
export function parseSmartArtPointCustomLayout(
	prSet: XmlObject | undefined,
): SmartArtNodeCustomLayout | undefined {
	if (!prSet) {
		return undefined;
	}
	const custom: SmartArtNodeCustomLayout = {};
	const angle = optionalAngleDegrees(prSet['@_custAng']);
	if (angle !== undefined) {
		custom.angle = angle;
	}
	const scaleX = optionalPercentageRatio(prSet['@_custScaleX']);
	if (scaleX !== undefined) {
		custom.scaleX = scaleX;
	}
	const scaleY = optionalPercentageRatio(prSet['@_custScaleY']);
	if (scaleY !== undefined) {
		custom.scaleY = scaleY;
	}
	const sizeX = optionalPercentageRatio(prSet['@_custSzX']);
	if (sizeX !== undefined) {
		custom.sizeX = sizeX;
	}
	const sizeY = optionalPercentageRatio(prSet['@_custSzY']);
	if (sizeY !== undefined) {
		custom.sizeY = sizeY;
	}
	const linFactX = optionalPercentageRatio(prSet['@_custLinFactX']);
	if (linFactX !== undefined) {
		custom.linearFactorX = linFactX;
	}
	const linFactY = optionalPercentageRatio(prSet['@_custLinFactY']);
	if (linFactY !== undefined) {
		custom.linearFactorY = linFactY;
	}
	const linFactNeighborX = optionalPercentageRatio(prSet['@_custLinFactNeighborX']);
	if (linFactNeighborX !== undefined) {
		custom.linearFactorNeighborX = linFactNeighborX;
	}
	const linFactNeighborY = optionalPercentageRatio(prSet['@_custLinFactNeighborY']);
	if (linFactNeighborY !== undefined) {
		custom.linearFactorNeighborY = linFactNeighborY;
	}
	const radScaleRad = optionalPercentageRatio(prSet['@_custRadScaleRad']);
	if (radScaleRad !== undefined) {
		custom.radialScaleRadius = radScaleRad;
	}
	const radScaleInc = optionalPercentageRatio(prSet['@_custRadScaleInc']);
	if (radScaleInc !== undefined) {
		custom.radialScaleIncrement = radScaleInc;
	}
	const flipHor = optionalBoolean(prSet['@_custFlipHor']);
	if (flipHor !== undefined) {
		custom.flipHorizontal = flipHor;
	}
	const flipVert = optionalBoolean(prSet['@_custFlipVert']);
	if (flipVert !== undefined) {
		custom.flipVertical = flipVert;
	}
	const custT = optionalBoolean(prSet['@_custT']);
	if (custT !== undefined) {
		custom.hasCustomTransform = custT;
	}
	return Object.keys(custom).length > 0 ? custom : undefined;
}

function childrenByLocalName(parent: XmlObject | undefined, name: string): XmlObject[] {
	const key = Object.keys(parent ?? {}).find((entry) => entry.split(':').pop() === name);
	const value = key ? parent?.[key] : undefined;
	if (!value) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]).filter(
		(entry): entry is XmlObject => typeof entry === 'object' && entry !== null,
	);
}

/** Validate the required CT_Pt/CT_Cxn identifiers and graph references. */
export function validateSmartArtDataModelCore(dataModel: XmlObject): SmartArtDataModelIssue[] {
	const issues: SmartArtDataModelIssue[] = [];
	const pointList = childrenByLocalName(dataModel, 'ptLst')[0];
	const connectionList = childrenByLocalName(dataModel, 'cxnLst')[0];
	const pointIds = new Set<string>();
	for (const point of childrenByLocalName(pointList, 'pt')) {
		const id = optionalString(point['@_modelId']);
		if (!id) {
			issues.push({ code: 'POINT_ID_REQUIRED', message: 'dgm:pt requires modelId.' });
		} else if (pointIds.has(id)) {
			issues.push({ code: 'POINT_ID_DUPLICATE', message: `Duplicate dgm:pt modelId: ${id}.` });
		} else {
			pointIds.add(id);
		}
	}

	const connectionIds = new Set<string>();
	for (const connection of childrenByLocalName(connectionList, 'cxn')) {
		const id = optionalString(connection['@_modelId']);
		const sourceId = optionalString(connection['@_srcId']);
		const destId = optionalString(connection['@_destId']);
		for (const [attribute, value] of [
			['modelId', id],
			['srcId', sourceId],
			['destId', destId],
		]) {
			if (!value) {
				issues.push({
					code: 'CONNECTION_ATTRIBUTE_REQUIRED',
					message: `dgm:cxn requires ${attribute}.`,
				});
			}
		}
		if (id && connectionIds.has(id)) {
			issues.push({
				code: 'CONNECTION_ID_DUPLICATE',
				message: `Duplicate dgm:cxn modelId: ${id}.`,
			});
		} else if (id) {
			connectionIds.add(id);
		}
		for (const [attribute, value] of [
			['srcId', sourceId],
			['destId', destId],
		]) {
			if (value && !pointIds.has(value)) {
				issues.push({
					code: 'CONNECTION_ENDPOINT_MISSING',
					message: `dgm:cxn ${attribute} references missing point: ${value}.`,
				});
			}
		}
	}
	return issues;
}
