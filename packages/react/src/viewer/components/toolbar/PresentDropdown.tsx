import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuCaptions,
	LuCheck,
	LuChevronDown,
	LuClock,
	LuMonitor,
	LuPlay,
	LuRadio,
	LuSettings,
} from 'react-icons/lu';

import { cn } from '../../utils';

export interface PresentDropdownProps {
	isActive: boolean;
	onPresent: () => void;
	onPresenterView?: () => void;
	onRehearse?: () => void;
	onSetUpSlideShow?: () => void;
	onBroadcast?: () => void;
	onToggleSubtitles?: () => void;
	showSubtitles?: boolean;
}

export function PresentDropdown({
	isActive,
	onPresent,
	onPresenterView,
	onRehearse,
	onSetUpSlideShow,
	onBroadcast,
	onToggleSubtitles,
	showSubtitles,
}: PresentDropdownProps): React.ReactElement {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	return (
		<div className='relative'>
			<div className='inline-flex items-stretch rounded border border-border bg-muted text-xs overflow-hidden'>
				<button
					type='button'
					onClick={onPresent}
					className={cn(
						'px-2 py-1 transition-colors',
						isActive ? 'bg-primary text-white' : 'hover:bg-accent text-foreground',
					)}
					title={t('pptx.present.presentTooltip')}
				>
					{t('pptx.toolbar.present')}
				</button>
				<button
					type='button'
					onClick={() => setOpen((prev) => !prev)}
					className={cn(
						'inline-flex items-center px-1 transition-colors border-l border-border',
						open ? 'bg-primary text-white' : 'hover:bg-accent text-foreground',
					)}
					title={t('pptx.present.optionsTooltip')}
					aria-label={t('pptx.present.optionsTooltip')}
				>
					<LuChevronDown className='w-3 h-3' />
				</button>
			</div>
			{open && (
				<>
					<button
						type='button'
						className='fixed inset-0 z-40'
						aria-label={t('pptx.overflow.closeMenu')}
						onClick={() => setOpen(false)}
					/>
					<div className='absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
						<button
							type='button'
							onClick={() => {
								setOpen(false);
								onPresent();
							}}
							className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
						>
							<LuPlay className='w-3.5 h-3.5 text-muted-foreground' />
							{t('pptx.toolbar.present')}
						</button>
						{onPresenterView && (
							<button
								type='button'
								onClick={() => {
									setOpen(false);
									onPresenterView();
								}}
								className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
							>
								<LuMonitor className='w-3.5 h-3.5 text-muted-foreground' />
								{t('pptx.slideShow.presenterView')}
							</button>
						)}
						{onRehearse && (
							<button
								type='button'
								onClick={() => {
									setOpen(false);
									onRehearse();
								}}
								className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
							>
								<LuClock className='w-3.5 h-3.5 text-muted-foreground' />
								{t('pptx.slideShow.rehearseTimings')}
							</button>
						)}
						{/* Slide Show settings divider */}
						<div className='my-1 border-t border-border/60' />
						{onSetUpSlideShow && (
							<button
								type='button'
								onClick={() => {
									setOpen(false);
									onSetUpSlideShow();
								}}
								className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
							>
								<LuSettings className='w-3.5 h-3.5 text-muted-foreground' />
								{t('pptx.slideShow.setUp')}
							</button>
						)}
						{onBroadcast && (
							<button
								type='button'
								onClick={() => {
									setOpen(false);
									onBroadcast();
								}}
								className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
							>
								<LuRadio className='w-3.5 h-3.5 text-muted-foreground' />
								{t('pptx.present.presentOnline')}
							</button>
						)}
						{onToggleSubtitles && (
							<button
								type='button'
								onClick={() => {
									setOpen(false);
									onToggleSubtitles();
								}}
								className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
							>
								<LuCaptions className='w-3.5 h-3.5 text-muted-foreground' />
								<span className='flex-1 text-left'>Subtitles</span>
								{showSubtitles && <LuCheck className='w-3 h-3 text-primary' />}
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}
