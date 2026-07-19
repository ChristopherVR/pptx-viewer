import type { ToolbarTabId } from '../toolbar-actions';
import type { ViewerPreferences } from '../viewer-preferences';

/**
 * Full PowerPoint "File > Options" parity model.
 *
 * Groups mirror the ten categories of PowerPoint's Options dialog. Values are
 * flat primitives per group so the dialog panes can be rendered generically
 * from `VIEWER_OPTIONS_SCHEMA` in every binding. The legacy six-toggle
 * `ViewerPreferences` surface stays supported via the mapping helpers below.
 */

export type ScreenTipStyle = 'descriptions' | 'plain' | 'off';
export type DisplayOptimization = 'appearance' | 'compatibility';
export type ImageResolutionPreset = 'highFidelity' | 'ppi330' | 'ppi220' | 'ppi150' | 'ppi96';
export type OpenDocumentsView = 'savedView' | 'normal' | 'outline' | 'slideSorter' | 'notes';
export type DefaultExportFormat = 'pptx' | 'pdf' | 'png';
export type QuickAccessPosition = 'above' | 'below';
export type FeedbackSoundScheme = 'modern' | 'classic';
export type OptionsPrintWhat = 'slides' | 'handouts' | 'notes' | 'outline';
export type OptionsPrintColorMode = 'color' | 'grayscale' | 'blackAndWhite';

export interface ViewerGeneralOptions {
	displayOptimization: DisplayOptimization;
	showMiniToolbar: boolean;
	enableLivePreview: boolean;
	collapseRibbonAutomatically: boolean;
	collapseSearchByDefault: boolean;
	screenTipStyle: ScreenTipStyle;
	userName: string;
	userInitials: string;
	showStartScreen: boolean;
}

export interface ViewerProofingOptions {
	autoCorrectTwoInitialCapitals: boolean;
	autoCorrectCapitalizeFirstLetter: boolean;
	autoCorrectCapitalizeDayNames: boolean;
	autoCorrectSmartQuotes: boolean;
	autoCorrectHyphensToDash: boolean;
	autoCorrectFractions: boolean;
	autoCorrectOrdinals: boolean;
	ignoreUppercase: boolean;
	ignoreWordsWithNumbers: boolean;
	ignoreInternetAddresses: boolean;
	flagRepeatedWords: boolean;
	checkSpellingAsYouType: boolean;
	hideSpellingErrors: boolean;
}

export interface ViewerSaveOptions {
	autoSave: boolean;
	autoRecoverIntervalMinutes: number;
	keepLastAutoRecoveredVersion: boolean;
	defaultExportFormat: DefaultExportFormat;
	embedFonts: boolean;
	embedAllFontCharacters: boolean;
	cacheRetentionDays: number;
	clearCacheOnClose: boolean;
}

export interface ViewerAccessibilityOptions {
	showAccessibilityStatus: boolean;
	feedbackWithSound: boolean;
	soundScheme: FeedbackSoundScheme;
	showShortcutKeysInScreenTips: boolean;
	reducedMotion: boolean;
}

export interface ViewerAdvancedOptions {
	autoSelectEntireWord: boolean;
	allowTextDragAndDrop: boolean;
	maximumUndoSteps: number;
	useSmartCutAndPaste: boolean;
	showPasteOptionsButton: boolean;
	imageDefaultResolution: ImageResolutionPreset;
	doNotCompressImages: boolean;
	chartPropertiesFollowDataPoint: boolean;
	recentPresentationsCount: number;
	showVerticalRuler: boolean;
	showGrid: boolean;
	snapToGrid: boolean;
	disableHardwareAcceleration: boolean;
	openDocumentsView: OpenDocumentsView;
	slideShowShowMenuOnRightClick: boolean;
	slideShowShowPopupToolbar: boolean;
	slideShowPromptKeepInkAnnotations: boolean;
	slideShowEndWithBlackSlide: boolean;
	printInBackground: boolean;
	printHighQuality: boolean;
	printUseMostRecentSettings: boolean;
	printWhat: OptionsPrintWhat;
	printColorMode: OptionsPrintColorMode;
	printHiddenSlides: boolean;
	printScaleToFit: boolean;
	printFrameSlides: boolean;
}

