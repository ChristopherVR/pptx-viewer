/**
 * SVG overlay for drawing ink strokes on the slide canvas.
 */
import type { InkStrokeView } from 'pptx-viewer-shared';
import React from 'react';

import type { CanvasSize } from '../../types';
import type { DrawingTool } from '../../types-ui';
import { renderStrokeView } from '../elements/InkGroupRenderers';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DrawingOverlaySvgProps {
	canvasSize: CanvasSize;
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	isStrokeActive: boolean;
	liveStrokeD: string;
	/**
	 * The in-progress stroke's render view (plain path, pressure circles, or
	 * tilt nib marks), from `useDrawingOverlay`'s `buildLiveInkStrokeView`
	 * call. When present, it takes over from `liveStrokeD` so the preview shows
	 * the same calligraphic lean / variable width a committed stroke would.
	 */
	liveStrokeView: InkStrokeView | null;
	onPointerDown: (e: React.PointerEvent) => void;
	onPointerMove: (e: React.PointerEvent) => void;
	onPointerUp: (e: React.PointerEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DrawingOverlaySvg({
	canvasSize,
	activeTool,
	drawingColor,
	drawingWidth,
	isStrokeActive,
	liveStrokeD,
	liveStrokeView,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}: DrawingOverlaySvgProps) {
	return (
		<svg
			className='absolute inset-0 z-[60]'
			style={{
				width: canvasSize.width,
				height: canvasSize.height,
				cursor: 'crosshair',
				touchAction: 'none',
			}}
			viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			{/*
				Live stroke preview: rendered from the same `InkStrokeView` decision
				(plain path / pressure circles / tilt nib marks) a committed stroke
				gets, so a calligraphic lean or pressure-variable width shows up
				while the pointer is still down. Falls back to the plain
				`liveStrokeD` path only when there is a path but no decided view yet
				(defensive; `liveStrokeView` is built from the same points).
			*/}
			{isStrokeActive && liveStrokeView
				? renderStrokeView(liveStrokeView, true, undefined, 'ink-live-preview')
				: isStrokeActive &&
					liveStrokeD && (
						<path
							d={liveStrokeD}
							fill='none'
							stroke={drawingColor}
							strokeWidth={drawingWidth}
							strokeOpacity={activeTool === 'highlighter' ? 0.4 : 1}
							strokeLinecap='round'
							strokeLinejoin='round'
						/>
					)}
		</svg>
	);
}
