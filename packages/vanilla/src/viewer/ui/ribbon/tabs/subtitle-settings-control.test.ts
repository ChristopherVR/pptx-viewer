import { createViewerOptionsStore, subtitleSettingsFromOptions } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createPresenterCaptions } from '../../../presenter';
import { createSubtitleSettingsControl } from './subtitle-settings-control';

describe('subtitle settings adapter', () => {
	it('resolves the viewer store after initial chrome construction', () => {
		let available: ReturnType<typeof createViewerOptionsStore> | undefined = undefined;
		const element = createSubtitleSettingsControl(document, createTranslator(), () => available);
		available = createViewerOptionsStore({ persist: false });
		available.setValue('accessibility', 'subtitleLanguage', 'de-DE');
		element.dispatchEvent(new CustomEvent('command-request'));
		expect(
			(element as HTMLElement & { settings: { spokenLanguage: string } }).settings.spokenLanguage,
		).toBe('de-DE');
		element.dispatchEvent(
			new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'fr-FR' } }),
		);
		expect(available.getOptions().accessibility.subtitleLanguage).toBe('fr-FR');
	});

	it('updates the provided store and passes its language to presenter recognition', () => {
		const store = createViewerOptionsStore({ persist: false });
		const element = createSubtitleSettingsControl(document, createTranslator(), store);
		element.dispatchEvent(
			new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'fr-FR' } }),
		);
		expect(store.getOptions().accessibility.subtitleLanguage).toBe('fr-FR');
		const starts: string[] = [];
		class Recognition extends EventTarget {
			lang = '';
			start() {
				starts.push(this.lang);
			}
			stop() {}
		}
		vi.stubGlobal('SpeechRecognition', Recognition);
		const captions = createPresenterCaptions({
			doc: document,
			t: createTranslator(),
			emit: vi.fn(),
			settings: () => subtitleSettingsFromOptions(store.getOptions()),
		});
		try {
			captions.toggle();
			expect(starts).toContain('fr-FR');
		} finally {
			captions.dispose();
			vi.unstubAllGlobals();
		}
	});
});
