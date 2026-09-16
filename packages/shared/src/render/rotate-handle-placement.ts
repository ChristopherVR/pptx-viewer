/** Axis-aligned screen coordinates, after the slide's zoom and rotation. */
export interface HandlePlacementRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface HandlePlacementPoint {
	x: number;
	y: number;
}

export interface RotateHandlePlacement {
	preferred: HandlePlacementPoint;
	selection: HandlePlacementRect;
	bounds: HandlePlacementRect;
	/** The complete pointer target, not just the visible indicator. */
	hitWidth: number;
	hitHeight: number;
	obstacles: readonly HandlePlacementRect[];
}

/**
 * Keep the usual knob position whenever it fits. Otherwise try a finite set
 * of nearby outside and inset positions, without moving any slide content.
 * Null means no supported candidate fits a non-overlapping pointer target;
 * callers keep the original control rather than silently removing Rotate.
 */
export function resolveRotateHandlePlacement(
	input: RotateHandlePlacement,
): HandlePlacementPoint | null {
	const { preferred, selection, bounds, hitWidth, hitHeight, obstacles } = input;
	if (
		![
			...Object.values(preferred),
			...Object.values(selection),
			...Object.values(bounds),
			hitWidth,
			hitHeight,
		].every(Number.isFinite) ||
		hitWidth <= 0 ||
		hitHeight <= 0
	) {
		return null;
	}
	const halfX = hitWidth / 2;
	const halfY = hitHeight / 2;
	const center = {
		x: (selection.left + selection.right) / 2,
		y: (selection.top + selection.bottom) / 2,
	};
	const fits = ({ x, y }: HandlePlacementPoint): boolean => {
		const rect = { left: x - halfX, right: x + halfX, top: y - halfY, bottom: y + halfY };
		return (
			rect.left >= bounds.left + 1 &&
			rect.right <= bounds.right - 1 &&
			rect.top >= bounds.top + 1 &&
			rect.bottom <= bounds.bottom - 1 &&
			// A target over the rotation center has no usable initial bearing.
			!(
				center.x >= rect.left &&
				center.x <= rect.right &&
				center.y >= rect.top &&
				center.y <= rect.bottom
			) &&
			!obstacles.some(
				(other) =>
					rect.left < other.right + 2 &&
					rect.right > other.left - 2 &&
					rect.top < other.bottom + 2 &&
					rect.bottom > other.top - 2,
			)
		);
	};
	if (fits(preferred)) {
		return preferred;
	}
	const padX = Math.max(
		24,
		halfX +
			3 +
			Math.max(
				0,
				...obstacles.flatMap((rect) => [selection.left - rect.left, rect.right - selection.right]),
			),
	);
	const padY = Math.max(
		24,
		halfY +
			3 +
			Math.max(
				0,
				...obstacles.flatMap((rect) => [selection.top - rect.top, rect.bottom - selection.bottom]),
			),
	);
	const candidates = [
		{ x: center.x, y: selection.top - padY },
		{ x: selection.right + padX, y: center.y },
		{ x: center.x, y: selection.bottom + padY },
		{ x: selection.left - padX, y: center.y },
	];
	const left = Math.max(selection.left, bounds.left) + halfX + 3;
	const right = Math.min(selection.right, bounds.right) - halfX - 3;
	const top = Math.max(selection.top, bounds.top) + halfY + 3;
	const bottom = Math.min(selection.bottom, bounds.bottom) - halfY - 3;
	if (left <= right && top <= bottom) {
		for (const fraction of [0.25, 0.75]) {
			const x = left + (right - left) * fraction;
			const y = top + (bottom - top) * fraction;
			candidates.push({ x, y: top }, { x, y: bottom }, { x: left, y }, { x: right, y });
		}
	}
	return (
		candidates.filter(fits).sort((a, b) => {
			const difference =
				Math.hypot(a.x - preferred.x, a.y - preferred.y) -
				Math.hypot(b.x - preferred.x, b.y - preferred.y);
			// Keep the finite candidate order for visually equivalent distances;
			// fractional layout rounding must not flip a knob between two sides.
			return Math.abs(difference) < 0.5 ? 0 : difference;
		})[0] ?? null
	);
}
