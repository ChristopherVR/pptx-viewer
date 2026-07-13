/** Convert a pointer event from viewport coordinates into slide coordinates. */
export function resolveStagePoint(
	overlayRoot: HTMLElement | undefined,
	scale: number,
	event: PointerEvent,
): { x: number; y: number } | null {
	const rect = overlayRoot?.getBoundingClientRect();
	return rect && scale > 0
		? { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
		: null;
}
