import type { PresentationPointerTool } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface PresentationContextMenuState {
	x: number;
	y: number;
}

export interface PresentationContextMenuProps {
	state: PresentationContextMenuState;
	onNext: () => void;
	onPrevious: () => void;
	onEndShow: () => void;
	onClose: () => void;
	/** Open the All Slides navigator (PowerPoint's "See All Slides"). */
	onSeeAllSlides?: () => void;
	/** Switch to the presenter console. */
	onShowPresenterView?: () => void;
	/** Blank the screen black or white. */
	onBlank?: (value: 'black' | 'white') => void;
	/** Select a pointer tool (arrow = plain pointer). */
	onPointerTool?: (tool: PresentationPointerTool) => void;
	/** Erase this slide's ink annotations. */
	onEraseInk?: () => void;
}

const itemClass =
	'block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent';
const headingClass =
	'px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';

/**
 * Slide-show right-click menu, shown while presenting when Options > Advanced >
 * "Show menu on right mouse click" is on.
 *
 * Mirrors PowerPoint's slideshow menu: navigation, See All Slides, the presenter
 * console, pointer options and the blank-screen commands. These are the routes
 * PowerPoint users reach mid-show without remembering a chord, so the menu
 * carries everything the keyboard map does.
 */
export function PresentationContextMenu(p: PresentationContextMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const run = (action: () => void) => {
		action();
		p.onClose();
	};
	const item = (label: string, action: (() => void) | undefined) =>
		action ? (
			<button type='button' role='menuitem' className={itemClass} onClick={() => run(action)}>
				{label}
			</button>
		) : null;

	return (
		<>
			{/* Transparent backdrop: any press outside the menu dismisses it. */}
			<div
				className='fixed inset-0 z-[1299]'
				onClick={p.onClose}
				onContextMenu={(e) => {
					e.preventDefault();
					p.onClose();
				}}
			/>
			<div
				data-pptx-presentation-menu=''
				role='menu'
				tabIndex={-1}
				className='fixed z-[1300] min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-xl'
				style={{ left: p.state.x, top: p.state.y }}
				onContextMenu={(e) => e.preventDefault()}
			>
				{item(t('pptx.presenter.nextSlide'), p.onNext)}
				{item(t('pptx.presenter.previousSlide'), p.onPrevious)}
				{item(t('pptx.presenter.seeAllSlides'), p.onSeeAllSlides)}
				{item(t('pptx.presenter.presenterView'), p.onShowPresenterView)}

				{(p.onPointerTool || p.onEraseInk) && (
					<>
						<div className='my-1 border-t border-border/60' />
						<div className={headingClass}>{t('pptx.presentation.pointerTools')}</div>
						{item(
							t('pptx.presenter.pointerArrow'),
							p.onPointerTool && (() => p.onPointerTool?.('none')),
						)}
						{item(
							t('pptx.presenter.pointerPen'),
							p.onPointerTool && (() => p.onPointerTool?.('pen')),
						)}
						{item(
							t('pptx.presenter.pointerHighlighter'),
							p.onPointerTool && (() => p.onPointerTool?.('highlighter')),
						)}
						{item(
							t('pptx.presentation.laserPointer'),
							p.onPointerTool && (() => p.onPointerTool?.('laser')),
						)}
						{item(t('pptx.presenter.eraseAllInk'), p.onEraseInk)}
					</>
				)}

				{p.onBlank && (
					<>
						<div className='my-1 border-t border-border/60' />
						<div className={headingClass}>{t('pptx.presenter.screen')}</div>
						{item(t('pptx.presenter.blackScreen'), () => p.onBlank?.('black'))}
						{item(t('pptx.presenter.whiteScreen'), () => p.onBlank?.('white'))}
					</>
				)}

				<div className='my-1 border-t border-border/60' />
				{item(t('pptx.presenter.endPresentation'), p.onEndShow)}
			</div>
		</>
	);
}
