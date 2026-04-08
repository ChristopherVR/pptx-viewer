import type { PptxSlide } from 'pptx-viewer-core';
import React, { useCallback } from 'react';
import { LuEyeOff, LuMessageSquare } from 'react-icons/lu';

import { SLIDE_NAV_THUMBNAIL_WIDTH } from '../../constants';
import type { CanvasSize } from '../../types';
import { cn } from '../../utils';
import { LazyThumbnail } from './LazyThumbnail';
import { formatTimingMs } from './utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlideItemProps {
	slide: PptxSlide;
	slideIndex: number;
	isActive: boolean;
	canvasSize: CanvasSize;
	canEdit: boolean;
	rehearsalTimings?: Record<number, number>;
	onSelectSlide: (index: number) => void;
	onSlideContextMenu: (e: React.MouseEvent, index: number) => void;
	onAddSection?: (name: string, afterSlideIndex: number) => void;
	onOpenSlideCtxMenu: (x: number, y: number, slideIndex: number) => void;
	onDragStart: (e: React.DragEvent, slideIndex: number) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent, toIndex: number) => void;
	slideRef: (el: HTMLDivElement | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SlideItemInner({
	slide,
	slideIndex,
	isActive,
	canvasSize,
	canEdit,
	rehearsalTimings,
	onSelectSlide,
	onSlideContextMenu,
	onAddSection,
	onOpenSlideCtxMenu,
	onDragStart,
	onDragOver,
	onDrop,
	slideRef,
}: SlideItemProps): React.ReactElement {
	const isHidden = Boolean(slide.hidden);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (canEdit && onAddSection) {
				e.preventDefault();
				e.stopPropagation();
				onOpenSlideCtxMenu(e.clientX, e.clientY, slideIndex);
			} else {
				onSlideContextMenu(e, slideIndex);
			}
		},
		[canEdit, onAddSection, onOpenSlideCtxMenu, onSlideContextMenu, slideIndex],
	);

	// Pre-compute the thumbnail height for the placeholder
	const safeCanvasWidth = Math.max(canvasSize.width, 1);
	const safeCanvasHeight = Math.max(canvasSize.height, 1);
	const scale = SLIDE_NAV_THUMBNAIL_WIDTH / safeCanvasWidth;
	const previewHeight = Math.max(56, Math.round(safeCanvasHeight * scale));

	return (
		<div
			ref={slideRef}
			className={cn(
				'group relative flex items-center gap-1 cursor-pointer py-0.5 px-1 transition-all',
				isActive &&
					'bg-accent/40 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-primary before:rounded-r',
				isHidden && 'opacity-50',
			)}
			draggable={canEdit}
			onClick={() => onSelectSlide(slideIndex)}
			onContextMenu={handleContextMenu}
			onDragStart={(e) => onDragStart(e, slideIndex)}
			onDragOver={onDragOver}
			onDrop={(e) => onDrop(e, slideIndex)}
		>
			{/* Slide number — left of thumbnail */}
			<span
				className={cn(
					'text-[10px] tabular-nums w-5 text-right shrink-0 select-none',
					isActive ? 'text-primary font-medium' : 'text-muted-foreground',
				)}
			>
				{slideIndex + 1}
			</span>

			{/* Thumbnail */}
			<div
				className={cn(
					'relative flex-1 overflow-hidden border transition-colors bg-white',
					isActive ? 'border-primary/60' : 'border-transparent group-hover:border-border/40',
				)}
			>
				{/* Hidden-slide indicator stripe */}
				{isHidden && (
					<div className='absolute inset-0 pointer-events-none z-10 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(255,255,255,0.04)_4px,rgba(255,255,255,0.04)_8px)]' />
				)}
				<LazyThumbnail slide={slide} canvasSize={canvasSize} previewHeight={previewHeight} />
				{(slide.comments?.length ?? 0) > 0 && (
					<div className='absolute top-0.5 right-0.5 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[8px] font-medium text-white leading-none z-10'>
						<LuMessageSquare className='w-2 h-2' />
						{slide.comments?.length}
					</div>
				)}
				{isHidden && (
					<div className='absolute bottom-0.5 right-0.5 z-10'>
						<LuEyeOff className='w-3 h-3 text-muted-foreground' />
					</div>
				)}
				{rehearsalTimings && typeof rehearsalTimings[slideIndex] === 'number' && (
					<div className='absolute bottom-0.5 left-0.5 z-10'>
						<span className='text-[8px] font-mono text-amber-400/80 tabular-nums bg-black/50 px-0.5 rounded'>
							{formatTimingMs(rehearsalTimings[slideIndex])}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * Memoized slide item to prevent unnecessary re-renders when other
 * slides change. The shallow comparison on props is sufficient because
 * the parent passes stable callbacks and only changes `isActive` for
 * the previously-active and newly-active slides.
 */
export const SlideItem = React.memo(SlideItemInner);
