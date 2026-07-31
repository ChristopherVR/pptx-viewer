import type { PptxElement } from 'pptx-viewer-core';
import {
	isEditableMotionPath,
	motionPathEndPixel,
	motionPathToSvgD,
	setMotionPathEnd,
} from 'pptx-viewer-shared';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface MotionPathOverlayProps {
	/** Element the path is anchored to; its centre is the path origin. */
	element: PptxElement;
	/** OOXML path data (slide fractions, relative to the element centre). */
	path: string;
	/** Stage size in slide pixels: the unit the path fractions scale by. */
	canvasSize: { width: number; height: number };
	/** Editor zoom, so a pointer delta converts back to slide pixels. */
	scale: number;
	/** Whether the end handle can be dragged. */
	canEdit: boolean;
	/** Commit an edited path (drag of the end handle). */
	onChangePath?: (path: string) => void;
}

/**
 * Draws the selected element's motion path on the stage and lets the user drag
 * its end point.
 *
 * WHY it is a stage-level sibling and not part of the element's own adorners: a
 * motion path routinely extends far outside the shape's bounding box, and the
 * element wrapper carries the shape's rotation / flip transform, which would
 * skew the path. Drawn here it shares the stage's unscaled slide-pixel space,
 * so the only zoom maths needed is converting the pointer delta back by
 * `scale`.
 */
export function MotionPathOverlay({
	element,
	path,
	canvasSize,
	scale,
	canEdit,
	onChangePath,
}: MotionPathOverlayProps): React.ReactElement | null {
	const { t } = useTranslation();
	const dragRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

	const frame = {
		originX: element.x + element.width / 2,
		originY: element.y + element.height / 2,
		slideWidth: canvasSize.width,
		slideHeight: canvasSize.height,
	};
	const d = motionPathToSvgD(path, frame);
	const end = motionPathEndPixel(path, frame);
	const editable = canEdit && Boolean(onChangePath) && isEditableMotionPath(path);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<SVGCircleElement>) => {
			if (!editable) {
				return;
			}
			event.stopPropagation();
			event.preventDefault();
			event.currentTarget.setPointerCapture(event.pointerId);
			dragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
			};
		},
		[editable],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<SVGCircleElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId || !onChangePath) {
				return;
			}
			event.stopPropagation();
			const dxPx = (event.clientX - drag.startX) / (scale || 1);
			const dyPx = (event.clientY - drag.startY) / (scale || 1);
			const nextX = (end.x + dxPx - frame.originX) / frame.slideWidth;
			const nextY = (end.y + dyPx - frame.originY) / frame.slideHeight;
			const next = setMotionPathEnd(path, nextX, nextY);
			if (next !== path) {
				dragRef.current = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
				};
				onChangePath(next);
			}
		},
		[
			end.x,
			end.y,
			frame.originX,
			frame.originY,
			frame.slideWidth,
			frame.slideHeight,
			onChangePath,
			path,
			scale,
		],
	);

	const handlePointerUp = useCallback((event: React.PointerEvent<SVGCircleElement>) => {
		if (dragRef.current?.pointerId === event.pointerId) {
			event.currentTarget.releasePointerCapture(event.pointerId);
			dragRef.current = null;
		}
	}, []);

	if (!d) {
		return null;
	}

	return (
		<svg
			className='pointer-events-none absolute left-0 top-0 z-[45]'
			width={canvasSize.width}
			height={canvasSize.height}
			role='img'
			aria-label={t('pptx.animation.motionPath.overlay')}
			data-pptx-motion-path-overlay='true'
		>
			<path
				d={d}
				fill='none'
				stroke='#0ea5e9'
				strokeWidth={2}
				strokeDasharray='6 4'
				vectorEffect='non-scaling-stroke'
			/>
			<circle cx={frame.originX} cy={frame.originY} r={5} fill='#0ea5e9' opacity={0.55} />
			<circle
				cx={end.x}
				cy={end.y}
				r={7}
				fill='#ffffff'
				stroke='#0ea5e9'
				strokeWidth={2}
				className={editable ? 'pointer-events-auto cursor-move' : ''}
				aria-label={t('pptx.animation.motionPath.endHandle')}
				data-pptx-motion-path-handle='end'
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			/>
		</svg>
	);
}
