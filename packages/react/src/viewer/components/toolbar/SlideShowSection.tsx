import type { ToolbarActionId } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuCaptions,
	LuCast,
	LuClock3,
	LuEyeOff,
	LuListVideo,
	LuMonitorPlay,
	LuPlay,
	LuPresentation,
	LuSettings2,
	LuVideo,
} from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import type { ViewerMode } from '../../types';
import {
	RibbonCommand,
	RibbonCommandStack,
	RibbonGroup,
	RibbonToggle,
} from './PowerPointRibbonControls';

export interface SlideShowSectionProps {
	onPresent: () => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSetUpSlideShow: () => void;
	onOpenBroadcastDialog: () => void;
	onToggleSubtitles: () => void;
	showSubtitles: boolean;
	onSetMode: (mode: ViewerMode) => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
}

export function SlideShowSection(p: SlideShowSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { isHidden } = useToolbarVisibility(p.hiddenActions);
	return (
		<>
			<RibbonGroup label={t('pptx.slideShow.start', { defaultValue: 'Start Slide Show' })}>
				<RibbonCommand
					label={t('pptx.slideShow.fromBeginning')}
					icon={<LuPlay />}
					onClick={() => p.onSetMode('present')}
					title='Start slide show from beginning'
				/>
				<RibbonCommand
					label={t('pptx.slideShow.fromCurrent')}
					icon={<LuMonitorPlay />}
					onClick={p.onPresent}
					title='Start slide show from current slide'
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideShow.present', { defaultValue: 'Present' })}>
				<RibbonCommand
					label={t('pptx.slideShow.presenterView')}
					icon={<LuPresentation />}
					onClick={p.onEnterPresenterView}
					title='Presenter view'
				/>
				<RibbonCommand
					label={t('pptx.slideShow.customShow', { defaultValue: 'Custom Show' })}
					icon={<LuListVideo />}
					disabled
				/>
				{!isHidden('broadcast') && (
					<RibbonCommand
						label={t('pptx.slideShow.broadcast')}
						icon={<LuCast />}
						onClick={p.onOpenBroadcastDialog}
						title='Broadcast slide show'
					/>
				)}
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideShow.setUpGroup', { defaultValue: 'Set Up' })}>
				<RibbonCommand
					label={t('pptx.slideShow.rehearseCoach', { defaultValue: 'Rehearse with Coach' })}
					icon={<LuVideo />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.slideShow.setUp')}
					icon={<LuSettings2 />}
					onClick={p.onOpenSetUpSlideShow}
					title='Set up slide show'
				/>
				<RibbonCommand
					label={t('pptx.slideShow.hideSlide', { defaultValue: 'Hide Slide' })}
					icon={<LuEyeOff />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.slideShow.rehearseTimings')}
					icon={<LuClock3 />}
					onClick={p.onEnterRehearsalMode}
					title='Rehearse timings'
				/>
				<RibbonCommand
					label={t('pptx.titleBar.record')}
					icon={<LuVideo />}
					onClick={p.onEnterRehearsalMode}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.slideShow.options', { defaultValue: 'Options' })}>
				<RibbonCommandStack>
					<RibbonToggle
						label={t('pptx.slideShow.keepUpdated', { defaultValue: 'Keep Slides Updated' })}
						checked={false}
						disabled
					/>
					<RibbonToggle
						label={t('pptx.slideShow.useTimings', { defaultValue: 'Use Timings' })}
						checked
					/>
					<RibbonToggle
						label={t('pptx.slideShow.playNarrations', { defaultValue: 'Play Narrations' })}
						checked
					/>
				</RibbonCommandStack>
				<RibbonCommandStack>
					<RibbonToggle
						label={t('pptx.slideShow.mediaControls', { defaultValue: 'Show Media Controls' })}
						checked
					/>
					<RibbonToggle
						label={t('pptx.slideShow.subtitles')}
						checked={p.showSubtitles}
						onChange={() => p.onToggleSubtitles()}
						title='Toggle subtitles'
					/>
					<RibbonCommand
						compact
						label={t('pptx.slideShow.subtitleSettings', { defaultValue: 'Subtitle Settings' })}
						icon={<LuCaptions />}
						onClick={p.onToggleSubtitles}
					/>
				</RibbonCommandStack>
			</RibbonGroup>
		</>
	);
}
