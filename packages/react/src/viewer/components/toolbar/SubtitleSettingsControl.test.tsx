// @vitest-environment happy-dom
import { createViewerOptionsStore } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { PresentationSubtitleBar } from '../PresentationSubtitleBar';
import { ViewerOptionsContext, ViewerOptionsStoreContext } from '../viewer-options-context';
import { SubtitleSettingsControl } from './SubtitleSettingsControl';

vi.mock(import('react-i18next'), () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('subtitle settings adapter', () => {
	it('owns preference commits, applies recognition language and cleans up native listeners', () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		const store = createViewerOptionsStore({ persist: false });
		store.setValue('accessibility', 'subtitleLanguage', 'fr-FR');
		const snapshot = store.getOptions();
		const starts: string[] = [];
		class Recognition extends EventTarget {
			lang = '';
			start() {
				starts.push(this.lang);
			}
			stop() {}
		}
		vi.stubGlobal('SpeechRecognition', Recognition);
		const target = document.createElement('div');
		const root = createRoot(target);
		try {
			act(() =>
				root.render(
					<ViewerOptionsStoreContext.Provider value={store}>
						<ViewerOptionsContext.Provider value={snapshot}>
							<SubtitleSettingsControl />
							<PresentationSubtitleBar visible />
						</ViewerOptionsContext.Provider>
					</ViewerOptionsStoreContext.Provider>,
				),
			);
			expect(starts).toContain('fr-FR');
			const control = target.querySelector('pptx-ui-subtitle-settings')!;
			act(() =>
				control.dispatchEvent(
					new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'de-DE' } }),
				),
			);
			expect(store.getOptions().accessibility.subtitleLanguage).toBe('de-DE');
			act(() => root.unmount());
			control.dispatchEvent(
				new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'en-US' } }),
			);
			expect(store.getOptions().accessibility.subtitleLanguage).toBe('de-DE');
		} finally {
			vi.unstubAllGlobals();
			globalThis.IS_REACT_ACT_ENVIRONMENT = false;
		}
	});
});
