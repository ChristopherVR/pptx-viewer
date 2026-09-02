import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuRotateCw } from 'react-icons/lu';

import type { ResizeHandle, ShapeAdjustmentHandleDescriptor } from '../../types';
import { cn } from '../../utils';
import { syncSelectionHandleOverlay } from '../../utils/selection-handle-overlay';

export interface ResizeHandlesProps {
	elementId: string;
	/**
	 * Every `a:avLst` handle the shape offers, not just the first: PowerPoint
	 * shows one amber diamond per adjustable parameter and presets routinely
	 * have several (`quadArrow` three, `callout3` four).
	 */
	adjustmentHandles: ShapeAdjustmentHandleDescriptor[];
	onResizePointerDown: (elementId: string, e: React.MouseEvent, handle: string) => void;
	onAdjustmentPointerDown: (
		elementId: string,
		e: React.MouseEvent,
		descriptor: ShapeAdjustmentHandleDescriptor,
	) => void;
	/** Whether to force pointerEvents: "auto" on buttons (needed inside pointer-events:none containers). */
	forcePointerEvents?: boolean;
	/** Current element rotation in degrees (the rotate-handle drag baseline). */
	rotation?: number;
	/** Element transform sans rotation (flips/skews); the live-preview base. */
	nonRotationTransform?: string;
	/** Commit a new rotation (degrees) for the element. Omit to hide the handle. */
	onRotate?: (elementId: string, rotationDeg: number) => void;
}

/**
 * Touch-action: none stops the browser from claiming touch gestures (scroll /
 * pinch-zoom) over a handle so a finger drag becomes a resize. Applied to every
 * handle button alongside the pointer-down wiring below.
 */
const HANDLE_TOUCH_ACTION = { touchAction: 'none' as const };

// Corner handle positions and cursors.
//
// The cursor and corner of each handle are the shared `RESIZE_HANDLE_GEOMETRY`
// contract; they are spelled out as literal Tailwind classes here rather than
// derived from it because Tailwind extracts class names statically, so a
// `cursor-${...}` template would be purged and the handle would show the
// default arrow. `ResizeHandles.test.tsx` asserts these literals still agree
// with the shared table, which is the part a refactor can silently break.
export const CORNER_HANDLES: {
	handle: ResizeHandle;
	posClass: string;
	cursor: string;
}[] = [
	{
		handle: 'nw',
		posClass: '-left-1.5 -top-1.5 max-md:-left-2.5 max-md:-top-2.5',
		cursor: 'cursor-nwse-resize',
	},
	{
		handle: 'ne',
		posClass: '-right-1.5 -top-1.5 max-md:-right-2.5 max-md:-top-2.5',
		cursor: 'cursor-nesw-resize',
	},
	{
		handle: 'sw',
		posClass: '-left-1.5 -bottom-1.5 max-md:-left-2.5 max-md:-bottom-2.5',
		cursor: 'cursor-nesw-resize',
	},
	{
		handle: 'se',
		posClass: '-right-1.5 -bottom-1.5 max-md:-right-2.5 max-md:-bottom-2.5',
		cursor: 'cursor-nwse-resize',
	},
];

// Edge midpoint handle positions and cursors (see CORNER_HANDLES on why the
// class names are literal).
export const EDGE_HANDLES: {
	handle: ResizeHandle;
	posClass: string;
	cursor: string;
	sizeClass: string;
}[] = [
	{
		handle: 'n',
		posClass: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
		cursor: 'cursor-ns-resize',
		sizeClass: 'w-5 h-2 max-md:w-8 max-md:h-3 rounded-sm',
	},
	{
		handle: 's',
		posClass: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
		cursor: 'cursor-ns-resize',
		sizeClass: 'w-5 h-2 max-md:w-8 max-md:h-3 rounded-sm',
	},
	{
		handle: 'e',
		posClass: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
		cursor: 'cursor-ew-resize',
		sizeClass: 'w-2 h-5 max-md:w-3 max-md:h-8 rounded-sm',
	},
	{
		handle: 'w',
		posClass: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
		cursor: 'cursor-ew-resize',
		sizeClass: 'w-2 h-5 max-md:w-3 max-md:h-8 rounded-sm',
	},
];

