import type { SlideShowRibbonGroup } from './ribbon-slide-show-commands';

/** Shared presentation metadata; recording operations remain in the bindings. */
export const RECORD_COMMAND_GROUPS: readonly SlideShowRibbonGroup[] = [
	{
		id: 'record.camera',
		labelKey: 'pptx.record.camera',
		commands: [
			{
				id: 'record.camera.cameo',
				labelKey: 'pptx.record.cameo',
				icon: 'camera',
				unsupported: true,
			},
		],
	},
	{
		id: 'record.record',
		labelKey: 'pptx.ribbon.tab.record',
		commands: [
			{
				id: 'record.record.fromBeginning',
				labelKey: 'pptx.slideShow.fromBeginning',
				icon: 'video',
			},
			{ id: 'record.record.fromCurrent', labelKey: 'pptx.slideShow.fromCurrent', icon: 'play' },
		],
	},
	{
		id: 'record.manage',
		labelKey: 'pptx.record.manage',
		commands: [
			{
				id: 'record.manage.clear',
				labelKey: 'pptx.record.clear',
				icon: 'eraser',
				unsupported: true,
			},
			{
				id: 'record.manage.reset',
				labelKey: 'pptx.record.resetToCameo',
				icon: 'reset',
				unsupported: true,
			},
		],
	},
	{
		id: 'record.help',
		labelKey: 'pptx.ribbon.tab.help',
		commands: [
			{
				id: 'record.help.learnMore',
				labelKey: 'pptx.record.learnMore',
				icon: 'help',
				unsupported: true,
			},
		],
	},
];
