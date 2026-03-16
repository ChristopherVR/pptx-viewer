import React from 'react';

import type { ResizeHandle, ShapeAdjustmentHandleDescriptor } from '../../types';
import { cn } from '../../utils';

export interface ResizeHandlesProps {
	elementId: string;
	adjustmentHandleDescriptor: ShapeAdjustmentHandleDescriptor | null;
	onResizePointerDown: (elementId: string, e: React.MouseEvent, handle: string) => void;
	onAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
	/** Whether to force pointerEvents: "auto" on buttons (needed inside pointer-events:none containers). */
	forcePointerEvents?: boolean;
}

// Corner handle positions and cursors
const CORNER_HANDLES: {
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

// Edge midpoint handle positions and cursors
const EDGE_HANDLES: {
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
	adjustmentHandleDescriptor: adjH,
	onResizePointerDown,
	onAdjustmentPointerDown,
	forcePointerEvents,
}: ResizeHandlesProps) {
	const peStyle = forcePointerEvents ? { pointerEvents: 'auto' as const } : undefined;

	return (
		<>
			{/* Corner handles — circular dots */}
			{CORNER_HANDLES.map(({ handle, posClass, cursor }) => (
				<button
					key={handle}
					type='button'
					className={cn('absolute z-10 group', posClass, cursor)}
					style={peStyle}
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

			{/* Edge midpoint handles — small rectangles */}
			{EDGE_HANDLES.map(({ handle, posClass, cursor, sizeClass }) => (
				<button
					key={handle}
					type='button'
					className={cn('absolute z-10', posClass, cursor)}
					style={peStyle}
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

			{/* Shape adjustment handle (yellow diamond) */}
			{adjH ? (
				<button
					type='button'
					className='absolute h-2.5 w-2.5 max-md:h-4 max-md:w-4 rotate-45 border border-amber-700 bg-amber-300 shadow z-10'
					style={{
						left: adjH.left - 5,
						top: adjH.top,
						cursor: adjH.cursor,
						...(forcePointerEvents ? { pointerEvents: 'auto' as const } : {}),
					}}
					onMouseDown={(e) => {
						e.stopPropagation();
						onAdjustmentPointerDown(elementId, e);
					}}
				/>
			) : null}
		</>
	);
}
