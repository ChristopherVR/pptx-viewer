// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { createViewerOptionsStore } from './options';
import {
	normalizeSubtitleSettings,
	subtitleRecognitionLanguage,
	subtitleSettingsFromOptions,
	updateSubtitleSettings,
} from './subtitle-settings';

describe('subtitle settings', () => {
	it('normalizes languages and resolves automatic recognition independently of visibility', () => {
		expect(normalizeSubtitleSettings({ spokenLanguage: 'invalid' })).toStrictEqual({
			spokenLanguage: 'auto',
		});
		expect(subtitleRecognitionLanguage({ spokenLanguage: 'auto' }, 'de-DE')).toBe('de-DE');
		expect(subtitleRecognitionLanguage({ spokenLanguage: 'fr-FR' }, 'de-DE')).toBe('fr-FR');
	});

	it('persists the viewer choice and honors host locks without changing other options', () => {
		localStorage.clear();
		const store = createViewerOptionsStore();
		updateSubtitleSettings(store, { spokenLanguage: 'fr-FR' });
		expect(
			subtitleSettingsFromOptions(createViewerOptionsStore().getOptions()).spokenLanguage,
		).toBe('fr-FR');
		store.setConstraints({ locked: { 'accessibility.subtitleLanguage': 'de-DE' } });
		updateSubtitleSettings(store, { spokenLanguage: 'en-US' });
		expect(subtitleSettingsFromOptions(store.getOptions()).spokenLanguage).toBe('de-DE');
		localStorage.clear();
	});
});
