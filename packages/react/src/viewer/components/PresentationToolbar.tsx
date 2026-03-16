/**
 * PresentationToolbar
 *
 * Floating bottom toolbar shown during presentation mode.
 * Contains: prev/next navigation, slide counter (X/Y), elapsed timer,
 * annotation tool toggles (laser/pen/highlighter/eraser), and an
 * end-presentation button.
 *
 * Auto-hides after 3 seconds of no mouse movement. Re-appears when
 * the mouse moves near the bottom of the screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuPenTool,
	LuHighlighter,
	LuEraser,
	LuTrash2,
	LuMousePointer2,
	LuChevronLeft,
	LuChevronRight,
	LuChevronDown,
	LuTimer,
	LuX,
	LuPanelRight,
} from 'react-icons/lu';

import type { PresentationTool } from '../hooks/usePresentationAnnotations';
import {
	AUTO_HIDE_DELAY_MS,
	isInBottomTriggerZone,
	formatSlideCounter,
} from './presentation-toolbar-utils';
import { formatElapsed } from './presenter-view-utils';

// ---------------------------------------------------------------------------
// Color picker presets
// ---------------------------------------------------------------------------

const PEN_COLORS = [
	'#ff0000',
	'#0000ff',
	'#00aa00',
	'#ff8800',
	'#ffffff',
	'#000000',
	'#ff00ff',
	'#00cccc',
];

const HIGHLIGHTER_COLORS = [
	'#ffff00',
	'#00ff00',
	'#ff69b4',
	'#00bfff',
	'#ff8c00',
	'#adff2f',
	'#ff6347',
	'#87ceeb',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationToolbarProps {
	/** Current annotation tool. */
	presentationTool: PresentationTool;
	penColor: string;
	highlighterColor: string;
	hasAnnotations: boolean;
	onSetTool: (tool: PresentationTool) => void;
	onSetPenColor: (color: string) => void;
	onSetHighlighterColor: (color: string) => void;
	onClearAnnotations: () => void;

	// --- Navigation props ---
	/** Zero-based index of the current presentation slide. */
	currentSlideIndex: number;
	/** Total number of slides in the presentation. */
	totalSlides: number;
	/** Navigate to next (1) or previous (-1) slide. */
	onMovePresentationSlide: (direction: 1 | -1) => void;
	/** Timestamp (ms) when the presentation started. */
	presentationStartTime: number | null;
	/** End the current presentation. */
	onEndPresentation: () => void;
	/** Toggle presenter view (split-screen with notes). */
	onTogglePresenterView?: () => void;
	/** Whether presenter view is currently active. */
	presenterMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationToolbar({
	presentationTool,
	penColor,
	highlighterColor,
	hasAnnotations,
	onSetTool,
	onSetPenColor,
	onSetHighlighterColor,
	onClearAnnotations,
	currentSlideIndex,
	totalSlides,
	onMovePresentationSlide,
	presentationStartTime,
	onEndPresentation,
	onTogglePresenterView,
	presenterMode,
}: PresentationToolbarProps): React.ReactElement {
	const { t } = useTranslation();
	const [showPenColors, setShowPenColors] = useState(false);
	const [showHighlighterColors, setShowHighlighterColors] = useState(false);
	const toolbarRef = useRef<HTMLDivElement>(null);

	// -- Elapsed timer ----------------------------------------------------------
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		if (!presentationStartTime) {
			return;
		}
		const interval = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(interval);
	}, [presentationStartTime]);

	const elapsed = presentationStartTime ? now - presentationStartTime : 0;

	// -- Close color pickers when clicking outside ------------------------------
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
				setShowPenColors(false);
				setShowHighlighterColors(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	const handleToolClick = useCallback(
		(tool: PresentationTool) => {
			onSetTool(tool);
			setShowPenColors(false);
			setShowHighlighterColors(false);
		},
		[onSetTool],
	);

	const handlePenRightClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setShowPenColors((prev) => !prev);
		setShowHighlighterColors(false);
	}, []);

	const handleHighlighterRightClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setShowHighlighterColors((prev) => !prev);
		setShowPenColors(false);
	}, []);

	const toolBtnClass = (tool: PresentationTool): string =>
		`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
			presentationTool === tool
				? 'bg-white/25 text-white'
				: 'text-white/70 hover:text-white hover:bg-white/10'
		}`;

	const navBtnClass =
		'flex items-center justify-center w-9 h-9 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed';

	return (
		<div
			ref={toolbarRef}
			className='flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-900/90 backdrop-blur-md border border-white/15 shadow-2xl'
			onClick={(e) => e.stopPropagation()}
		>
			{/* Previous slide */}
			<button
				type='button'
				className={navBtnClass}
				onClick={() => onMovePresentationSlide(-1)}
				disabled={currentSlideIndex === 0}
				title={t('pptx.presenter.previousSlide')}
				aria-label={t('pptx.presenter.previousSlide')}
			>
				<LuChevronLeft size={18} />
			</button>

			{/* Slide counter */}
			<span className='text-xs font-mono tabular-nums text-white/80 px-1.5 select-none min-w-[48px] text-center'>
				{formatSlideCounter(currentSlideIndex, totalSlides)}
			</span>

			{/* Next slide */}
			<button
				type='button'
				className={navBtnClass}
				onClick={() => onMovePresentationSlide(1)}
				disabled={currentSlideIndex >= totalSlides - 1}
				title={t('pptx.presenter.nextSlide')}
				aria-label={t('pptx.presenter.nextSlide')}
			>
				<LuChevronRight size={18} />
			</button>

			{/* Divider */}
			<div className='w-px h-6 bg-white/20 mx-1' />

			{/* Elapsed timer */}
			<div
				className='flex items-center gap-1.5 text-xs font-mono tabular-nums text-white/60 px-1 select-none'
				title={t('pptx.presenter.elapsed')}
			>
				<LuTimer size={14} />
				<span>{formatElapsed(elapsed)}</span>
			</div>

			{/* Divider */}
			<div className='w-px h-6 bg-white/20 mx-1' />

			{/* Laser pointer */}
			<button
				type='button'
				className={toolBtnClass('laser')}
				onClick={() => handleToolClick('laser')}
				title={t('pptx.presentation.laserPointer')}
			>
				<LuMousePointer2 size={18} />
			</button>

			{/* Pen + color dropdown */}
			<div className='relative flex items-center'>
				<button
					type='button'
					className={toolBtnClass('pen')}
					onClick={() => handleToolClick('pen')}
					onContextMenu={handlePenRightClick}
					title={t('pptx.presentation.pen')}
				>
					<LuPenTool size={18} />
					<div
						className='absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full'
						style={{ backgroundColor: penColor }}
					/>
				</button>
				<button
					type='button'
					className='flex items-center justify-center w-7 h-9 -ml-1 rounded-r-md transition-colors text-white/50 hover:text-white hover:bg-white/10'
					onClick={() => {
						setShowPenColors((prev) => !prev);
						setShowHighlighterColors(false);
					}}
					title={`${t('pptx.presentation.pen')} — color`}
				>
					<LuChevronDown size={12} />
				</button>
				{showPenColors && (
					<div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-neutral-800 rounded-lg border border-white/20 shadow-xl grid grid-cols-4 gap-2'>
						{PEN_COLORS.map((color) => (
							<button
								key={color}
								type='button'
								className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
									penColor === color ? 'border-white' : 'border-white/20'
								}`}
								style={{ backgroundColor: color }}
								onClick={() => {
									onSetPenColor(color);
									setShowPenColors(false);
									if (presentationTool !== 'pen') {
										onSetTool('pen');
									}
								}}
							/>
						))}
					</div>
				)}
			</div>

			{/* Highlighter + color dropdown */}
			<div className='relative flex items-center'>
				<button
					type='button'
					className={toolBtnClass('highlighter')}
					onClick={() => handleToolClick('highlighter')}
					onContextMenu={handleHighlighterRightClick}
					title={t('pptx.presentation.highlighter')}
				>
					<LuHighlighter size={18} />
					<div
						className='absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full'
						style={{ backgroundColor: highlighterColor }}
					/>
				</button>
				<button
					type='button'
					className='flex items-center justify-center w-7 h-9 -ml-1 rounded-r-md transition-colors text-white/50 hover:text-white hover:bg-white/10'
					onClick={() => {
						setShowHighlighterColors((prev) => !prev);
						setShowPenColors(false);
					}}
					title={`${t('pptx.presentation.highlighter')} — color`}
				>
					<LuChevronDown size={12} />
				</button>
				{showHighlighterColors && (
					<div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-neutral-800 rounded-lg border border-white/20 shadow-xl grid grid-cols-4 gap-2'>
						{HIGHLIGHTER_COLORS.map((color) => (
							<button
								key={color}
								type='button'
								className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
									highlighterColor === color ? 'border-white' : 'border-white/20'
								}`}
								style={{ backgroundColor: color }}
								onClick={() => {
									onSetHighlighterColor(color);
									setShowHighlighterColors(false);
									if (presentationTool !== 'highlighter') {
										onSetTool('highlighter');
									}
								}}
							/>
						))}
					</div>
				)}
			</div>

			{/* Eraser */}
			<button
				type='button'
				className={toolBtnClass('eraser')}
				onClick={() => handleToolClick('eraser')}
				title={t('pptx.presentation.eraser')}
			>
				<LuEraser size={18} />
			</button>

			{/* Clear all */}
			<button
				type='button'
				className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
					hasAnnotations
						? 'text-white/70 hover:text-red-400 hover:bg-white/10'
						: 'text-white/30 cursor-not-allowed'
				}`}
				onClick={hasAnnotations ? onClearAnnotations : undefined}
				title={t('pptx.presentation.clearAnnotations')}
				disabled={!hasAnnotations}
			>
				<LuTrash2 size={18} />
			</button>

			{/* Divider */}
			<div className='w-px h-6 bg-white/20 mx-1' />

			{/* Presenter view toggle */}
			{onTogglePresenterView && (
				<button
					type='button'
					className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
						presenterMode
							? 'bg-white/25 text-white'
							: 'text-white/70 hover:text-white hover:bg-white/10'
					}`}
					onClick={onTogglePresenterView}
					title={t('pptx.presenter.presenterView', { defaultValue: 'Presenter view (N)' })}
					aria-label={t('pptx.presenter.presenterView', { defaultValue: 'Presenter view' })}
				>
					<LuPanelRight size={18} />
				</button>
			)}

			{/* End presentation */}
			<button
				type='button'
				className='flex items-center justify-center w-9 h-9 rounded-md transition-colors text-white/70 hover:text-red-400 hover:bg-white/10'
				onClick={onEndPresentation}
				title={t('pptx.presenter.endPresentation')}
				aria-label={t('pptx.presenter.endPresentation')}
			>
				<LuX size={18} />
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Auto-hide wrapper — renders PresentationToolbar with show/hide behavior.
// ---------------------------------------------------------------------------

