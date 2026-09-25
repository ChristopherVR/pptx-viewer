import type { PptxElement } from 'pptx-viewer-core';
import type { CropDragStart, CropElementUpdate, CropHandleId } from 'pptx-viewer-shared';
import {
	beginCropDrag,
	buildCropOverlay,
	CROP_HANDLE_ARIA_KEY,
	dragCropHandle,
	panCropImage,
	toElementAxes,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { imgSrc } from '../elements/ImageRenderer';

export interface PictureCropOverlayProps {
	/** The picture in crop mode, as it is right now (live). */
	element: PptxElement;
	/** Stage zoom (1 = 100%): pointer deltas are divided by it. */
	scale: number;
	onUpdate: (update: CropElementUpdate) => void;
	/** Right-click still opens the picture's context menu. */
	onContextMenu?: (elementId: string, e: React.MouseEvent) => void;
}

interface ActiveDrag {
	start: CropDragStart;
	handle: CropHandleId | null;
	clientX: number;
	clientY: number;
}

/** Keep a canvas gesture on the overlay from reaching the stage's handlers. */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * On-canvas crop mode for one picture: the dimmed cropped-away image (the
 * pan target), the crop frame and PowerPoint's eight black crop handles.
 *
 * Every shape here comes from the shared `buildCropOverlay` descriptor and
 * every drag from the shared crop geometry; this component only positions the
 * descriptor over the picture (same box, same rotation) and turns pointer
 * deltas into slide pixels in the picture's own axes.
 */
export function PictureCropOverlay({
	element,
	scale,
	onUpdate,
	onContextMenu,
}: PictureCropOverlayProps): React.ReactElement {
	const { t } = useTranslation();
	const overlay = buildCropOverlay(element, scale);
	const dragRef = useRef<ActiveDrag | null>(null);
	const latest = useRef({ scale, onUpdate });
	latest.current = { scale, onUpdate };
	const detachRef = useRef<(() => void) | null>(null);
	useEffect(() => () => detachRef.current?.(), []);

	const beginDrag = (e: React.PointerEvent, handle: CropHandleId | null) => {
		if (e.button !== 0) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		detachRef.current?.();
		dragRef.current = {
			start: beginCropDrag(element),
			handle,
			clientX: e.clientX,
			clientY: e.clientY,
		};
		const onMove = (ev: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) {
				return;
			}
			const zoom = latest.current.scale || 1;
			const { dx, dy } = toElementAxes(
				(ev.clientX - drag.clientX) / zoom,
				(ev.clientY - drag.clientY) / zoom,
				drag.start.rotation,
			);
			latest.current.onUpdate(
				drag.handle
					? dragCropHandle(drag.start, drag.handle, dx, dy)
					: panCropImage(drag.start, dx, dy),
			);
		};
		const onUp = () => detachRef.current?.();
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		detachRef.current = () => {
			dragRef.current = null;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			detachRef.current = null;
		};
	};

	const { ghost, frame, handles } = overlay;
	const src = imgSrc(element);
	return (
		<div
			data-pptx-crop-overlay='true'
			data-pptx-crop-for={element.id}
			data-export-ignore='true'
			style={{
				position: 'absolute',
				left: element.x,
				top: element.y,
				width: element.width,
				height: element.height,
				transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
				transformOrigin: 'center',
				overflow: 'visible',
				zIndex: 59,
				touchAction: 'none',
			}}
			onMouseDown={stop}
			onClick={stop}
			onDoubleClick={stop}
			onContextMenu={(e) => {
				e.stopPropagation();
				onContextMenu?.(element.id, e);
			}}
		>
			<div
				data-pptx-crop-ghost='true'
				style={{
					position: 'absolute',
					left: ghost.left,
					top: ghost.top,
					width: ghost.width,
					height: ghost.height,
					clipPath: ghost.clipPath,
					opacity: ghost.opacity,
					cursor: 'move',
				}}
				onPointerDown={(e) => beginDrag(e, null)}
			>
				{src && (
					<img
						src={src}
						alt=''
						draggable={false}
						style={{
							display: 'block',
							width: '100%',
							height: '100%',
							transform: ghost.transform || undefined,
							pointerEvents: 'none',
							userSelect: 'none',
						}}
					/>
				)}
			</div>
			<div
				data-pptx-crop-frame='true'
				style={{
					position: 'absolute',
					left: frame.left,
					top: frame.top,
					width: frame.width,
					height: frame.height,
					boxSizing: 'border-box',
					border: `${1 / (scale || 1)}px solid rgba(0, 0, 0, 0.75)`,
					outline: `${1 / (scale || 1)}px dashed rgba(255, 255, 255, 0.9)`,
					cursor: 'move',
				}}
				onPointerDown={(e) => beginDrag(e, null)}
			/>
			{handles.map((handle) => (
				<div
					key={handle.id}
					role='button'
					tabIndex={-1}
					aria-label={t(CROP_HANDLE_ARIA_KEY)}
					data-pptx-crop-handle={handle.id}
					style={{
						position: 'absolute',
						left: handle.left,
						top: handle.top,
						width: handle.width,
						height: handle.height,
						cursor: handle.cursor,
					}}
					onPointerDown={(e) => beginDrag(e, handle.id)}
				>
					<svg
						width='100%'
						height='100%'
						viewBox={`0 0 ${handle.width} ${handle.height}`}
						overflow='visible'
						aria-hidden='true'
						style={{ display: 'block' }}
					>
						<path d={handle.path} fill='#000' stroke='#fff' strokeWidth={1 / (scale || 1)} />
					</svg>
				</div>
			))}
		</div>
	);
}
