import type { ViewerOptionsTabDefinition } from './viewer-options-controls';
import {
	SCREEN_TIP_CHOICES,
	choices,
	numberControl,
	select,
	textControl,
	toggle,
} from './viewer-options-controls';

/** General, Proofing, Save, Language, and Accessibility tab definitions. */

export const GENERAL_TAB: ViewerOptionsTabDefinition = {
	id: 'general',
	labelKey: 'pptx.settings.general',
	descriptionKey: 'pptx.options.general.description',
	sections: [
		{
			id: 'userInterface',
			titleKey: 'pptx.options.general.userInterface',
			controls: [
				select(
					'general',
					'displayOptimization',
					'pptx.options.general.displayOptimization',
					choices('pptx.options.displayOptimization', ['appearance', 'compatibility']),
				),
				toggle('general', 'showMiniToolbar', 'pptx.options.general.showMiniToolbar', {
					infoKey: 'pptx.options.general.showMiniToolbarInfo',
				}),
				toggle('general', 'enableLivePreview', 'pptx.options.general.enableLivePreview', {
					infoKey: 'pptx.options.general.enableLivePreviewInfo',
				}),
				toggle('general', 'collapseRibbonAutomatically', 'pptx.options.general.collapseRibbon'),
				toggle('general', 'collapseSearchByDefault', 'pptx.options.general.collapseSearch'),
				select(
					'general',
					'screenTipStyle',
					'pptx.options.general.screenTipStyle',
					SCREEN_TIP_CHOICES,
				),
			],
		},
		{
			id: 'personalize',
			titleKey: 'pptx.options.general.personalize',
			controls: [
				textControl('general', 'userName', 'pptx.options.general.userName'),
				textControl('general', 'userInitials', 'pptx.options.general.userInitials'),
			],
		},
		{
			id: 'appearance',
			titleKey: 'pptx.options.general.appearance',
			special: 'themePicker',
			controls: [],
		},
		{
			id: 'startup',
			titleKey: 'pptx.options.general.startup',
			controls: [toggle('general', 'showStartScreen', 'pptx.options.general.showStartScreen')],
		},
	],
};

export const PROOFING_TAB: ViewerOptionsTabDefinition = {
	id: 'proofing',
	labelKey: 'pptx.options.proofing.label',
	descriptionKey: 'pptx.options.proofing.description',
	sections: [
		{
			id: 'autoCorrect',
			titleKey: 'pptx.options.proofing.autoCorrect',
			descriptionKey: 'pptx.options.proofing.autoCorrectDescription',
			controls: [
				toggle(
					'proofing',
					'autoCorrectTwoInitialCapitals',
					'pptx.options.proofing.twoInitialCapitals',
				),
				toggle(
					'proofing',
					'autoCorrectCapitalizeFirstLetter',
					'pptx.options.proofing.capitalizeFirstLetter',
				),
				toggle(
					'proofing',
					'autoCorrectCapitalizeDayNames',
					'pptx.options.proofing.capitalizeDayNames',
				),
				toggle('proofing', 'autoCorrectSmartQuotes', 'pptx.options.proofing.smartQuotes'),
				toggle('proofing', 'autoCorrectHyphensToDash', 'pptx.options.proofing.hyphensToDash'),
				toggle('proofing', 'autoCorrectFractions', 'pptx.options.proofing.fractions'),
				toggle('proofing', 'autoCorrectOrdinals', 'pptx.options.proofing.ordinals'),
			],
		},
		{
			id: 'spellingOffice',
			titleKey: 'pptx.options.proofing.spellingOffice',
			controls: [
				toggle('proofing', 'ignoreUppercase', 'pptx.options.proofing.ignoreUppercase'),
				toggle(
					'proofing',
					'ignoreWordsWithNumbers',
					'pptx.options.proofing.ignoreWordsWithNumbers',
				),
				toggle(
					'proofing',
					'ignoreInternetAddresses',
					'pptx.options.proofing.ignoreInternetAddresses',
				),
				toggle('proofing', 'flagRepeatedWords', 'pptx.options.proofing.flagRepeatedWords'),
			],
		},
		{
			id: 'spellingViewer',
			titleKey: 'pptx.options.proofing.spellingViewer',
			controls: [
				toggle(
					'proofing',
					'checkSpellingAsYouType',
					'pptx.options.proofing.checkSpellingAsYouType',
				),
				toggle('proofing', 'hideSpellingErrors', 'pptx.options.proofing.hideSpellingErrors', {
					indent: true,
				}),
			],
		},
	],
};

