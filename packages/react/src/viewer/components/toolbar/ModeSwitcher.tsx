import React from 'react';

import { PresentDropdown } from './PresentDropdown';
import type { ToolbarProps } from './toolbar-types';

export type ModeSwitcherProps = Pick<
	ToolbarProps,
	| 'mode'
	| 'onSetMode'
	| 'onCloseMasterView'
	| 'onToggleSlideSorter'
	| 'onEnterPresenterView'
	| 'onEnterRehearsalMode'
	| 'onOpenSetUpSlideShow'
	| 'onOpenBroadcastDialog'
	| 'onToggleSubtitles'
	| 'showSubtitles'
>;

export function ModeSwitcher({
	mode,
	onSetMode,
	onCloseMasterView,
	onEnterPresenterView,
	onEnterRehearsalMode,
	onOpenSetUpSlideShow,
	onOpenBroadcastDialog,
	onToggleSubtitles,
	showSubtitles,
}: ModeSwitcherProps): React.ReactElement {
	if (mode === 'master') {
		return (
			<div className='inline-flex items-center gap-1.5'>
				<span className='inline-flex items-center px-2 py-0.5 rounded-sm bg-amber-600/90 text-[10px] text-amber-50'>
					Master View
				</span>
				<button
					type='button'
					onClick={onCloseMasterView}
					className='px-2 py-0.5 rounded-sm hover:bg-accent text-[10px] text-foreground transition-colors'
					title='Close master view'
				>
					Close
				</button>
			</div>
		);
	}

	// Present dropdown only — view mode buttons moved to status bar
	return (
		<PresentDropdown
			isActive={mode === 'present'}
			onPresent={() => onSetMode('present')}
			onPresenterView={onEnterPresenterView}
			onRehearse={onEnterRehearsalMode}
			onSetUpSlideShow={onOpenSetUpSlideShow}
			onBroadcast={onOpenBroadcastDialog}
			onToggleSubtitles={onToggleSubtitles}
			showSubtitles={showSubtitles}
		/>
	);
}