export interface PresentationToolbarWrapperProps extends PresentationToolbarProps {
	/** Ref to the container element used for bottom-zone hit testing. */
	containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Wraps `PresentationToolbar` with auto-hide logic:
 * - Shows on any mouse movement
 * - Hides after `AUTO_HIDE_DELAY_MS` (3 s) of no movement
 * - Always shows when hovering over the toolbar itself
 * - Uses CSS opacity transitions for smooth fade in/out
 */
export function PresentationToolbarWrapper({
	containerRef,
	...toolbarProps
}: PresentationToolbarWrapperProps): React.ReactElement {
	const [visible, setVisible] = useState(false);
	const hideTimerRef = useRef<number | null>(null);
	const hoveringRef = useRef(false);

	const clearHideTimer = useCallback(() => {
		if (hideTimerRef.current !== null) {
			window.clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
	}, []);

	const resetHideTimer = useCallback(() => {
		clearHideTimer();
		hideTimerRef.current = window.setTimeout(() => {
			if (!hoveringRef.current) {
				setVisible(false);
			}
		}, AUTO_HIDE_DELAY_MS);
	}, [clearHideTimer]);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			const container = containerRef?.current;
			if (container) {
				const rect = container.getBoundingClientRect();
				if (isInBottomTriggerZone(e.clientY, rect.height, rect.top)) {
					setVisible(true);
					resetHideTimer();
					return;
				}
			}

			// Any movement shows the toolbar, then starts auto-hide countdown
			setVisible(true);
			resetHideTimer();
		};

		document.addEventListener('mousemove', handleMouseMove);
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			clearHideTimer();
		};
	}, [containerRef, resetHideTimer, clearHideTimer]);

	const handleMouseEnter = useCallback(() => {
		hoveringRef.current = true;
		clearHideTimer();
		setVisible(true);
	}, [clearHideTimer]);

	const handleMouseLeave = useCallback(() => {
		hoveringRef.current = false;
		resetHideTimer();
	}, [resetHideTimer]);

	return (
		<div
			className='absolute bottom-6 left-1/2 -translate-x-1/2 z-[80] transition-opacity duration-300'
			style={{
				opacity: visible ? 1 : 0,
				pointerEvents: visible ? 'auto' : 'none',
			}}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<PresentationToolbar {...toolbarProps} />
		</div>
	);
}
