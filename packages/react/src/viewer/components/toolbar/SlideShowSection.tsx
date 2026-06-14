import React from 'react';
import { LuCaptions, LuCast, LuClock, LuMonitor, LuPlay, LuSettings } from 'react-icons/lu';

import type { ViewerMode } from '../../types';
import { cn } from '../../utils';
import { ic, pill, sep } from './toolbar-constants';

export interface SlideShowSectionProps {
	onPresent: () => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSetUpSlideShow: () => void;
	onOpenBroadcastDialog: () => void;
	onToggleSubtitles: () => void;
	showSubtitles: boolean;
	onSetMode: (mode: ViewerMode) => void;
}

export function SlideShowSection(p: SlideShowSectionProps): React.ReactElement {
	return (
		<>
			<button
				onClick={() => p.onSetMode('present')}
				className={pill}
				title='Start slide show from beginning'
			>
				<LuPlay className={ic} />
				From Beginning
			</button>
			<button onClick={p.onPresent} className={pill} title='Start slide show from current slide'>
				<LuPlay className={ic} />
				From Current Slide
			</button>
			{sep}
			<button onClick={p.onEnterPresenterView} className={pill} title='Presenter view'>
				<LuMonitor className={ic} />
				Presenter View
			</button>
			<button onClick={p.onEnterRehearsalMode} className={pill} title='Rehearse timings'>
				<LuClock className={ic} />
				Rehearse Timings
			</button>
			{sep}
			<button onClick={p.onOpenSetUpSlideShow} className={pill} title='Set up slide show'>
				<LuSettings className={ic} />
				Set Up Slide Show
			</button>
			<button onClick={p.onOpenBroadcastDialog} className={pill} title='Broadcast slide show'>
				<LuCast className={ic} />
				Broadcast
			</button>
			{sep}
			<button
				onClick={p.onToggleSubtitles}
				className={cn(pill, p.showSubtitles ? 'bg-primary hover:bg-primary/80 text-white' : '')}
				title='Toggle subtitles'
			>
				<LuCaptions className={ic} />
				Subtitles
			</button>
		</>
	);
}
