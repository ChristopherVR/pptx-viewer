import { describe, expect, it } from 'vitest';

import { resolveRotateHandlePlacement } from './rotate-handle-placement';
import type { RotateHandlePlacement } from './rotate-handle-placement';

const base: RotateHandlePlacement = {
	preferred: { x: 200, y: 76 },
	selection: { left: 100, right: 300, top: 100, bottom: 200 },
	bounds: { left: 0, right: 400, top: 0, bottom: 300 },
	hitWidth: 12,
	hitHeight: 12,
	obstacles: [],
};

describe('resolveRotateHandlePlacement', () => {
	it('preserves the exact preferred point when its full target fits', () => {
		expect(resolveRotateHandlePlacement(base)).toBe(base.preferred);
	});

	it('moves a clipped target even when its visible center is inside', () => {
		const point = resolveRotateHandlePlacement({ ...base, bounds: { ...base.bounds, top: 72 } });
		expect(point).not.toStrictEqual(base.preferred);
		expect(point!.y).toBeGreaterThanOrEqual(79);
	});

	it.each(['top', 'right', 'bottom', 'left'] as const)(
		'keeps a %s-edge knob within the viewport',
		(edge) => {
			const preferred = {
				top: { x: 200, y: -24 },
				right: { x: 424, y: 150 },
				bottom: { x: 200, y: 324 },
				left: { x: -24, y: 150 },
			}[edge];
			const point = resolveRotateHandlePlacement({ ...base, preferred, selection: base.bounds });
			expect(point).not.toBeNull();
			expect(point!.x).toBeGreaterThan(6);
			expect(point!.x).toBeLessThan(394);
			expect(point!.y).toBeGreaterThan(6);
			expect(point!.y).toBeLessThan(294);
		},
	);

	it('avoids the North resize target and an adjustment target', () => {
		const obstacles = [
			{ left: 194, right: 206, top: 70, bottom: 82 },
			{ left: 194, right: 206, top: 218, bottom: 230 },
		];
		const point = resolveRotateHandlePlacement({ ...base, obstacles });
		expect(point).not.toBeNull();
		for (const rect of obstacles) {
			expect(
				point!.x + 6 <= rect.left - 2 ||
					point!.x - 6 >= rect.right + 2 ||
					point!.y + 6 <= rect.top - 2 ||
					point!.y - 6 >= rect.bottom + 2,
			).toBeTruthy();
		}
	});

	it('does not fall back to the rotation center on a full-slide selection', () => {
		const point = resolveRotateHandlePlacement({
			...base,
			selection: base.bounds,
			preferred: { x: 200, y: -24 },
			hitWidth: 36,
			hitHeight: 36,
		});
		expect(point).not.toBeNull();
		expect(point).not.toStrictEqual({ x: 200, y: 150 });
	});

	it('uses actual asymmetric target overhang at a clipped rotated side', () => {
		const selection = { left: 929.14, right: 963.92, top: 288.35, bottom: 418.76 };
		// Borders and scaled margins need not center the 22px resize target
		// exactly on the selected box. Half its width underestimates this side.
		const obstacles = [917.71, 952.49].flatMap((left) =>
			[277.78, 342.99, 408.2].map((top) => ({ left, right: left + 22, top, bottom: top + 22 })),
		);
		obstacles.push(
			...[277.78, 408.2].map((top) => ({ left: 935.1, right: 957.1, top, bottom: top + 22 })),
		);
		const point = resolveRotateHandlePlacement({
			preferred: { x: 987.48, y: 353.99 },
			selection,
			bounds: { left: 398.78, right: 955.23, top: 205.75, bottom: 518.75 },
			hitWidth: 24,
			hitHeight: 24,
			obstacles,
		});
		expect(point).not.toBeNull();
		expect(point!.x + 12).toBeLessThanOrEqual(917.71 - 3);
	});

	it('returns no placement instead of shrinking a target in an impossibly small viewport', () => {
		expect(
			resolveRotateHandlePlacement({ ...base, bounds: { left: 0, right: 10, top: 0, bottom: 10 } }),
		).toBeNull();
	});

	it('rejects non-finite and empty geometry', () => {
		expect(resolveRotateHandlePlacement({ ...base, hitWidth: 0 })).toBeNull();
		expect(resolveRotateHandlePlacement({ ...base, preferred: { x: NaN, y: 0 } })).toBeNull();
	});
});
