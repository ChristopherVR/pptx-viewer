import type { Point } from './element-interaction';
import { computeRotation } from './element-interaction';

/**
 * Anchor a rotate drag to the actual press, including its offset inside the
 * handle's hit area. Points must share one coordinate space. Snapping and
 * rounding remain the caller's existing policy.
 */
export function createRotationDrag(
	center: Point,
	startPointer: Point,
	startRotation: number,
): (pointer: Point) => number {
	const bearing = (pointer: Point): number | undefined =>
		pointer.x === center.x && pointer.y === center.y ? undefined : computeRotation(center, pointer);
	let startAngle = bearing(startPointer);
	let rotation = startRotation;
	return (pointer) => {
		const angle = bearing(pointer);
		// A zero-height connector can place its rotate handle at its center.
		// There is no bearing there: wait for a direction instead of jumping.
		if (angle === undefined) {
			return rotation;
		}
		if (startAngle === undefined) {
			startAngle = angle;
			return rotation;
		}
		rotation = (((startRotation + angle - startAngle) % 360) + 360) % 360;
		return rotation;
	};
}
