import type { ResizeHandle } from '../../types';

// Keep Tailwind classes literal so its static extractor retains them. The
// existing ResizeHandles tests compare these presentation classes against the
// shared RESIZE_HANDLE_GEOMETRY contract, which owns positions and cursors.
export const CORNER_HANDLES: {
	handle: ResizeHandle;
	posClass: string;
	cursor: string;
}[] = [
	{
		handle: 'nw',
		posClass: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 max-md:left-px max-md:top-px',
		cursor: 'cursor-nwse-resize',
	},
	{
		handle: 'ne',
		posClass: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 max-md:right-px max-md:top-px',
		cursor: 'cursor-nesw-resize',
	},
	{
		handle: 'sw',
		posClass: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 max-md:left-px max-md:bottom-px',
		cursor: 'cursor-nesw-resize',
	},
	{
		handle: 'se',
		posClass: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 max-md:right-px max-md:bottom-px',
		cursor: 'cursor-nwse-resize',
	},
];

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