export interface ViewerRibbonOptions {
	/** Ribbon tabs unticked in Customize Ribbon. The File tab can never be hidden. */
	hiddenTabIds: ToolbarTabId[];
}

export interface ViewerQuickAccessOptions {
	visible: boolean;
	position: QuickAccessPosition;
	showCommandLabels: boolean;
	/** Ordered ids from `QUICK_ACCESS_COMMAND_CATALOG`. */
	commandIds: string[];
}

export interface ViewerTrustOptions {
	openInProtectedView: boolean;
	allowExternalContent: boolean;
	confirmExternalHyperlinks: boolean;
}

export interface ViewerOptions {
	general: ViewerGeneralOptions;
	proofing: ViewerProofingOptions;
	save: ViewerSaveOptions;
	accessibility: ViewerAccessibilityOptions;
	advanced: ViewerAdvancedOptions;
	ribbon: ViewerRibbonOptions;
	quickAccess: ViewerQuickAccessOptions;
	trust: ViewerTrustOptions;
}

export type ViewerOptionsGroupId = keyof ViewerOptions;
export type ViewerOptionPrimitive = boolean | number | string;

export const DEFAULT_VIEWER_OPTIONS: ViewerOptions = {
	general: {
		displayOptimization: 'appearance',
		showMiniToolbar: true,
		enableLivePreview: true,
		collapseRibbonAutomatically: false,
		collapseSearchByDefault: false,
		screenTipStyle: 'descriptions',
		userName: '',
		userInitials: '',
		showStartScreen: true,
	},
	proofing: {
		autoCorrectTwoInitialCapitals: true,
		autoCorrectCapitalizeFirstLetter: true,
		autoCorrectCapitalizeDayNames: true,
		autoCorrectSmartQuotes: true,
		autoCorrectHyphensToDash: true,
		autoCorrectFractions: true,
		autoCorrectOrdinals: true,
		ignoreUppercase: true,
		ignoreWordsWithNumbers: true,
		ignoreInternetAddresses: true,
		flagRepeatedWords: true,
		checkSpellingAsYouType: false,
		hideSpellingErrors: false,
	},
	save: {
		autoSave: true,
		autoRecoverIntervalMinutes: 2,
		keepLastAutoRecoveredVersion: true,
		defaultExportFormat: 'pptx',
		embedFonts: false,
		embedAllFontCharacters: false,
		cacheRetentionDays: 14,
		clearCacheOnClose: false,
	},
	accessibility: {
		showAccessibilityStatus: true,
		feedbackWithSound: false,
		soundScheme: 'modern',
		showShortcutKeysInScreenTips: true,
		reducedMotion: false,
	},
	advanced: {
		autoSelectEntireWord: true,
		allowTextDragAndDrop: true,
		maximumUndoSteps: 100,
		useSmartCutAndPaste: true,
		showPasteOptionsButton: true,
		imageDefaultResolution: 'highFidelity',
		doNotCompressImages: false,
		chartPropertiesFollowDataPoint: true,
		recentPresentationsCount: 50,
		showVerticalRuler: false,
		showGrid: false,
		snapToGrid: false,
		disableHardwareAcceleration: false,
		openDocumentsView: 'savedView',
		slideShowShowMenuOnRightClick: true,
		slideShowShowPopupToolbar: true,
		slideShowPromptKeepInkAnnotations: true,
		slideShowEndWithBlackSlide: true,
		printInBackground: true,
		printHighQuality: false,
		printUseMostRecentSettings: true,
		printWhat: 'slides',
		printColorMode: 'color',
		printHiddenSlides: false,
		printScaleToFit: false,
		printFrameSlides: false,
	},
	ribbon: { hiddenTabIds: [] },
	quickAccess: {
		visible: true,
		position: 'above',
		showCommandLabels: false,
		commandIds: ['save', 'undo', 'redo', 'presentFromStart'],
	},
	trust: {
		openInProtectedView: false,
		allowExternalContent: true,
		confirmExternalHyperlinks: true,
	},
};

