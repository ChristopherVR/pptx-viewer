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
}

const itemClass =
	'block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent';

/**
 * Slide-show right-click menu (Next / Previous / End Show), shown while
 * presenting when Options > Advanced > "Show menu on right mouse click"
 * is on. Mirrors PowerPoint's minimal slideshow menu.
 */
export function PresentationContextMenu(p: PresentationContextMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const run = (action: () => void) => {
		action();
		p.onClose();
	};
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
				className='fixed z-[1300] min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-xl'
				style={{ left: p.state.x, top: p.state.y }}
				onContextMenu={(e) => e.preventDefault()}
			>
				<button type='button' role='menuitem' className={itemClass} onClick={() => run(p.onNext)}>
					{t('pptx.presenter.nextSlide')}
				</button>
				<button
					type='button'
					role='menuitem'
					className={itemClass}
					onClick={() => run(p.onPrevious)}
				>
					{t('pptx.presenter.previousSlide')}
				</button>
				<div className='my-1 border-t border-border/60' />
				<button
					type='button'
					role='menuitem'
					className={itemClass}
					onClick={() => run(p.onEndShow)}
				>
					{t('pptx.presenter.endPresentation')}
				</button>
			</div>
		</>
	);
}
