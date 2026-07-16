import type { CustomGeometryPath, CustomGeometrySegment, XmlObject } from '../types';
import { orderedPathCommandEntries } from './custom-geometry-command-order';
import {
	evaluateGuides,
	parseAdjustmentValues,
	parseGuideDefinitions,
	resolveCoordinate,
} from './guide-formula';

type EnsureArray = (value: unknown) => unknown[];

function parseBoolean(value: unknown): boolean | undefined {
	if (value === true || value === '1' || value === 'true') {
		return true;
	}
	if (value === false || value === '0' || value === 'false') {
		return false;
	}
	return undefined;
}

function parsePoint(node: unknown, variables: Map<string, number>) {
	const point = node as XmlObject | undefined;
	return point
		? {
				x: resolveCoordinate(point['@_x'] as string | number | undefined, variables),
				y: resolveCoordinate(point['@_y'] as string | number | undefined, variables),
			}
		: undefined;
}

function parseSegments(
	path: XmlObject,
	variables: Map<string, number>,
	ensureArray: EnsureArray,
): CustomGeometrySegment[] {
	const segments: CustomGeometrySegment[] = [];
	for (const [key, item] of orderedPathCommandEntries(path, ensureArray)) {
		const command = item as XmlObject | undefined;
		if (key === 'a:close') {
			segments.push({ type: 'close' });
		} else if (key === 'a:moveTo' || key === 'a:lnTo') {
			const point = parsePoint(command?.['a:pt'], variables);
			if (point) {
				segments.push({ type: key === 'a:moveTo' ? 'moveTo' : 'lineTo', pt: point });
			}
		} else if (key === 'a:cubicBezTo' || key === 'a:quadBezTo') {
			const points = ensureArray(command?.['a:pt'])
				.map((point) => parsePoint(point, variables))
				.filter((point) => point !== undefined);
			const expected = key === 'a:cubicBezTo' ? 3 : 2;
			if (points.length === expected) {
				segments.push(
					key === 'a:cubicBezTo'
						? { type: 'cubicBezTo', pts: [points[0], points[1], points[2]] }
						: { type: 'quadBezTo', pts: [points[0], points[1]] },
				);
			}
		} else if (key === 'a:arcTo' && command) {
			segments.push({
				type: 'arcTo',
				wR: resolveCoordinate(command['@_wR'] as string | number | undefined, variables),
				hR: resolveCoordinate(command['@_hR'] as string | number | undefined, variables),
				stAng: resolveCoordinate(command['@_stAng'] as string | number | undefined, variables),
				swAng: resolveCoordinate(command['@_swAng'] as string | number | undefined, variables),
			});
		}
	}
	return segments;
}

/** Parse formula-backed DrawingML custom paths without lossy SVG conversion. */
export function parseStructuredCustomGeometry(
	custGeom: XmlObject,
	shapeWidth: number,
	shapeHeight: number,
	ensureArray: EnsureArray,
): CustomGeometryPath[] {
	const pathNodes = ensureArray(
		(custGeom['a:pathLst'] as XmlObject | undefined)?.['a:path'],
	) as XmlObject[];
	if (pathNodes.length === 0) {
		return [];
	}
	const adjustments = parseAdjustmentValues(
		ensureArray((custGeom['a:avLst'] as XmlObject | undefined)?.['a:gd']) as XmlObject[],
	);
	const guides = parseGuideDefinitions(
		ensureArray((custGeom['a:gdLst'] as XmlObject | undefined)?.['a:gd']) as XmlObject[],
	);
	const firstPath = pathNodes[0];
	const contextWidth = Number(firstPath['@_w']) || shapeWidth;
	const contextHeight = Number(firstPath['@_h']) || shapeHeight;
	const variables = evaluateGuides(guides, { w: contextWidth, h: contextHeight }, adjustments);

	return pathNodes.map((path) => {
		const fill = String(path['@_fill'] ?? '');
		const fillMode = ['norm', 'lighten', 'lightenLess', 'darken', 'darkenLess', 'none'].includes(
			fill,
		)
			? (fill as CustomGeometryPath['fillMode'])
			: undefined;
		return {
			width: Number(path['@_w']) || contextWidth,
			height: Number(path['@_h']) || contextHeight,
			segments: parseSegments(path, variables, ensureArray),
			fillMode,
			stroke: parseBoolean(path['@_stroke']),
			extrusionOk: parseBoolean(path['@_extrusionOk']),
		};
	});
}
