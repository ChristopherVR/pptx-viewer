/**
 * PresentationToolbar
 *
 * Floating bottom toolbar shown during presentation mode.
 * Contains: prev/next navigation, slide counter (X/Y), elapsed timer,
 * annotation tool toggles (laser/pen/highlighter/eraser), and an
 * end-presentation button.
 *
 * Auto-hide behaviour lives in `PresentationToolbarWrapper.tsx`.
 */
import {
	HIGHLIGHTER_COLORS,
	isBlackboardActive,
	PEN_COLORS,
	PRESENT_TOOLBAR_CLASSES,
} from 'pptx-viewer-shared';
import type { PresentationBlackout } from 'pptx-viewer-shared';
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
	LuPresentation,
	LuTimer,
	LuX,
	LuPanelRight,
} from 'react-icons/lu';

import type { PresentationTool } from '../hooks/usePresentationAnnotations';
import { formatSlideCounter } from './presentation-toolbar-utils';
import { formatElapsed } from './presenter-view-utils';

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
	/** Current blackout state, for the Blackboard toggle's active reading. */
	blackout: PresentationBlackout;
	/** One click arms (or disarms) the black screen and the pen together. */
	onToggleBlackboard: () => void;

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
	blackout,
	onToggleBlackboard,
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
		presentationTool === tool
			? PRESENT_TOOLBAR_CLASSES.toggleActive
			: PRESENT_TOOLBAR_CLASSES.toggle;

	const navBtnClass = PRESENT_TOOLBAR_CLASSES.button;

	return (
		<div
			ref={toolbarRef}
			data-pptx-present-toolbar
			role='toolbar'
			// Named so a screen reader announces the bar rather than a run of
			// anonymous buttons. Focusable only programmatically: a running show
			// keeps keyboard focus on the stage, where PowerPoint's navigation keys
			// are bound, so the bar must not sit in the tab order.
			tabIndex={-1}
			aria-label={t('pptx.toolbar.presentationToolbarAria')}
			className={PRESENT_TOOLBAR_CLASSES.container}
			onClick={(e) => e.stopPropagation()}
		>
			{/* Previous slide */}
			<button
				type='button'
				data-pptx-present-control='previous'
				className={navBtnClass}
				onClick={() => onMovePresentationSlide(-1)}
				disabled={currentSlideIndex === 0}
				title={t('pptx.presenter.previousSlide')}
				aria-label={t('pptx.presenter.previousSlide')}
			>
				<LuChevronLeft size={18} />
			</button>

			{/* Slide counter */}
			<span data-pptx-present-control='counter' className={PRESENT_TOOLBAR_CLASSES.counter}>
				{formatSlideCounter(currentSlideIndex, totalSlides)}
			</span>

			{/* Next slide */}
			<button
				type='button'
				data-pptx-present-control='next'
				className={navBtnClass}
				onClick={() => onMovePresentationSlide(1)}
				disabled={currentSlideIndex >= totalSlides - 1}
				title={t('pptx.presenter.nextSlide')}
				aria-label={t('pptx.presenter.nextSlide')}
			>
				<LuChevronRight size={18} />
			</button>

			{/* Divider */}
			<div
				data-pptx-present-control='divider-navigation'
				className={PRESENT_TOOLBAR_CLASSES.divider}
			/>

			{/* Elapsed timer */}
			<div
				data-pptx-present-control='timer'
				className={PRESENT_TOOLBAR_CLASSES.timer}
				title={t('pptx.presenter.elapsed')}
				aria-label={t('pptx.presenter.elapsed')}
			>
				<LuTimer size={14} />
				<span>{formatElapsed(elapsed)}</span>
			</div>

			{/* Divider */}
			<div data-pptx-present-control='divider-timer' className={PRESENT_TOOLBAR_CLASSES.divider} />

			{/* Laser pointer */}
			<button
				type='button'
				data-pptx-present-control='laser'
				className={toolBtnClass('laser')}
				onClick={() => handleToolClick('laser')}
				title={t('pptx.presentation.laserPointer')}
				aria-label={t('pptx.presentation.laserPointer')}
			>
				<LuMousePointer2 size={18} />
			</button>

			{/* Pen + color dropdown */}
			<div className='relative flex items-center'>
				<button
					type='button'
					data-pptx-present-control='pen'
					className={toolBtnClass('pen')}
					onClick={() => handleToolClick('pen')}
					onContextMenu={handlePenRightClick}
					title={t('pptx.presentation.pen')}
					aria-label={t('pptx.presentation.pen')}
				>
					<LuPenTool size={18} />
					<div
						className={PRESENT_TOOLBAR_CLASSES.swatchBar}
						style={{ backgroundColor: penColor }}
					/>
				</button>
				<button
					type='button'
					data-pptx-present-control='pen-color'
					className={PRESENT_TOOLBAR_CLASSES.caret}
					onClick={() => {
						setShowPenColors((prev) => !prev);
						setShowHighlighterColors(false);
					}}
					title={t('pptx.presentationToolbar.penColor')}
					aria-label={t('pptx.presentationToolbar.penColor')}
				>
					<LuChevronDown size={12} />
				</button>
				{showPenColors && (
					<div className={PRESENT_TOOLBAR_CLASSES.palette}>
						{PEN_COLORS.map((color) => (
							<button
								key={color}
								type='button'
								aria-label={t('pptx.presentationToolbar.penColorValue', { color })}
								className={`${PRESENT_TOOLBAR_CLASSES.swatch} ${
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
					data-pptx-present-control='highlighter'
					className={toolBtnClass('highlighter')}
					onClick={() => handleToolClick('highlighter')}
					onContextMenu={handleHighlighterRightClick}
					title={t('pptx.presentation.highlighter')}
					aria-label={t('pptx.presentation.highlighter')}
				>
					<LuHighlighter size={18} />
					<div
						className={PRESENT_TOOLBAR_CLASSES.swatchBar}
						style={{ backgroundColor: highlighterColor }}
					/>
				</button>
				<button
					type='button'
					data-pptx-present-control='highlighter-color'
					className={PRESENT_TOOLBAR_CLASSES.caret}
					onClick={() => {
						setShowHighlighterColors((prev) => !prev);
						setShowPenColors(false);
					}}
					title={t('pptx.presentationToolbar.highlighterColor')}
					aria-label={t('pptx.presentationToolbar.highlighterColor')}
				>
					<LuChevronDown size={12} />
				</button>
				{showHighlighterColors && (
					<div className={PRESENT_TOOLBAR_CLASSES.palette}>
						{HIGHLIGHTER_COLORS.map((color) => (
							<button
								key={color}
								type='button'
								aria-label={t('pptx.presentationToolbar.highlighterColorValue', { color })}
								className={`${PRESENT_TOOLBAR_CLASSES.swatch} ${
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
				data-pptx-present-control='eraser'
				className={toolBtnClass('eraser')}
				onClick={() => handleToolClick('eraser')}
				title={t('pptx.presentation.eraser')}
				aria-label={t('pptx.presentation.eraser')}
			>
				<LuEraser size={18} />
			</button>

			{/* Blackboard: black screen + pen, armed and disarmed as a pair */}
			<button
				type='button'
				data-pptx-present-control='blackboard'
				className={
					isBlackboardActive(blackout, presentationTool)
						? PRESENT_TOOLBAR_CLASSES.toggleActive
						: PRESENT_TOOLBAR_CLASSES.toggle
				}
				onClick={onToggleBlackboard}
				title={t('pptx.presentation.blackboard')}
				aria-label={t('pptx.presentation.blackboard')}
			>
				<LuPresentation size={18} />
			</button>

			{/* Clear all */}
			<button
				type='button'
				data-pptx-present-control='clear'
				className={`${PRESENT_TOOLBAR_CLASSES.button} ${
					hasAnnotations ? 'hover:text-red-400' : ''
				}`}
				onClick={hasAnnotations ? onClearAnnotations : undefined}
				title={t('pptx.presentation.clearAnnotations')}
				aria-label={t('pptx.presentation.clearAnnotations')}
				disabled={!hasAnnotations}
			>
				<LuTrash2 size={18} />
			</button>

			{/* Divider */}
			<div data-pptx-present-control='divider-tools' className={PRESENT_TOOLBAR_CLASSES.divider} />

			{/* Presenter view toggle */}
			{onTogglePresenterView && (
				<button
					type='button'
					data-pptx-present-control='presenter-view'
					className={
						presenterMode ? PRESENT_TOOLBAR_CLASSES.toggleActive : PRESENT_TOOLBAR_CLASSES.toggle
					}
					onClick={onTogglePresenterView}
					title={t('pptx.presenter.presenterView')}
					aria-label={t('pptx.presenter.presenterView')}
				>
					<LuPanelRight size={18} />
				</button>
			)}

			{/* End presentation */}
			<button
				type='button'
				data-pptx-present-control='end'
				className={`${PRESENT_TOOLBAR_CLASSES.button} hover:text-red-400`}
				onClick={onEndPresentation}
				title={t('pptx.presenter.endPresentation')}
				aria-label={t('pptx.presenter.endPresentation')}
			>
				<LuX size={18} />
			</button>
		</div>
	);
}
