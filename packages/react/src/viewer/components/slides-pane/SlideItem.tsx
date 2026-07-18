import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import React, { useCallback } from 'react';
import { LuEyeOff, LuMessageSquare } from 'react-icons/lu';

import { SLIDE_NAV_THUMBNAIL_WIDTH } from '../../constants';
import type { CanvasSize } from '../../types';
import { cn } from '../../utils';
import type { TableStyleContext } from '../../utils/table-band-style';
import type { FieldSubstitutionContext } from '../../utils/text-field-substitution';
import { LazyThumbnail } from './LazyThumbnail';
import { formatTimingMs } from './utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** A remote user viewing this slide (for presence dots). */
export interface SlidePresenceUser {
	userName: string;
	userColor: string;
}

export interface SlideItemProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	slideIndex: number;
	isActive: boolean;
	canvasSize: CanvasSize;
	canEdit: boolean;
	rehearsalTimings?: Record<number, number>;
	/** Remote users currently viewing this slide. */
	presenceUsers?: SlidePresenceUser[];
	/** Presentation-wide field context (date/header/footer/custom props). */
	fieldContext?: FieldSubstitutionContext;
	/** Theme + table style map for resolving table band/header colours. */
	tableStyleContext?: TableStyleContext;
	onSelectSlide: (index: number) => void;
	onSlideContextMenu: (e: React.MouseEvent, index: number) => void;
	onAddSection?: (name: string, afterSlideIndex: number) => void;
	onOpenSlideCtxMenu: (x: number, y: number, slideIndex: number) => void;
	onDragStart: (e: React.DragEvent, slideIndex: number) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent, toIndex: number) => void;
	slideRef: (el: HTMLButtonElement | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SlideItemInner({
	slide,
	templateElements,
	slideIndex,
	isActive,
	canvasSize,
	canEdit,
	rehearsalTimings,
	presenceUsers,
	fieldContext,
	tableStyleContext,
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
		<button
			type='button'
			ref={slideRef}
			aria-label={`Go to slide ${slideIndex + 1}`}
			aria-current={isActive ? 'true' : undefined}
			className={cn(
				'group relative flex w-full items-center gap-1 cursor-pointer border-0 bg-transparent py-0.5 px-1 text-left transition-all',
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
			{/* Slide number + presence dots: left of thumbnail */}
			<div className='flex flex-col items-center gap-0.5 w-5 shrink-0'>
				<span
					className={cn(
						'text-[10px] tabular-nums text-right select-none w-full',
						isActive ? 'text-primary font-medium' : 'text-muted-foreground',
					)}
				>
					{slideIndex + 1}
				</span>
				{presenceUsers && presenceUsers.length > 0 && (
					<div className='flex flex-wrap justify-center gap-px'>
						{presenceUsers.slice(0, 4).map((u, i) => (
							<span
								key={i}
								className='w-[6px] h-[6px] rounded-full'
								style={{ backgroundColor: u.userColor }}
								title={u.userName}
							/>
						))}
					</div>
				)}
			</div>

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
				<LazyThumbnail
					slide={slide}
					templateElements={templateElements}
					canvasSize={canvasSize}
					previewHeight={previewHeight}
					fieldContext={fieldContext}
					tableStyleContext={tableStyleContext}
				/>
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
		</button>
	);
}

/**
 * Memoized slide item to prevent unnecessary re-renders when other
 * slides change. The shallow comparison on props is sufficient because
 * the parent passes stable callbacks and only changes `isActive` for
 * the previously-active and newly-active slides.
 */
export const SlideItem = React.memo(SlideItemInner);
