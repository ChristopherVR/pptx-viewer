import {
	appendPresentationInkPoint,
	erasePresentationInkAt,
	movePresenterPointer,
} from 'pptx-viewer-shared';
import type { PresentationInkStroke, PresentationSnapshot } from 'pptx-viewer-shared';
import { useCallback, useRef } from 'react';

export function usePresenterInk(
	snapshot: PresentationSnapshot,
	onUpdate: (patch: Partial<PresentationSnapshot>) => void,
) {
	const drawingId = useRef<string | null>(null);
	const point = (event: React.PointerEvent<HTMLElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: (event.clientX - rect.left) / rect.width,
			y: (event.clientY - rect.top) / rect.height,
		};
	};
	const onPointerDown = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const pointer = snapshot.pointer;
			if (!pointer || pointer.tool === 'none' || pointer.tool === 'laser') {
				return;
			}
			const nextPoint = point(event);
			if (pointer.tool === 'eraser') {
				onUpdate({
					inkStrokes: erasePresentationInkAt(
						snapshot.inkStrokes ?? [],
						snapshot.slideIndex,
						nextPoint,
					),
				});
				return;
			}
			event.currentTarget.setPointerCapture(event.pointerId);
			const stroke: PresentationInkStroke = {
				id: crypto.randomUUID(),
				slideIndex: snapshot.slideIndex,
				tool: pointer.tool,
				color: pointer.color,
				width: pointer.tool === 'highlighter' ? 12 : 4,
				points: [nextPoint],
			};
			drawingId.current = stroke.id;
			onUpdate({ inkStrokes: [...(snapshot.inkStrokes ?? []), stroke] });
		},
		[onUpdate, snapshot],
	);
	const onPointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const nextPoint = point(event);
			const pointer = snapshot.pointer;
			if (!pointer) {
				return;
			}
			if (pointer.tool === 'laser') {
				onUpdate({ pointer: movePresenterPointer(pointer, nextPoint.x, nextPoint.y) });
			}
			if (pointer.tool === 'eraser' && event.buttons === 1) {
				onUpdate({
					inkStrokes: erasePresentationInkAt(
						snapshot.inkStrokes ?? [],
						snapshot.slideIndex,
						nextPoint,
					),
				});
			}
			if (drawingId.current && event.buttons === 1) {
				onUpdate({
					inkStrokes: (snapshot.inkStrokes ?? []).map((stroke) =>
						stroke.id === drawingId.current
							? appendPresentationInkPoint(stroke, nextPoint)
							: stroke,
					),
				});
			}
		},
		[onUpdate, snapshot],
	);
	const onPointerUp = useCallback(() => {
		drawingId.current = null;
	}, []);
	return { onPointerDown, onPointerMove, onPointerUp };
}
