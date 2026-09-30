import type { PptxSmartArtData } from 'pptx-viewer-core';

import { resolveDrawingShapeNodeId } from '../smartart-inline-edit';
import { flattenNodes } from '../smartart-layout-helpers';

/** Update the editable node colors without changing authored geometry or connector styles. */
export function smartArtColorPatch(
	data: PptxSmartArtData,
	fillColors: string[],
): Partial<PptxSmartArtData> {
	const original = data.colorTransform;
	const roles =
		original?.roleColors ??
		Object.fromEntries(
			(original?.labels ?? [{ name: 'node0' }, { name: 'node1' }]).map((label) => [
				label.name,
				{ fill: [], line: [] },
			]),
		);
	const roleColors = Object.fromEntries(
		Object.entries(roles).map(([name, colors]) => [
			name,
			/^node\d+$/u.test(name) ? { ...colors, fill: [...fillColors] } : colors,
		]),
	);
	const flat = flattenNodes(data.nodes);
	const shapes = data.drawingShapes;
	return {
		colorTransformDirty: true,
		colorTransform: {
			...original,
			fillColors: [...fillColors],
			lineColors: original?.lineColors ?? [],
			roleColors,
			fillInterpolation: { method: 'cycle' },
			labels: original?.labels?.map((label) =>
				/^node\d+$/u.test(label.name)
					? { ...label, fill: { ...label.fill, method: 'cycle' } }
					: label,
			),
		},
		drawingDirty: Boolean(shapes?.length),
		drawingShapes: shapes?.map((shape, index) => {
			const nodeId = resolveDrawingShapeNodeId(shape, index, shapes, data.nodes);
			const nodeIndex = flat.findIndex((node) => node.id === nodeId);
			return nodeIndex < 0
				? shape
				: {
						...shape,
						fillColor: fillColors[nodeIndex % fillColors.length],
						fillGradientStops: undefined,
						fillGradientType: undefined,
						fillGradientAngle: undefined,
					};
		}),
	};
}
