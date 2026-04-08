import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuColumns2,
	LuMinus,
	LuMonitor,
	LuPlus,
	LuPresentation,
	LuStickyNote,
} from 'react-icons/lu';

import type { AutosaveStatus } from '../hooks/useAutosave';
import { cn } from '../utils';

export interface StatusBarProps {
	slideCount: number;
	activeSlideIndex: number;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	/** Current zoom scale (0-1+ range, e.g. 1.0 = 100%). */
	scale?: number;
	/** Callback to zoom in. */
	onZoomIn?: () => void;
	/** Callback to zoom out. */
	onZoomOut?: () => void;
	/** Callback to zoom to fit. */
	onZoomToFit?: () => void;
	/** Whether the notes panel is expanded. */
	isNotesExpanded?: boolean;
	/** Toggle the notes panel. */
	onToggleNotes?: () => void;
	/** Current viewer mode. */
	mode?: string;
	/** Callback to switch viewer mode. */
	onSetMode?: (mode: 'edit' | 'present') => void;
	/** Callback to toggle slide sorter view. */
	onToggleSlideSorter?: () => void;
	/** Optional collaboration status indicator rendered inline. */
	collaborationSlot?: React.ReactNode;
}

function formatAutosaveAge(
	timestamp: number,
	t: (key: string, opts?: Record<string, unknown>) => string,
): string {
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) {
		return t('pptx.autosave.justNow');
	}
	if (minutes === 1) {
		return t('pptx.autosave.oneMinAgo');
	}
	return t('pptx.autosave.minutesAgo', { count: minutes });
}

export function StatusBar({
	slideCount,
	activeSlideIndex,
	isDirty,
	autosaveStatus,
	scale,
	onZoomIn,
	onZoomOut,
	onZoomToFit,
	isNotesExpanded,
	onToggleNotes,
	mode,
	onSetMode,
	onToggleSlideSorter,
	collaborationSlot,
}: StatusBarProps): React.ReactElement {
	const { t } = useTranslation();

	// Build the autosave status text
	let statusText: string;
	if (autosaveStatus?.state === 'saving') {
		statusText = t('pptx.autosave.saving');
	} else if (autosaveStatus?.state === 'saved') {
		statusText = t('pptx.autosave.saved', {
			time: formatAutosaveAge(autosaveStatus.timestamp, t),
		});
	} else if (autosaveStatus?.state === 'error') {
		statusText = t('pptx.autosave.error');
	} else if (isDirty) {
		statusText = t('pptx.statusBar.unsavedChanges');
	} else {
		statusText = t('pptx.statusBar.allSaved');
	}

	const vb =
		'p-1 rounded-sm transition-colors hover:bg-accent/60 text-muted-foreground active:scale-95 active:opacity-80';

	return (
		<div className='w-full px-2 py-0.5 border-t border-border bg-secondary/50 text-[10px] text-muted-foreground flex items-center gap-1'>
			{/* Left section: Slide counter + autosave status */}
			<span className='shrink-0'>
				{slideCount > 0
					? t('pptx.statusBar.slideOf', {
							current: Math.min(activeSlideIndex + 1, slideCount),
							total: slideCount,
						})
					: t('pptx.statusBar.noSlides')}
			</span>

			<div className='w-px h-3 bg-border/40 mx-1 max-md:hidden' />

			<span className='shrink-0 max-md:hidden text-[10px]'>{t('pptx.statusBar.language')}</span>

			<div className='w-px h-3 bg-border/60 mx-1 max-md:hidden' />

			<span
				className={cn(
					'shrink-0 max-md:hidden',
					autosaveStatus?.state === 'error'
						? 'text-red-400'
						: autosaveStatus?.state === 'saving'
							? 'text-yellow-400'
							: '',
				)}
			>
				{statusText}
			</span>

			{/* Center spacer */}
			<div className='flex-1' />

			{/* Notes toggle */}
			{onToggleNotes && (
				<button
					type='button'
					onClick={onToggleNotes}
					className={cn(
						vb,
						'flex items-center gap-1 text-[10px]',
						isNotesExpanded && 'text-primary',
					)}
					title={t('pptx.statusBar.toggleNotes')}
					aria-label={t('pptx.statusBar.toggleNotes')}
				>
					<LuStickyNote className='w-3 h-3' />
					<span className='max-md:hidden'>{t('pptx.notes.title')}</span>
				</button>
			)}

			<div className='w-px h-3 bg-border/60 mx-0.5' />

			{/* View mode buttons */}
			{onSetMode && (
				<div className='flex items-center gap-0.5'>
					<button
						type='button'
						onClick={() => onSetMode('edit')}
						className={cn(vb, mode === 'edit' && 'text-primary')}
						title={t('pptx.statusBar.normalView')}
						aria-label={t('pptx.statusBar.normalView')}
					>
						<LuMonitor className='w-3.5 h-3.5' />
					</button>
					{onToggleSlideSorter && (
						<button
							type='button'
							onClick={onToggleSlideSorter}
							className={vb}
							title={t('pptx.statusBar.slideSorter')}
							aria-label={t('pptx.statusBar.slideSorter')}
						>
							<LuColumns2 className='w-3.5 h-3.5' />
						</button>
					)}
					<button
						type='button'
						onClick={() => onSetMode('present')}
						className={cn(vb, mode === 'present' && 'text-primary')}
						title={t('pptx.statusBar.slideShow')}
						aria-label={t('pptx.statusBar.slideShow')}
					>
						<LuPresentation className='w-3.5 h-3.5' />
					</button>
				</div>
			)}

			{/* Collaboration status */}
			{collaborationSlot && (
				<>
					<div className='w-px h-3 bg-border/40 mx-0.5' />
					{collaborationSlot}
				</>
			)}

			{/* Zoom controls */}
			{scale !== undefined && (
				<>
					<div className='w-px h-3 bg-border/60 mx-0.5' />
					<div className='flex items-center gap-0.5'>
						{onZoomOut && (
							<button
								type='button'
								onClick={onZoomOut}
								className={vb}
								title={t('pptx.statusBar.zoomOut')}
								aria-label={t('pptx.statusBar.zoomOut')}
							>
								<LuMinus className='w-3 h-3' />
							</button>
						)}
						<button
							type='button'
							onClick={onZoomToFit}
							className='px-1.5 py-0.5 rounded-sm hover:bg-accent/60 text-[10px] text-muted-foreground tabular-nums min-w-[3rem] text-center transition-colors'
							title={t('pptx.statusBar.zoomToFit')}
						>
							{Math.round((scale ?? 1) * 100)}%
						</button>
						{onZoomIn && (
							<button
								type='button'
								onClick={onZoomIn}
								className={vb}
								title={t('pptx.statusBar.zoomIn')}
								aria-label={t('pptx.statusBar.zoomIn')}
							>
								<LuPlus className='w-3 h-3' />
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}
