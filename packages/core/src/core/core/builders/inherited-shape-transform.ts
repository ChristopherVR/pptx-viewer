import type { PptxElement, XmlObject } from '../../types';
import { xmlChild } from '../../utils/xml-access';

const NUMERIC_KEYS = ['x', 'y', 'width', 'height', 'rotation', 'skewX', 'skewY'] as const;

/** Materialize only an edited inherited p:sp/p:pic transform, not an unchanged placeholder. */
export function materializeInheritedShapeTransform(
	shape: XmlObject,
	element: PptxElement,
): XmlObject | undefined {
	const baseline = element.inheritedTransform;
	const envelope =
		element.type === 'text' || element.type === 'shape'
			? 'p:nvSpPr'
			: element.type === 'picture' || element.type === 'media'
				? 'p:nvPicPr'
				: undefined;
	if (!baseline || !envelope || !xmlChild(shape, envelope)) {
		return undefined;
	}
	if (
		(['x', 'y', 'width', 'height'] as const).some(
			(key) => !Number.isFinite(element[key]) || !Number.isFinite(baseline[key]),
		) ||
		NUMERIC_KEYS.some(
			(key) => !Number.isFinite(element[key] ?? 0) || !Number.isFinite(baseline[key] ?? 0),
		) ||
		element.width < 0 ||
		element.height < 0 ||
		baseline.width < 0 ||
		baseline.height < 0
	) {
		return undefined;
	}
	const changed =
		NUMERIC_KEYS.some((key) => (element[key] ?? 0) !== (baseline[key] ?? 0)) ||
		Boolean(element.flipHorizontal) !== Boolean(baseline.flipHorizontal) ||
		Boolean(element.flipVertical) !== Boolean(baseline.flipVertical);
	if (!changed) {
		return undefined;
	}
	const transform: XmlObject = {};
	const properties = { ...xmlChild(shape, 'p:spPr') };
	delete properties['a:xfrm'];
	shape['p:spPr'] = { 'a:xfrm': transform, ...properties };
	return transform;
}
