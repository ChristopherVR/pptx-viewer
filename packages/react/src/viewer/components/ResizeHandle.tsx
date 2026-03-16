/**
 * ResizeHandle — A draggable edge handle for resizing panels.
 *
 * Renders a thin interactive strip along one edge of a panel that can
 * be dragged to resize. Uses pointer events for mouse + touch support.
 */
import React, { useCallback, useRef } from 'react';

import { cn } from '../utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResizeDirection = 'horizontal' | 'vertical';

export interface ResizeHandleProps {
	/** Whether the drag resizes horizontally (left/right) or vertically (up/down). */
	direction: ResizeDirection;
	/** Called continuously during drag with the delta in pixels. */
	onResize: (delta: number) => void;
	/** Called when the drag ends. */
	onResizeEnd?: () => void;
	/** Extra class names for the handle. */
	className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResizeHandle({
	direction,
	onResize,
	onResizeEnd,
	className,
}: ResizeHandleProps): React.ReactElement {
	const startPos = useRef(0);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const target = e.currentTarget as HTMLElement;
			target.setPointerCapture(e.pointerId);
			startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

			const handlePointerMove = (ev: PointerEvent) => {
				const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
				const delta = current - startPos.current;
				startPos.current = current;
				onResize(delta);
			};

			const handlePointerUp = () => {
				target.removeEventListener('pointermove', handlePointerMove);
				target.removeEventListener('pointerup', handlePointerUp);
				target.removeEventListener('pointercancel', handlePointerUp);
				onResizeEnd?.();
			};

			target.addEventListener('pointermove', handlePointerMove);
			target.addEventListener('pointerup', handlePointerUp);
			target.addEventListener('pointercancel', handlePointerUp);
		},
		[direction, onResize, onResizeEnd],
	);

	return (
		<div
			role='separator'
			aria-orientation={direction}
			className={cn(
				// Outer container: generous hit area for easy clicking.
				// The visible indicator is rendered via the inner pseudo-element (::after).
				'relative flex-shrink-0 z-20 group',
				direction === 'horizontal' ? 'w-3 cursor-col-resize -mx-1' : 'h-3 cursor-row-resize -my-1',
				className,
			)}
			onPointerDown={handlePointerDown}
		>
			{/* Visible thin line — centered within the wider hit area */}
			<div
				className={cn(
					'absolute transition-colors',
					direction === 'horizontal'
						? 'top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 group-hover:w-1 group-hover:bg-primary/40 group-active:w-1 group-active:bg-primary/60'
						: 'left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 group-hover:h-1 group-hover:bg-primary/40 group-active:h-1 group-active:bg-primary/60',
				)}
			/>
		</div>
	);
}
