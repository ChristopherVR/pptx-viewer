import type { ViewerOptionsTabDefinition } from './viewer-options-controls';
import { choices, numberControl, select, toggle } from './viewer-options-controls';

/** Advanced, Customize Ribbon, Quick Access, Add-ins, and Trust Center tabs. */

export const ADVANCED_TAB: ViewerOptionsTabDefinition = {
	id: 'advanced',
	labelKey: 'pptx.options.advanced.label',
	descriptionKey: 'pptx.options.advanced.description',
	sections: [
		{
			id: 'editing',
			titleKey: 'pptx.options.advanced.editing',
			controls: [
				toggle('advanced', 'autoSelectEntireWord', 'pptx.options.advanced.autoSelectWord'),
				toggle('advanced', 'allowTextDragAndDrop', 'pptx.options.advanced.textDragAndDrop'),
				numberControl(
					'advanced',
					'maximumUndoSteps',
					'pptx.options.advanced.maximumUndoSteps',
					3,
					150,
				),
			],
		},
		{
			id: 'cutCopyPaste',
			titleKey: 'pptx.options.advanced.cutCopyPaste',
			controls: [
				toggle('advanced', 'useSmartCutAndPaste', 'pptx.options.advanced.smartCutAndPaste'),
				toggle('advanced', 'showPasteOptionsButton', 'pptx.options.advanced.showPasteOptions'),
			],
		},
		{
			id: 'imageQuality',
			titleKey: 'pptx.options.advanced.imageQuality',
			controls: [
				toggle('advanced', 'doNotCompressImages', 'pptx.options.advanced.doNotCompressImages'),
				select(
					'advanced',
					'imageDefaultResolution',
					'pptx.options.advanced.defaultResolution',
					choices('pptx.options.resolution', [
						'highFidelity',
						'ppi330',
						'ppi220',
						'ppi150',
						'ppi96',
					]),
				),
			],
		},
		{
			id: 'chart',
			titleKey: 'pptx.options.advanced.chart',
			controls: [
				toggle(
					'advanced',
					'chartPropertiesFollowDataPoint',
					'pptx.options.advanced.chartFollowDataPoint',
				),
			],
		},
		{
			id: 'display',
			titleKey: 'pptx.options.advanced.display',
			controls: [
				numberControl(
					'advanced',
					'recentPresentationsCount',
					'pptx.options.advanced.recentCount',
					0,
					50,
				),
				toggle('advanced', 'showVerticalRuler', 'pptx.settings.showRulers'),
				toggle('advanced', 'showGrid', 'pptx.settings.showGrid'),
				toggle('advanced', 'snapToGrid', 'pptx.settings.snapToGrid'),
				toggle(
					'advanced',
					'disableHardwareAcceleration',
					'pptx.options.advanced.disableHardwareAcceleration',
				),
				select(
					'advanced',
					'openDocumentsView',
					'pptx.options.advanced.openDocumentsView',
					choices('pptx.options.openView', [
						'savedView',
						'normal',
						'outline',
						'slideSorter',
						'notes',
					]),
				),
			],
		},
		{
			id: 'slideShow',
			titleKey: 'pptx.options.advanced.slideShow',
			controls: [
				toggle(
					'advanced',
					'slideShowShowMenuOnRightClick',
					'pptx.options.advanced.showMenuOnRightClick',
				),
				toggle('advanced', 'slideShowShowPopupToolbar', 'pptx.options.advanced.showPopupToolbar'),
				toggle(
					'advanced',
					'slideShowPromptKeepInkAnnotations',
					'pptx.options.advanced.promptKeepInk',
				),
				toggle('advanced', 'slideShowEndWithBlackSlide', 'pptx.options.advanced.endWithBlackSlide'),
			],
		},
		{
			id: 'print',
			titleKey: 'pptx.options.advanced.print',
			controls: [
				toggle('advanced', 'printInBackground', 'pptx.options.advanced.printInBackground'),
				toggle('advanced', 'printHighQuality', 'pptx.options.advanced.printHighQuality'),
				toggle(
					'advanced',
					'printUseMostRecentSettings',
					'pptx.options.advanced.printUseMostRecent',
				),
				select(
					'advanced',
					'printWhat',
					'pptx.options.advanced.printWhat',
					choices('pptx.options.printWhat', ['slides', 'handouts', 'notes', 'outline']),
				),
				select(
					'advanced',
					'printColorMode',
					'pptx.options.advanced.printColorMode',
					choices('pptx.options.printColorMode', ['color', 'grayscale', 'blackAndWhite']),
				),
				toggle('advanced', 'printHiddenSlides', 'pptx.options.advanced.printHiddenSlides', {
					indent: true,
				}),
				toggle('advanced', 'printScaleToFit', 'pptx.options.advanced.printScaleToFit', {
					indent: true,
				}),
				toggle('advanced', 'printFrameSlides', 'pptx.options.advanced.printFrameSlides', {
					indent: true,
				}),
			],
		},
	],
};

export const RIBBON_TAB: ViewerOptionsTabDefinition = {
	id: 'ribbon',
	labelKey: 'pptx.options.ribbon.label',
	descriptionKey: 'pptx.options.ribbon.description',
	custom: 'ribbon',
	sections: [
		{
			id: 'shortcutReference',
			titleKey: 'pptx.settings.keyboardShortcuts',
			special: 'shortcutReference',
			controls: [],
		},
	],
};

export const QUICK_ACCESS_TAB: ViewerOptionsTabDefinition = {
	id: 'quickAccess',
	labelKey: 'pptx.options.quickAccess.label',
	descriptionKey: 'pptx.options.quickAccess.description',
	custom: 'quickAccess',
	sections: [
		{
			id: 'quickAccessOptions',
			titleKey: 'pptx.options.quickAccess.optionsTitle',
			controls: [
				toggle('quickAccess', 'visible', 'pptx.options.quickAccess.show'),
				select(
					'quickAccess',
					'position',
					'pptx.options.quickAccess.position',
					choices('pptx.options.quickAccessPosition', ['above', 'below']),
				),
				toggle('quickAccess', 'showCommandLabels', 'pptx.options.quickAccess.showLabels'),
			],
		},
	],
};

export const ADD_INS_TAB: ViewerOptionsTabDefinition = {
	id: 'addIns',
	labelKey: 'pptx.options.addIns.label',
	descriptionKey: 'pptx.options.addIns.description',
	custom: 'addIns',
	sections: [],
};

export const TRUST_TAB: ViewerOptionsTabDefinition = {
	id: 'trust',
	labelKey: 'pptx.options.trust.label',
	descriptionKey: 'pptx.options.trust.description',
	sections: [
		{
			id: 'trustSettings',
			titleKey: 'pptx.options.trust.settingsTitle',
			descriptionKey: 'pptx.options.trust.settingsDescription',
			controls: [
				toggle('trust', 'openInProtectedView', 'pptx.options.trust.protectedView', {
					infoKey: 'pptx.options.trust.protectedViewInfo',
				}),
				toggle('trust', 'allowExternalContent', 'pptx.options.trust.allowExternalContent', {
					infoKey: 'pptx.options.trust.allowExternalContentInfo',
				}),
				toggle('trust', 'confirmExternalHyperlinks', 'pptx.options.trust.confirmHyperlinks'),
			],
		},
	],
};