export const SAVE_TAB: ViewerOptionsTabDefinition = {
	id: 'save',
	labelKey: 'pptx.options.save.label',
	descriptionKey: 'pptx.options.save.description',
	sections: [
		{
			id: 'savePresentations',
			titleKey: 'pptx.options.save.savePresentations',
			controls: [
				toggle('save', 'autoSave', 'pptx.options.save.autoSave', {
					infoKey: 'pptx.options.save.autoSaveInfo',
				}),
				select(
					'save',
					'defaultExportFormat',
					'pptx.options.save.defaultFormat',
					choices('pptx.options.saveFormat', ['pptx', 'pdf', 'png']),
				),
				numberControl(
					'save',
					'autoRecoverIntervalMinutes',
					'pptx.options.save.autoRecoverInterval',
					1,
					120,
					'pptx.options.save.minutes',
				),
				toggle('save', 'keepLastAutoRecoveredVersion', 'pptx.options.save.keepLastAutoRecovered', {
					indent: true,
				}),
			],
		},
		{
			id: 'fidelity',
			titleKey: 'pptx.options.save.fidelity',
			controls: [
				toggle('save', 'embedFonts', 'pptx.options.save.embedFonts', {
					infoKey: 'pptx.options.save.embedFontsInfo',
				}),
				toggle('save', 'embedAllFontCharacters', 'pptx.options.save.embedAllCharacters', {
					indent: true,
				}),
			],
		},
		{
			id: 'cache',
			titleKey: 'pptx.options.save.cache',
			special: 'clearCache',
			controls: [
				numberControl(
					'save',
					'cacheRetentionDays',
					'pptx.options.save.cacheRetentionDays',
					1,
					90,
					'pptx.options.save.days',
				),
				toggle('save', 'clearCacheOnClose', 'pptx.options.save.clearCacheOnClose'),
			],
		},
	],
};

export const LANGUAGE_TAB: ViewerOptionsTabDefinition = {
	id: 'language',
	labelKey: 'pptx.settings.language',
	descriptionKey: 'pptx.options.language.description',
	custom: 'language',
	sections: [],
};

export const ACCESSIBILITY_TAB: ViewerOptionsTabDefinition = {
	id: 'accessibility',
	labelKey: 'pptx.options.accessibility.label',
	descriptionKey: 'pptx.options.accessibility.description',
	sections: [
		{
			id: 'assistant',
			titleKey: 'pptx.options.accessibility.assistant',
			controls: [
				toggle('accessibility', 'showAccessibilityStatus', 'pptx.options.accessibility.showStatus'),
			],
		},
		{
			id: 'feedback',
			titleKey: 'pptx.options.accessibility.feedback',
			controls: [
				toggle(
					'accessibility',
					'feedbackWithSound',
					'pptx.options.accessibility.feedbackWithSound',
				),
				select(
					'accessibility',
					'soundScheme',
					'pptx.options.accessibility.soundScheme',
					choices('pptx.options.soundScheme', ['modern', 'classic']),
				),
			],
		},
		{
			id: 'display',
			titleKey: 'pptx.options.accessibility.display',
			controls: [
				select(
					'general',
					'screenTipStyle',
					'pptx.options.general.screenTipStyle',
					SCREEN_TIP_CHOICES,
				),
				toggle(
					'accessibility',
					'showShortcutKeysInScreenTips',
					'pptx.options.accessibility.showShortcutKeys',
				),
				toggle('accessibility', 'reducedMotion', 'pptx.settings.reducedMotion'),
			],
		},
	],
};
