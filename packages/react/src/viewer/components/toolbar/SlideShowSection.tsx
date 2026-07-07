import React from 'react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation();

	return (
		<>
			<button
				onClick={() => p.onSetMode('present')}
				className={pill}
				title={t('pptx.slideShow.fromBeginningTooltip')}
			>
				<LuPlay className={ic} />
				{t('pptx.slideShow.fromBeginning')}
			</button>
			<button onClick={p.onPresent} className={pill} title={t('pptx.slideShow.fromCurrentTooltip')}>
				<LuPlay className={ic} />
				{t('pptx.slideShow.fromCurrent')}
			</button>
			{sep}
			<button
				onClick={p.onEnterPresenterView}
				className={pill}
				title={t('pptx.slideShow.presenterViewTooltip')}
			>
				<LuMonitor className={ic} />
				{t('pptx.slideShow.presenterView')}
			</button>
			<button
				onClick={p.onEnterRehearsalMode}
				className={pill}
				title={t('pptx.slideShow.rehearseTimingsTooltip')}
			>
				<LuClock className={ic} />
				{t('pptx.slideShow.rehearseTimings')}
			</button>
			{sep}
			<button
				onClick={p.onOpenSetUpSlideShow}
				className={pill}
				title={t('pptx.slideShow.setUpTooltip')}
			>
				<LuSettings className={ic} />
				{t('pptx.slideShow.setUp')}
			</button>
			<button
				onClick={p.onOpenBroadcastDialog}
				className={pill}
				title={t('pptx.slideShow.broadcastTooltip')}
			>
				<LuCast className={ic} />
				{t('pptx.slideShow.broadcast')}
			</button>
			{sep}
			<button
				onClick={p.onToggleSubtitles}
				className={cn(pill, p.showSubtitles ? 'bg-primary hover:bg-primary/80 text-white' : '')}
				title={t('pptx.slideShow.subtitlesTooltip')}
			>
				<LuCaptions className={ic} />
				{t('pptx.slideShow.subtitles')}
			</button>
		</>
	);
}
