import type { ViewerOptions, ViewerOptionsStore } from './options';

export const SUBTITLE_LANGUAGES = [
	'auto',
	'en-US',
	'en-GB',
	'fr-FR',
	'de-DE',
	'es-ES',
	'pt-BR',
	'it-IT',
	'ja-JP',
	'ko-KR',
	'zh-CN',
] as const;
export interface SubtitleSettings {
	spokenLanguage: string;
}

/** Render familiar language names while keeping browser recognition codes in state. */
export function subtitleLanguageLabel(language: string): string {
	try {
		return new Intl.DisplayNames(undefined, { type: 'language' }).of(language) ?? language;
	} catch {
		return language;
	}
}
export interface SubtitleSettingsLabels {
	title: string;
	language: string;
	browserLanguage: string;
	description: string;
	apply: string;
	cancel: string;
}

/** Browser recognition settings, independent of caption visibility and deck metadata. */
export function normalizeSubtitleSettings(settings?: Partial<SubtitleSettings>): SubtitleSettings {
	const spokenLanguage = settings?.spokenLanguage ?? 'auto';
	return {
		spokenLanguage: (SUBTITLE_LANGUAGES as readonly string[]).includes(spokenLanguage)
			? spokenLanguage
			: 'auto',
	};
}
export function subtitleSettingsFromOptions(options?: ViewerOptions): SubtitleSettings {
	return normalizeSubtitleSettings({ spokenLanguage: options?.accessibility.subtitleLanguage });
}
export function updateSubtitleSettings(
	store: Pick<ViewerOptionsStore, 'setValue'>,
	settings: SubtitleSettings,
): void {
	store.setValue(
		'accessibility',
		'subtitleLanguage',
		normalizeSubtitleSettings(settings).spokenLanguage,
	);
}
export function subtitleRecognitionLanguage(
	settings: SubtitleSettings,
	browserLanguage = 'en-US',
): string {
	return settings.spokenLanguage === 'auto' ? browserLanguage || 'en-US' : settings.spokenLanguage;
}
export function subtitleSettingsLabels(t: (key: string) => string): SubtitleSettingsLabels {
	return {
		title: t('pptx.slideShow.subtitleSettings'),
		language: t('pptx.subtitles.spokenLanguage'),
		browserLanguage: t('pptx.subtitles.browserLanguage'),
		description: t('pptx.subtitles.settingsDescription'),
		apply: t('pptx.common.apply'),
		cancel: t('pptx.common.cancel'),
	};
}
