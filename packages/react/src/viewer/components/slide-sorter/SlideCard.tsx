import type { PptxSlide } from 'pptx-viewer-core';
import React from 'react';
import { LuEyeOff } from 'react-icons/lu';

import type { CanvasSize } from '../../types';
import { cn } from '../../utils';
import { SlideThumbnail } from '../SlideThumbnail';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideCardProps {
	slide: PptxSlide;
	index: number;
	isActive: boolean;
	isDragTarget: boolean;
	isSelected: boolean;
	selectedCount: number;
	selectionOrder: number;
	canvasSize: CanvasSize;
	canEdit: boolean;
	onSlideClick: (e: React.MouseEvent, index: number) => void;
	onDoubleClick: (index: number) => void;
	onContextMenu: (e: React.MouseEvent, index: number) => void;
	onDragStart: (e: React.DragEvent, index: number) => void;
	onDragOver: (e: React.DragEvent, index: number) => void;
	onDragLeave: () => void;
	onDrop: (e: React.DragEvent, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SlideCardImpl({
	slide,
	index,
	isActive,
	isDragTarget,
	isSelected,
	selectedCount,
	selectionOrder,
	canvasSize,
	canEdit,
	onSlideClick,
	onDoubleClick,
	onContextMenu,
	onDragStart,
	onDragOver,
	onDragLeave,
	onDrop,
}: SlideCardProps): React.ReactElement {
	return (
		<div
			className={cn(
				'group relative cursor-pointer rounded-lg border-2 p-1 transition-all',
				isDragTarget
					? 'border-primary bg-primary/20'
					: isSelected
						? 'border-primary bg-primary/10 ring-1 ring-primary/50'
						: isActive
							? 'border-primary/50 bg-primary/5'
							: 'border-border bg-background/50 hover:border-border',
				slide.hidden && 'opacity-40',
			)}
			onClick={(e) => onSlideClick(e, index)}
			onDoubleClick={() => onDoubleClick(index)}
			onContextMenu={(e) => onContextMenu(e, index)}
			draggable={canEdit}
			onDragStart={(e) => onDragStart(e, index)}
			onDragOver={(e) => onDragOver(e, index)}
			onDragLeave={onDragLeave}
			onDrop={(e) => onDrop(e, index)}
		>
			{/* Thumbnail */}
			<div className='aspect-video overflow-hidden rounded bg-white'>
				<SlideThumbnail slide={slide} templateElements={[]} canvasSize={canvasSize} />
			</div>

			{/* Slide number label */}
			<div className='mt-1 flex items-center justify-between px-0.5'>
				<span
					className={cn(
						'text-[11px] font-medium',
						isSelected ? 'text-primary' : isActive ? 'text-primary/70' : 'text-muted-foreground',
					)}
				>
					{index + 1}
				</span>
				{slide.hidden && <LuEyeOff className='h-3 w-3 text-muted-foreground' />}
			</div>

			{/* Selection checkmark */}
			{isSelected && selectedCount > 1 && (
				<div className='absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold'>
					{selectionOrder}
				</div>
			)}
		</div>
	);
}

/**
 * Memo comparator: skips re-renders when neither the slide identity, its
 * mutability flags, nor any of the selection/active/drag state changed.
 * Handlers are intentionally compared by reference — callers should pass
 * stable callbacks (useCallback) to keep this effective.
 */
function arePropsEqual(prev: SlideCardProps, next: SlideCardProps): boolean {
	if (prev.slide.id !== next.slide.id) {
		return false;
	}
	if (prev.slide.isDirty !== next.slide.isDirty) {
		return false;
	}
	if (prev.slide.hidden !== next.slide.hidden) {
		return false;
	}
	if (prev.slide.elements !== next.slide.elements) {
		return false;
	}
	if (prev.index !== next.index) {
		return false;
	}
	if (prev.isActive !== next.isActive) {
		return false;
	}
	if (prev.isDragTarget !== next.isDragTarget) {
		return false;
	}
	if (prev.isSelected !== next.isSelected) {
		return false;
	}
	if (prev.selectedCount !== next.selectedCount) {
		return false;
	}
	if (prev.selectionOrder !== next.selectionOrder) {
		return false;
	}
	if (prev.canEdit !== next.canEdit) {
		return false;
	}
	if (
		prev.canvasSize.width !== next.canvasSize.width ||
		prev.canvasSize.height !== next.canvasSize.height
	) {
		return false;
	}
	if (
		prev.onSlideClick !== next.onSlideClick ||
		prev.onDoubleClick !== next.onDoubleClick ||
		prev.onContextMenu !== next.onContextMenu ||
		prev.onDragStart !== next.onDragStart ||
		prev.onDragOver !== next.onDragOver ||
		prev.onDragLeave !== next.onDragLeave ||
		prev.onDrop !== next.onDrop
	) {
		return false;
	}
	return true;
}

export const SlideCard = React.memo(SlideCardImpl, arePropsEqual);
