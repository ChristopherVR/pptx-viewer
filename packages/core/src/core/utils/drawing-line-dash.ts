import type { ShapeStyle, StrokeDashType, XmlObject } from '../types';

const DASH_SUFFIX = new Set(['round', 'bevel', 'miter', 'headEnd', 'tailEnd', 'extLst']);
const MAX_INT32 = 2147483647;

const localName = (key: string): string => key.replace(/^@_/u, '').split(':').at(-1) ?? key;

function child(parent: XmlObject, name: string): XmlObject | undefined {
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	const value = key ? parent[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function children(parent: XmlObject, name: string): XmlObject[] {
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	const value = key ? parent[key] : undefined;
	return (Array.isArray(value) ? value : value ? [value] : []).filter(
		(item): item is XmlObject => typeof item === 'object' && item !== null,
	);
}

function attribute(node: XmlObject, name: string): unknown {
	const key = Object.keys(node).find(
		(candidate) => candidate.startsWith('@_') && localName(candidate) === name,
	);
	return key ? node[key] : undefined;
}

function nonNegativeInt32(value: unknown): number | undefined {
	if (!/^\d+$/u.test(String(value ?? ''))) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed <= MAX_INT32 ? parsed : undefined;
}

export function parseDrawingLineDash(
	lineNode: XmlObject,
	normalizePreset: (value: unknown) => StrokeDashType | undefined,
): Pick<
	ShapeStyle,
	'strokeDash' | 'customDashSegments' | 'customDashSegmentXml' | 'customDashXml'
> {
	const preset = child(lineNode, 'prstDash');
	const dashType = normalizePreset(attribute(preset ?? {}, 'val'));
	if (dashType) {
		return { strokeDash: dashType };
	}
	const custom = child(lineNode, 'custDash');
	if (!custom) {
		return {};
	}
	const rawSegments = children(custom, 'ds');
	const valid: Array<{ dash: number; space: number; raw: XmlObject }> = [];
	for (const node of rawSegments) {
		const dash = nonNegativeInt32(attribute(node, 'd'));
		const space = nonNegativeInt32(attribute(node, 'sp'));
		if (dash !== undefined && space !== undefined) {
			valid.push({ dash, space, raw: node });
		}
	}
	return {
		strokeDash: 'custom',
		customDashSegments: valid.map(({ dash, space }) => ({ dash, space })),
		customDashSegmentXml: valid.map(({ raw }) => raw),
		customDashXml: custom,
	};
}

export function applyDrawingLineDash(lineNode: XmlObject, style: ShapeStyle): void {
	if (style.strokeDash === undefined) {
		return;
	}
	if (style.strokeDash === 'solid') {
		setDashChoice(lineNode, undefined, undefined);
		return;
	}
	if (style.strokeDash !== 'custom') {
		setDashChoice(lineNode, 'prstDash', { '@_val': style.strokeDash });
		return;
	}
	const source =
		style.customDashSegments && style.customDashSegments.length > 0
			? style.customDashSegments
			: [{ dash: 200000, space: 200000 }];
	const segments = source.flatMap((segment, index) => {
		const dash = nonNegativeInt32(segment.dash);
		const space = nonNegativeInt32(segment.space);
		if (dash === undefined || space === undefined) {
			return [];
		}
		const node: XmlObject = { ...(style.customDashSegmentXml?.[index] ?? {}) };
		if (nonNegativeInt32(attribute(node, 'd')) !== dash) {
			node['@_d'] = String(dash);
		}
		if (nonNegativeInt32(attribute(node, 'sp')) !== space) {
			node['@_sp'] = String(space);
		}
		return [node];
	});
	if (segments.length === 0) {
		setDashChoice(lineNode, undefined, undefined);
		return;
	}
	const custom: XmlObject = { ...(style.customDashXml ?? {}) };
	const dashKey = Object.keys(custom).find((key) => localName(key) === 'ds') ?? 'a:ds';
	for (const key of Object.keys(custom)) {
		if (localName(key) === 'ds') {
			delete custom[key];
		}
	}
	custom[dashKey] = segments.length === 1 ? segments[0] : segments;
	setDashChoice(lineNode, 'custDash', custom);
}

function setDashChoice(
	lineNode: XmlObject,
	name: 'prstDash' | 'custDash' | undefined,
	value: XmlObject | undefined,
): void {
	const existingKey = Object.keys(lineNode).find((key) => name && localName(key) === name);
	const entries = Object.entries(lineNode).filter(
		([key]) => !['prstDash', 'custDash'].includes(localName(key)),
	);
	for (const key of Object.keys(lineNode)) {
		delete lineNode[key];
	}
	let inserted = false;
	for (const [key, entryValue] of entries) {
		if (!inserted && name && value && DASH_SUFFIX.has(localName(key))) {
			lineNode[existingKey ?? `a:${name}`] = value;
			inserted = true;
		}
		lineNode[key] = entryValue;
	}
	if (!inserted && name && value) {
		lineNode[existingKey ?? `a:${name}`] = value;
	}
}