export function ResizeHandles({
	elementId,
	adjustmentHandles,
	onResizePointerDown,
	onAdjustmentPointerDown,
	forcePointerEvents,
	rotation,
	nonRotationTransform,
	onRotate,
}: ResizeHandlesProps) {
	const { t } = useTranslation();
	const peStyle = forcePointerEvents
		? { ...HANDLE_TOUCH_ACTION, pointerEvents: 'auto' as const }
		: HANDLE_TOUCH_ACTION;

	// Touch/pen presses start the resize via Pointer Events (mouse keeps using
	// onMouseDown so desktop behaviour is unchanged and never double-fires). The
	// pointer is captured so the gesture keeps tracking even if the finger drifts
	// off the small handle.
	const handleResizePointer = (e: React.PointerEvent, handle: string) => {
		if (e.pointerType === 'mouse') {
			return;
		}
		e.stopPropagation();
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		onResizePointerDown(elementId, e, handle);
	};

	// ── Rotate handle (self-contained) ───────────────────────────────────
	// Dragging the knob rotates the element about its centre. We compute the
	// absolute angle from the element centre to the pointer (so the gesture
	// is robust to the current rotation), preview live by mutating the wrapper
	// transform, then commit the final degrees on release. Shift snaps to 15°.
	const startRotate = (btn: HTMLElement, pointerId?: number): void => {
		// Resolve the REAL element node directly by id, not via `closest`: since
		// selection handles now live in a stage-level overlay that is a SIBLING of
		// `ElementRenderer` (not its parent), `data-element-id` is never an
		// ancestor of `btn` for a regular shape, so `closest` always landed on the
		// overlay host instead. Mutating the overlay's (invisible) transform live
		// rotated only the handles; the shape itself stayed frozen until the
		// `onRotate` commit on release. A connector still nests its handles
		// inside its own element, which also carries `data-element-id`, so the
		// direct lookup covers both cases uniformly.
		const wrapper = document.querySelector(
			`[data-element-id="${elementId}"]`,
		) as HTMLElement | null;
		if (!wrapper) {
			return;
		}
		const rect = wrapper.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		// Rotation must precede the flip/skew transforms so a live rotate-drag
		// preview matches the resting `getElementTransform` order (rotate first).
		const base = nonRotationTransform ? ` ${nonRotationTransform}` : '';
		const startDeg = rotation ?? 0;
		let last = startDeg;
		if (pointerId !== undefined) {
			btn.setPointerCapture?.(pointerId);
		}
		// Track via Pointer Events only; they fire for both mouse and touch,
		// matching the rest of the canvas (usePointerHandlers). A plain
		// `mousemove` listener would miss the touch drag entirely.
		const apply = (clientX: number, clientY: number, shift: boolean): void => {
			let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
			if (shift) {
				deg = Math.round(deg / 15) * 15;
			}
			deg = Math.round(((deg % 360) + 360) % 360);
			last = deg;
			const transform = `rotate(${deg}deg)${base}`;
			wrapper.style.transform = transform;
			syncSelectionHandleOverlay(elementId, { transform });
		};
		const onPointerMove = (ev: PointerEvent): void => apply(ev.clientX, ev.clientY, ev.shiftKey);
		const end = (): void => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
			if (last !== startDeg) {
				onRotate?.(elementId, last);
			}
		};
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
	};

	return (
		<>
			{/* Corner handles: circular dots */}
			{CORNER_HANDLES.map(({ handle, posClass, cursor }) => (
				<button
					key={handle}
					type='button'
					aria-label={t('pptx.selectionOverlay.resize', { handle })}
					className={cn('absolute z-10 group', posClass, cursor)}
					style={peStyle}
					onPointerDown={(e) => handleResizePointer(e, handle)}
					onMouseDown={(e) => {
						e.stopPropagation();
						onResizePointerDown(elementId, e, handle);
					}}
				>
					{/* Visible dot */}
					<div className='w-3 h-3 max-md:w-5.5 max-md:h-5.5 rounded-full border border-white bg-primary shadow' />
					{/* Invisible expanded hit area */}
					<div className='absolute -inset-1.5 max-md:-inset-1' />
				</button>
			))}

			{/* Edge midpoint handles: small rectangles */}
			{EDGE_HANDLES.map(({ handle, posClass, cursor, sizeClass }) => (
				<button
					key={handle}
					type='button'
					aria-label={t('pptx.selectionOverlay.resize', { handle })}
					className={cn('absolute z-10', posClass, cursor)}
					style={peStyle}
					onPointerDown={(e) => handleResizePointer(e, handle)}
					onMouseDown={(e) => {
						e.stopPropagation();
						onResizePointerDown(elementId, e, handle);
					}}
				>
					{/* Visible indicator */}
					<div className={cn(sizeClass, 'border border-white bg-primary shadow')} />
					{/* Invisible expanded hit area */}
					<div className='absolute -inset-2 max-md:-inset-1' />
				</button>
			))}

			{/* Rotate handle: knob straddling the top-centre edge. It overlaps the
			    element box (bottom half inside) so it stays reliably hit-testable;
			    children positioned entirely outside the box are not. An invisible
			    extension enlarges the finger target without moving the visual. */}
			{onRotate ? (
				<button
					type='button'
					aria-label={t('pptx.selectionOverlay.rotate')}
					data-pptx-compact
					className='absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-5 max-md:w-7 max-md:h-7 rounded-full border border-white bg-primary text-white shadow cursor-grab active:cursor-grabbing'
					style={peStyle}
					onPointerDown={(e) => {
						if (e.pointerType === 'mouse') {
							return;
						}
						e.stopPropagation();
						startRotate(e.currentTarget, e.pointerId);
					}}
					onMouseDown={(e) => {
						e.stopPropagation();
						startRotate(e.currentTarget);
					}}
				>
					<LuRotateCw className='w-3 h-3 max-md:w-4 max-md:h-4' />
					{/* Expanded invisible hit area (kept inside the element box). */}
					<span className='absolute -inset-2 max-md:-inset-1' aria-hidden='true' />
				</button>
			) : null}

			{/* Shape adjustment handles (yellow diamonds), one per `a:avLst` guide.
			    Every one carries the SAME accessible name: `playwright.config.ts`
			    lists `aria-label="Adjust shape"` as part of the framework-neutral
			    contract all five viewers emit. The offsets centre the 10px diamond
			    on the element-local point shared measured off the preset geometry. */}
			{adjustmentHandles.map((adjH) => (
				<button
					key={adjH.key}
					type='button'
					aria-label={t('pptx.canvas.adjustShape')}
					data-pptx-adjust-key={adjH.key}
					data-pptx-compact
					className='absolute h-2.5 w-2.5 max-md:h-4 max-md:w-4 rotate-45 border border-amber-700 bg-amber-300 shadow z-10'
					style={{
						left: adjH.left - 5,
						top: adjH.top - 5,
						cursor: adjH.cursor,
						...HANDLE_TOUCH_ACTION,
						...(forcePointerEvents ? { pointerEvents: 'auto' as const } : {}),
					}}
					onPointerDown={(e) => {
						if (e.pointerType === 'mouse') {
							return;
						}
						e.stopPropagation();
						(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
						onAdjustmentPointerDown(elementId, e, adjH);
					}}
					onMouseDown={(e) => {
						e.stopPropagation();
						onAdjustmentPointerDown(elementId, e, adjH);
					}}
				/>
			))}
		</>
	);
}
