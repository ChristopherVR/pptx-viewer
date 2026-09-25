import type { PptxElement } from 'pptx-viewer-core';
import type { EditPointsCommandId, EditPointsElementPatch } from 'pptx-viewer-shared';
import {
	attachOverlayKeyboard,
	EDIT_POINTS_STYLE,
	EDIT_POINTS_TARGET_ATTR,
	EditPointsSession,
	overlayPointerInput,
} from 'pptx-viewer-shared';
import React, { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { EditPointsMenu } from './EditPointsMenu';

export interface EditPointsOverlayProps {
	/** The shape whose points are being edited. */
	element: PptxElement;
	/** Stage size in slide pixels (the overlay's own coordinate space). */
	canvasSize: { width: number; height: number };
	/** Editor zoom, so handles stay the same size on screen. */
	scale: number;
	/** Menu commands the host hid. */
	hiddenCommands?: ReadonlySet<EditPointsCommandId>;
	/** Apply one edit (one undo step). */
	onCommit: (elementId: string, patch: EditPointsElementPatch) => void;
	/** Leave Edit Points mode. */
	onExit: () => void;
}

/**
 * PowerPoint's Edit Points mode for one shape.
 *
 * Everything that decides behaviour lives in the shared `EditPointsSession`
 * (hit targets, drags, the vertex / segment menu, keyboard, the element patch):
 * this component only draws its view descriptor as SVG over the stage, in the
 * stage's unscaled slide-pixel space, and forwards pointer events to it.
 */
export function EditPointsOverlay({
	element,
	canvasSize,
	scale,
	hiddenCommands,
	onCommit,
	onExit,
}: EditPointsOverlayProps): React.ReactElement {
	const { t } = useTranslation();
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	const svgRef = useRef<SVGSVGElement>(null);
	const latest = useRef({ onCommit, onExit });
	latest.current = { onCommit, onExit };

	const elementId = element.id;
	// One session per shape: the element object changes on every commit, which
	// the session absorbs through `reconcile` below.
	const sessionRef = useRef<{ id: string; session: EditPointsSession } | null>(null);
	if (sessionRef.current?.id !== elementId) {
		sessionRef.current = {
			id: elementId,
			session: new EditPointsSession(element, {
				onCommit: (patch) => latest.current.onCommit(elementId, patch),
				onExit: () => latest.current.onExit(),
				onChange: rerender,
				hiddenCommands,
			}),
		};
	}
	const session = sessionRef.current.session;

	useEffect(() => {
		session.reconcile(element);
	}, [element, session]);

	useEffect(() => attachOverlayKeyboard(session), [session]);

	const view = session.view(scale);
	const input = (event: React.PointerEvent | React.MouseEvent) =>
		overlayPointerInput(
			event.nativeEvent,
			svgRef.current ?? event.currentTarget,
			canvasSize.width,
			canvasSize.height,
		);

	const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
		event.stopPropagation();
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		session.pointerDown(input(event));
	};
	const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
		session.pointerMove(input(event));
	};
	const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
		event.currentTarget.releasePointerCapture?.(event.pointerId);
		session.pointerUp(input(event));
	};
	const onContextMenu = (event: React.MouseEvent<SVGSVGElement>) => {
		event.preventDefault();
		event.stopPropagation();
		session.contextMenu(input(event));
	};
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	const target = (id: string) => ({ [EDIT_POINTS_TARGET_ATTR]: id });

	return (
		<>
			{/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a pointer-driven editing surface; the keyboard is routed through attachOverlayKeyboard */}
			<svg
				ref={svgRef}
				className='absolute left-0 top-0 z-[60]'
				width={canvasSize.width}
				height={canvasSize.height}
				role='application'
				aria-label={t('pptx.editPoints.overlay')}
				data-pptx-edit-points-overlay='true'
				data-pptx-edit-points-element={elementId}
				style={{ touchAction: 'none' }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onContextMenu={onContextMenu}
				onMouseDown={stop}
				onClick={stop}
				onDoubleClick={stop}
			>
				<rect width={canvasSize.width} height={canvasSize.height} fill='transparent' />
				{view.segments.map((seg) => (
					<path
						key={seg.target}
						d={seg.d}
						fill='none'
						stroke='transparent'
						strokeWidth={view.hitStrokeWidth}
						pointerEvents='stroke'
						style={{ cursor: 'copy' }}
						{...target(seg.target)}
					/>
				))}
				<path
					d={view.outlineD}
					fill='none'
					stroke={EDIT_POINTS_STYLE.outlineColor}
					strokeWidth={view.outlineWidth}
					pointerEvents='none'
				/>
				{view.handles.map((h) => (
					<g key={h.target}>
						<line
							x1={h.anchorX}
							y1={h.anchorY}
							x2={h.x}
							y2={h.y}
							stroke={EDIT_POINTS_STYLE.handleLineColor}
							strokeWidth={view.outlineWidth}
							pointerEvents='none'
						/>
						<rect
							x={h.x - h.size / 2}
							y={h.y - h.size / 2}
							width={h.size}
							height={h.size}
							fill={EDIT_POINTS_STYLE.handleFill}
							stroke={EDIT_POINTS_STYLE.handleStroke}
							strokeWidth={view.outlineWidth}
							style={{ cursor: 'move' }}
							{...target(h.target)}
						/>
					</g>
				))}
				{view.nodes.map((n) => (
					<rect
						key={n.target}
						x={n.x - n.size / 2}
						y={n.y - n.size / 2}
						width={n.size}
						height={n.size}
						fill={n.selected ? EDIT_POINTS_STYLE.selectedNodeFill : EDIT_POINTS_STYLE.nodeFill}
						stroke={
							n.selected ? EDIT_POINTS_STYLE.selectedNodeStroke : EDIT_POINTS_STYLE.nodeStroke
						}
						strokeWidth={view.outlineWidth}
						style={{ cursor: 'move' }}
						data-pptx-edit-points-node-type={n.type}
						data-selected={n.selected ? 'true' : undefined}
						{...target(n.target)}
					/>
				))}
			</svg>
			{view.menu && <EditPointsMenu menu={view.menu} onRun={(id) => session.runCommand(id)} />}
		</>
	);
}