function cloneOptions(options: ViewerOptions): ViewerOptions {
	return {
		general: { ...options.general },
		proofing: { ...options.proofing },
		save: { ...options.save },
		accessibility: { ...options.accessibility },
		advanced: { ...options.advanced },
		ribbon: { hiddenTabIds: [...options.ribbon.hiddenTabIds] },
		quickAccess: { ...options.quickAccess, commandIds: [...options.quickAccess.commandIds] },
		trust: { ...options.trust },
	};
}

export type StoredViewerOptions = {
	[G in ViewerOptionsGroupId]?: Partial<ViewerOptions[G]>;
};

/** Merge a persisted partial over the defaults, dropping unknown keys. */
export function mergeViewerOptions(stored: StoredViewerOptions | undefined): ViewerOptions {
	const merged = cloneOptions(DEFAULT_VIEWER_OPTIONS);
	if (!stored || typeof stored !== 'object') {
		return merged;
	}
	for (const groupId of Object.keys(merged) as ViewerOptionsGroupId[]) {
		const patch = stored[groupId];
		if (!patch || typeof patch !== 'object') {
			continue;
		}
		const target = merged[groupId] as unknown as Record<string, unknown>;
		const defaults = DEFAULT_VIEWER_OPTIONS[groupId] as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(patch)) {
			if (!(key in defaults) || value === undefined) {
				continue;
			}
			const defaultValue = defaults[key];
			if (Array.isArray(defaultValue)) {
				if (Array.isArray(value)) {
					target[key] = value.filter((entry): entry is string => typeof entry === 'string');
				}
			} else if (typeof value === typeof defaultValue) {
				target[key] = value;
			}
		}
	}
	return merged;
}

/** Sparse diff of `options` against the defaults, for lean persistence. */
export function diffViewerOptions(options: ViewerOptions): StoredViewerOptions {
	const diff: StoredViewerOptions = {};
	for (const groupId of Object.keys(DEFAULT_VIEWER_OPTIONS) as ViewerOptionsGroupId[]) {
		const defaults = DEFAULT_VIEWER_OPTIONS[groupId] as unknown as Record<string, unknown>;
		const current = options[groupId] as unknown as Record<string, unknown>;
		let groupDiff: Record<string, unknown> | undefined;
		for (const key of Object.keys(defaults)) {
			const defaultValue = defaults[key];
			const value = current[key];
			const changed = Array.isArray(defaultValue)
				? JSON.stringify(defaultValue) !== JSON.stringify(value)
				: defaultValue !== value;
			if (changed) {
				groupDiff ??= {};
				groupDiff[key] = value;
			}
		}
		if (groupDiff) {
			diff[groupId] = groupDiff as StoredViewerOptions[typeof groupId];
		}
	}
	return diff;
}

/** Project the full options model onto the legacy six-toggle preferences surface. */
export function viewerOptionsToPreferences(options: ViewerOptions): ViewerPreferences {
	return {
		autoSave: options.save.autoSave,
		spellCheck: options.proofing.checkSpellingAsYouType,
		showGrid: options.advanced.showGrid,
		showRulers: options.advanced.showVerticalRuler,
		snapToGrid: options.advanced.snapToGrid,
		reducedMotion: options.accessibility.reducedMotion,
	};
}

/** Apply a legacy preference toggle back onto the options model. */
export function applyPreferenceToOptions(
	options: ViewerOptions,
	key: keyof ViewerPreferences,
	value: boolean,
): ViewerOptions {
	const next = cloneOptions(options);
	switch (key) {
		case 'autoSave':
			next.save.autoSave = value;
			break;
		case 'spellCheck':
			next.proofing.checkSpellingAsYouType = value;
			break;
		case 'showGrid':
			next.advanced.showGrid = value;
			break;
		case 'showRulers':
			next.advanced.showVerticalRuler = value;
			break;
		case 'snapToGrid':
			next.advanced.snapToGrid = value;
			break;
		case 'reducedMotion':
			next.accessibility.reducedMotion = value;
			break;
	}
	return next;
}

export { cloneOptions as cloneViewerOptions };
