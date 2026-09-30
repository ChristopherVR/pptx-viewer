import type { RibbonControlId, RibbonGroupId } from './customization';

/** View-only command metadata; hosts retain all document and dialog operations. */
export interface SlideShowRibbonCommand {
	id: RibbonControlId;
	labelKey: string;
	icon: string;
	tooltipKey?: string;
	unsupported?: boolean;
}

export interface SlideShowRibbonGroup {
	id: RibbonGroupId;
	labelKey: string;
	commands: readonly SlideShowRibbonCommand[];
}

export const SLIDE_SHOW_COMMAND_GROUPS: readonly SlideShowRibbonGroup[] = [
	{
		id: 'slideShow.startSlideShow',
		labelKey: 'pptx.slideShow.start',
		commands: [
			{
				id: 'slideShow.startSlideShow.fromBeginning',
				labelKey: 'pptx.slideShow.fromBeginning',
				icon: 'play-start',
				tooltipKey: 'pptx.slideShow.fromBeginningTooltip',
			},
			{
				id: 'slideShow.startSlideShow.fromCurrent',
				labelKey: 'pptx.slideShow.fromCurrent',
				icon: 'play',
				tooltipKey: 'pptx.slideShow.fromCurrentTooltip',
			},
		],
	},
	{
		id: 'slideShow.present',
		labelKey: 'pptx.slideShow.present',
		commands: [
			{
				id: 'slideShow.present.presenterView',
				labelKey: 'pptx.slideShow.presenterView',
				icon: 'presentation',
				tooltipKey: 'pptx.slideShow.presenterViewTooltip',
			},
			{
				id: 'slideShow.startSlideShow.customShow',
				labelKey: 'pptx.slideShow.customShow',
				icon: 'list',
				tooltipKey: 'pptx.customShows.customShowTooltip',
			},
			{
				id: 'slideShow.present.broadcast',
				labelKey: 'pptx.slideShow.broadcast',
				icon: 'broadcast',
				tooltipKey: 'pptx.slideShow.broadcastTooltip',
			},
		],
	},
	{
		id: 'slideShow.setUp',
		labelKey: 'pptx.slideShow.setUpGroup',
		commands: [
			{
				id: 'slideShow.setUp.rehearseWithCoach',
				labelKey: 'pptx.slideShow.rehearseCoach',
				icon: 'video',
				unsupported: true,
			},
			{
				id: 'slideShow.setUp.setUpSlideShow',
				labelKey: 'pptx.slideShow.setUp',
				icon: 'settings',
				tooltipKey: 'pptx.slideShow.setUpTooltip',
			},
			{ id: 'slideShow.setUp.hideSlide', labelKey: 'pptx.slideShow.hideSlide', icon: 'eye-off' },
			{
				id: 'slideShow.setUp.rehearseTimings',
				labelKey: 'pptx.slideShow.rehearseTimings',
				icon: 'clock',
				tooltipKey: 'pptx.slideShow.rehearseTimingsTooltip',
			},
			{ id: 'slideShow.setUp.record', labelKey: 'pptx.titleBar.record', icon: 'record' },
		],
	},
];
