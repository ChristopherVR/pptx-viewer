import type { ShapePptxElement } from 'pptx-viewer-core';
import type { FreeformToolKind } from 'pptx-viewer-shared';
import { attachOverlayKeyboard, clientToSlidePoint, FreeformToolSession } from 'pptx-viewer-shared';
import React, { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface FreeformToolOverlayProps {
	/** The armed tool: Freeform: Shape or Curve. */
	tool: FreeformToolKind;
	canvasSize: { width: number; height: number };
	scale: number;
	/** Insert the finished shape (the tool then disarms). */
	onCommit: (element: ShapePptxElement) => void;
	/** The gesture ended without a shape; disarm. */
	onCancel: () => void;
}

/**
 * The capture layer of the click-to-place Freeform: Shape and Curve tools.
 * The gesture itself (corners, freehand runs, smooth spans, closing on the
 * start point, double-click / Enter / Escape) is the shared
 * `FreeformToolSession`; this only paints its preview and forwards events.
 */
export function FreeformToolOverlay({
	tool,
	canvasSize,
	scale,
	onCommit,
	onCancel,
}: FreeformToolOverlayProps): React.ReactElement {
	const { t } = useTranslation();
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	const svgRef = useRef<SVGSVGElement>(null);
	const latest = useRef({ onCommit, onCancel });
	latest.current = { onCommit, onCancel };

	const sessionRef = useRef<FreeformToolSession | null>(null);
	if (sessionRef.current?.tool !== tool) {
		sessionRef.current = new FreeformToolSession({
			tool,
			onCommit: (element) => latest.current.onCommit(element),
			onCancel: () => latest.current.onCancel(),
			onChange: rerender,
		});
	}
	const session = sessionRef.current;
	session.setScale(scale);

	useEffect(() => attachOverlayKeyboard(session), [session]);

	const point = (event: React.PointerEvent | React.MouseEvent) =>
		clientToSlidePoint(
			svgRef.current ?? event.currentTarget,
			event.clientX,
			event.clientY,
			canvasSize.width,
			canvasSize.height,
		);
	const view = session.view();
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a pointer-driven drawing surface; the keyboard is routed through attachOverlayKeyboard
		<svg
			ref={svgRef}
			className='absolute left-0 top-0 z-[60]'
			width={canvasSize.width}
			height={canvasSize.height}
			role='application'
			aria-label={t('pptx.freeformTool.overlay')}
			data-pptx-freeform-tool-overlay={tool}
			style={{ cursor: 'crosshair', touchAction: 'none' }}
			onPointerDown={(event) => {
				event.stopPropagation();
				event.preventDefault();
				event.currentTarget.setPointerCapture?.(event.pointerId);
				session.pointerDown({ ...point(event), button: event.button });
			}}
			onPointerMove={(event) => session.pointerMove(point(event))}
			onPointerUp={(event) => {
				event.currentTarget.releasePointerCapture?.(event.pointerId);
				session.pointerUp();
			}}
			onDoubleClick={(event) => {
				event.stopPropagation();
				session.doubleClick();
			}}
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onMouseDown={stop}
			onClick={stop}
		>
			<rect width={canvasSize.width} height={canvasSize.height} fill='transparent' />
			{view.previewD && (
				<path
					d={view.previewD}
					fill='none'
					stroke='#2f528f'
					strokeWidth={view.strokeWidth}
					pointerEvents='none'
				/>
			)}
			{view.start && (
				<circle
					cx={view.start.x}
					cy={view.start.y}
					r={view.start.size / 2}
					fill={view.start.armed ? '#2f528f' : '#ffffff'}
					stroke='#2f528f'
					strokeWidth={view.strokeWidth}
					pointerEvents='none'
					data-pptx-freeform-start={view.start.armed ? 'armed' : 'idle'}
				/>
			)}
		</svg>
	);
}
