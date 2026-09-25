/**
 * useCropOverlayDrag: the pointer half of the crop overlay. A pointer-down on
 * a crop handle drags that edge/corner (`dragCropHandle`); a pointer-down on
 * the ghost image or inside the frame pans the picture behind the frame
 * (`panCropImage`). Client deltas are divided by the stage zoom, rotated into
 * the picture's own axes (`toElementAxes`) and written LIVE through the crop
 * controller, which records the single undo step on commit.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { beginCropDrag, dragCropHandle, panCropImage, toElementAxes } from 'pptx-viewer-shared';
import type { CropDragStart, CropElementUpdate, CropHandleId } from 'pptx-viewer-shared';
import { onScopeDispose } from 'vue';

export interface UseCropOverlayDragInput {
	element: () => PptxElement | null;
	zoom: () => number;
	applyLive: (update: CropElementUpdate) => void;
}

export interface UseCropOverlayDragResult {
	/** Pointer-down on a handle (`handle`) or on the ghost/frame (`null` = pan). */
	onPointerDown: (event: PointerEvent, handle: CropHandleId | null) => void;
}

export function useCropOverlayDrag(input: UseCropOverlayDragInput): UseCropOverlayDragResult {
	let stop: (() => void) | null = null;

	function onPointerDown(event: PointerEvent, handle: CropHandleId | null): void {
		const el = input.element();
		if (!el || event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		stop?.();
		const start: CropDragStart = beginCropDrag(el);
		const originX = event.clientX;
		const originY = event.clientY;
		const move = (e: PointerEvent): void => {
			const zoom = input.zoom() > 0 ? input.zoom() : 1;
			const { dx, dy } = toElementAxes(
				(e.clientX - originX) / zoom,
				(e.clientY - originY) / zoom,
				start.rotation,
			);
			input.applyLive(handle ? dragCropHandle(start, handle, dx, dy) : panCropImage(start, dx, dy));
		};
		const up = (): void => stop?.();
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
		stop = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			stop = null;
		};
	}

	onScopeDispose(() => stop?.());

	return { onPointerDown };
}
